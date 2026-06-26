import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, getDocs, updateDoc, writeBatch, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Team, Group, Tournament, UserProfile, Match } from '../types';
import { Layers, Shuffle, CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';

interface GroupDrawManagerProps {
  currentUser: UserProfile;
  activeTournament: Tournament | null;
}

export default function GroupDrawManager({ currentUser, activeTournament }: GroupDrawManagerProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Group letters
  const groupLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  const fetchTeamsAndGroups = async () => {
    if (!activeTournament) return;
    setLoading(true);
    try {
      // Fetch teams
      const teamsSnap = await getDocs(query(collection(db, 'teams'), where('tournamentId', '==', activeTournament.id)));
      const teamsList: Team[] = [];
      teamsSnap.forEach((docSnap) => {
        teamsList.push({ id: docSnap.id, ...docSnap.data() } as Team);
      });
      setTeams(teamsList);

      // Fetch groups
      const groupsSnap = await getDocs(query(collection(db, 'groups'), where('tournamentId', '==', activeTournament.id)));
      const groupsList: Group[] = [];
      groupsSnap.forEach((docSnap) => {
        groupsList.push(docSnap.data() as Group);
      });

      // If no groups exist in Firestore for this tournament, seed them
      if (groupsList.length === 0) {
        const initialGroups: Group[] = groupLetters.map(letter => ({
          id: `group_${letter}_${activeTournament.id}`,
          name: `Group ${letter}`,
          tournamentId: activeTournament.id,
          teamIds: [],
          teamPositions: {}
        }));
        
        // Batch write initial groups
        const batch = writeBatch(db);
        initialGroups.forEach((group) => {
          batch.set(doc(db, 'groups', group.id), group);
        });
        await batch.commit();
        setGroups(initialGroups);
      } else {
        // Sort groups A to H
        groupsList.sort((a, b) => a.name.localeCompare(b.name));
        setGroups(groupsList);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamsAndGroups();
  }, [activeTournament]);

  // Find remaining unassigned teams
  const assignedTeamIds = groups.flatMap(g => g.teamIds);
  const unassignedTeams = teams.filter(t => !assignedTeamIds.includes(t.id));

  const handleAssignTeam = async (groupId: string, position: number, teamId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    // Check if team already assigned in another slot
    const prevGroup = groups.find(g => g.teamIds.includes(teamId));
    let updatedPrevGroup: Group | null = null;
    
    // Create new copy of teamIds and teamPositions
    let newTeamIds = [...group.teamIds];
    let newTeamPositions = { ...group.teamPositions };

    // Get the team currently at this position, if any
    const existingTeamAtPos = Object.keys(newTeamPositions).find(tid => newTeamPositions[tid] === position);
    if (existingTeamAtPos) {
      newTeamIds = newTeamIds.filter(tid => tid !== existingTeamAtPos);
      delete newTeamPositions[existingTeamAtPos];
    }

    // Add new team
    if (teamId) {
      if (!newTeamIds.includes(teamId)) {
        newTeamIds.push(teamId);
      }
      newTeamPositions[teamId] = position;
    }

    try {
      const batch = writeBatch(db);

      // If team was in another group, remove it
      if (prevGroup && prevGroup.id !== groupId) {
        const cleanIds = prevGroup.teamIds.filter(tid => tid !== teamId);
        const cleanPositions = { ...prevGroup.teamPositions };
        delete cleanPositions[teamId];
        
        batch.update(doc(db, 'groups', prevGroup.id), {
          teamIds: cleanIds,
          teamPositions: cleanPositions
        });
      }

      batch.update(doc(db, 'groups', groupId), {
        teamIds: newTeamIds,
        teamPositions: newTeamPositions
      });

      await batch.commit();

      // Trigger instant fixture updates if team changes and fixtures are already created
      if (activeTournament) {
        await updateAffectedFixtures(groupId, position, teamId);
      }

      // Add audit log
      const teamName = teams.find(t => t.id === teamId)?.name || "Empty";
      const logId = `log_${Date.now()}`;
      await setDoc(doc(db, 'system_logs', logId), {
        id: logId,
        userId: currentUser.uid,
        userName: currentUser.fullName,
        action: `Assigned ${teamName} to ${group.name} Position ${position}`,
        timestamp: new Date().toISOString()
      });

      fetchTeamsAndGroups();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to assign team to group. Error: ${err?.message || err}`);
    }
  };

  // Helper to dynamically update existing fixtures when teams change in groups
  const updateAffectedFixtures = async (groupId: string, position: number, newTeamId: string) => {
    if (!activeTournament) return;
    
    try {
      // Find the team details
      const newTeam = teams.find(t => t.id === newTeamId);
      if (!newTeam) return;

      const groupLetter = groupId.split('_')[1]; // e.g. group_A_123 -> A

      // Query existing fixtures
      const fixturesSnap = await getDocs(query(collection(db, 'fixtures'), where('tournamentId', '==', activeTournament.id)));
      const fixturesList: Match[] = [];
      fixturesSnap.forEach((docSnap) => {
        fixturesList.push(docSnap.data() as Match);
      });

      if (fixturesList.length === 0) return; // No fixtures generated yet

      const batch = writeBatch(db);
      let updatedCount = 0;

      // Scan and update matches
      fixturesList.forEach((match) => {
        let isHomeAffected = false;
        let isAwayAffected = false;

        // Check fixture mapping
        // e.g. Round of 16 Match 1: Group A #1 vs Group B #2
        if (match.round === 'Round of 16') {
          if (groupLetter === 'A' && position === 1 && match.matchNumber === 1) isHomeAffected = true;
          if (groupLetter === 'B' && position === 2 && match.matchNumber === 1) isAwayAffected = true;

          if (groupLetter === 'A' && position === 2 && match.matchNumber === 2) isHomeAffected = true;
          if (groupLetter === 'B' && position === 1 && match.matchNumber === 2) isAwayAffected = true;

          if (groupLetter === 'C' && position === 1 && match.matchNumber === 3) isHomeAffected = true;
          if (groupLetter === 'D' && position === 2 && match.matchNumber === 3) isAwayAffected = true;

          if (groupLetter === 'C' && position === 2 && match.matchNumber === 4) isHomeAffected = true;
          if (groupLetter === 'D' && position === 1 && match.matchNumber === 4) isAwayAffected = true;

          if (groupLetter === 'E' && position === 1 && match.matchNumber === 5) isHomeAffected = true;
          if (groupLetter === 'F' && position === 2 && match.matchNumber === 5) isAwayAffected = true;

          if (groupLetter === 'E' && position === 2 && match.matchNumber === 6) isHomeAffected = true;
          if (groupLetter === 'F' && position === 1 && match.matchNumber === 6) isAwayAffected = true;

          if (groupLetter === 'G' && position === 1 && match.matchNumber === 7) isHomeAffected = true;
          if (groupLetter === 'H' && position === 2 && match.matchNumber === 7) isAwayAffected = true;

          if (groupLetter === 'G' && position === 2 && match.matchNumber === 8) isHomeAffected = true;
          if (groupLetter === 'H' && position === 1 && match.matchNumber === 8) isAwayAffected = true;
        }

        if (isHomeAffected) {
          batch.update(doc(db, 'fixtures', match.id), {
            homeTeamId: newTeam.id,
            homeTeamName: newTeam.name,
            homeTeamShortName: newTeam.shortName,
            homeTeamLogo: newTeam.logo
          });
          updatedCount++;
        }
        if (isAwayAffected) {
          batch.update(doc(db, 'fixtures', match.id), {
            awayTeamId: newTeam.id,
            awayTeamName: newTeam.name,
            awayTeamShortName: newTeam.shortName,
            awayTeamLogo: newTeam.logo
          });
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        await batch.commit();
        console.log(`Successfully updated ${updatedCount} fixtures dynamically!`);
      }
    } catch (err) {
      console.error('Error updating affected fixtures:', err);
    }
  };

  const handleRandomDraw = async () => {
    if (teams.length < 16) {
      alert("At least 16 teams must be registered before you can run a random group draw.");
      return;
    }
    if (!window.confirm("This will randomly re-allocate all 16 teams to Groups A-H. Are you sure?")) return;

    try {
      const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
      const batch = writeBatch(db);

      groups.forEach((group, groupIdx) => {
        const team1 = shuffledTeams[groupIdx * 2];
        const team2 = shuffledTeams[groupIdx * 2 + 1];
        
        const teamIds = [team1.id, team2.id];
        const teamPositions = {
          [team1.id]: 1,
          [team2.id]: 2
        };

        batch.update(doc(db, 'groups', group.id), {
          teamIds,
          teamPositions
        });
      });

      await batch.commit();

      // Trigger automatic affected fixtures update if already generated
      await handleGenerateFixturesSilent();

      // Add log
      const logId = `log_${Date.now()}`;
      await setDoc(doc(db, 'system_logs', logId), {
        id: logId,
        userId: currentUser.uid,
        userName: currentUser.fullName,
        action: `Conducted randomized automatic seeding for groups A to H`,
        timestamp: new Date().toISOString()
      });

      fetchTeamsAndGroups();
      alert("Random group draw completed! Round of 16 matchups generated.");
    } catch (err) {
      console.error(err);
      alert('Error conducting random draw.');
    }
  };

  const handleGenerateFixtures = async () => {
    // Check if all groups are filled
    const isAllFilled = groups.every(g => g.teamIds.length === 2);
    if (!isAllFilled) {
      alert("All 8 groups must have exactly 2 teams allocated before you can generate fixtures.");
      return;
    }

    try {
      await generateRoundOf16Fixtures();
      alert("Championship Round of 16 fixtures generated successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to generate fixtures.");
    }
  };

  // Internal silent generation to propagate draw updates
  const handleGenerateFixturesSilent = async () => {
    try {
      await generateRoundOf16Fixtures();
    } catch (err) {
      console.error(err);
    }
  };

  const generateRoundOf16Fixtures = async () => {
    if (!activeTournament) return;

    const batch = writeBatch(db);

    // Group maps
    const groupMap: { [letter: string]: Group } = {};
    groups.forEach((g) => {
      const letter = g.name.split(' ')[1]; // A, B, C...
      groupMap[letter] = g;
    });

    const getTeamInGroupPos = (letter: string, pos: number): Team => {
      const group = groupMap[letter];
      const teamId = Object.keys(group.teamPositions).find(tid => group.teamPositions[tid] === pos);
      return teams.find(t => t.id === teamId)!;
    };

    // Fixture Logic Definition
    const matchpairings = [
      { num: 1, homeGrp: 'A', homePos: 1, awayGrp: 'B', awayPos: 2 },
      { num: 2, homeGrp: 'A', homePos: 2, awayGrp: 'B', awayPos: 1 },
      { num: 3, homeGrp: 'C', homePos: 1, awayGrp: 'D', awayPos: 2 },
      { num: 4, homeGrp: 'C', homePos: 2, awayGrp: 'D', awayPos: 1 },
      { num: 5, homeGrp: 'E', homePos: 1, awayGrp: 'F', awayPos: 2 },
      { num: 6, homeGrp: 'E', homePos: 2, awayGrp: 'F', awayPos: 1 },
      { num: 7, homeGrp: 'G', homePos: 1, awayGrp: 'H', awayPos: 2 },
      { num: 8, homeGrp: 'G', homePos: 2, awayGrp: 'H', awayPos: 1 }
    ];

    matchpairings.forEach((p) => {
      const home = getTeamInGroupPos(p.homeGrp, p.homePos);
      const away = getTeamInGroupPos(p.awayGrp, p.awayPos);

      const id = `match_${p.num}_${activeTournament.id}`;
      const matchData: Match = {
        id,
        tournamentId: activeTournament.id,
        matchNumber: p.num,
        homeTeamId: home.id,
        awayTeamId: away.id,
        homeTeamName: home.name,
        awayTeamName: away.name,
        homeTeamShortName: home.shortName,
        awayTeamShortName: away.shortName,
        homeTeamLogo: home.logo,
        awayTeamLogo: away.logo,
        date: activeTournament.startDate,
        kickoffTime: `${16 + Math.floor(p.num / 2)}:00`,
        venue: activeTournament.venue,
        status: 'Scheduled',
        round: 'Round of 16',
        referee: `Referee Pool #${p.num}`,
        locked: false,
        winnerId: '',
        score: { home: 0, away: 0 },
        events: [],
        stats: {
          possession: { home: 50, away: 50 },
          shots: { home: 0, away: 0 },
          corners: { home: 0, away: 0 }
        },
        timer: {
          elapsedSeconds: 0,
          isRunning: false,
          lastUpdated: new Date().toISOString(),
          half: 1
        }
      };

      batch.set(doc(db, 'fixtures', id), matchData);
    });

    await batch.commit();

    // Trigger update in graphics setting as well (show groups overlay)
    await setDoc(doc(db, 'graphics', 'overlay_control'), {
      activeOverlay: 'group_draw',
      activeMatchId: `match_1_${activeTournament.id}`,
      createdAt: new Date().toISOString()
    });
  };

  const isEditable = currentUser.role === 'admin' || currentUser.role === 'manager';
  const allGroupsFilled = groups.every(g => g.teamIds.length === 2);

  if (!activeTournament) {
    return (
      <div className="p-12 text-center" id="groups-unselected">
        <Layers className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">No Active Tournament Selected</h2>
        <p className="text-slate-400 mt-2 max-w-sm mx-auto">Choose an active tournament in the Tournaments tab to run the seeding draw.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6" id="group-draw-container">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4" id="groups-header">
        <div className="flex items-center space-x-3">
          <Layers className="w-8 h-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-display font-extrabold text-white">CHAMPIONSHIP GROUP SEEDING DRAW</h1>
            <p className="text-sm text-slate-400">Distribute 16 qualified teams into seed pools A-H to establish Round of 16 knockout matches.</p>
          </div>
        </div>

        {isEditable && teams.length >= 16 && (
          <div className="flex items-center gap-3 w-full md:w-auto" id="groups-toolbar">
            <button
              onClick={handleRandomDraw}
              className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 py-2.5 px-4 rounded-xl transition text-sm font-semibold"
              id="btn-random-draw"
            >
              <Shuffle className="w-4 h-4 text-yellow-500" />
              <span>Auto Seed Draw</span>
            </button>

            {allGroupsFilled && (
              <button
                onClick={handleGenerateFixtures}
                className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 font-bold py-2.5 px-5 rounded-xl shadow-lg hover:from-yellow-400 hover:to-amber-500 transition active:scale-[0.98]"
                id="btn-generate-fixtures"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Generate Fixtures</span>
              </button>
            )}
          </div>
        )}
      </div>

      {teams.length < 16 && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm flex items-start space-x-3" id="teams-count-warning">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <span className="font-bold">Roster Shortage:</span> Currently only {teams.length}/16 teams are registered. You must register exactly 16 teams in the "Teams" tab before you can configure the seeding slots or trigger auto-generation.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8" id="groups-draw-layout">
        {/* Seeding Boards (Groups A-H) */}
        <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="groups-boards">
          {groups.map((group) => {
            const letter = group.name.split(' ')[1];
            
            // Resolve teams inside this group
            const pos1TeamId = Object.keys(group.teamPositions).find(tid => group.teamPositions[tid] === 1);
            const pos2TeamId = Object.keys(group.teamPositions).find(tid => group.teamPositions[tid] === 2);
            
            const team1 = teams.find(t => t.id === pos1TeamId);
            const team2 = teams.find(t => t.id === pos2TeamId);

            return (
              <div 
                key={group.id} 
                id={`group-board-${letter}`}
                className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col space-y-4"
              >
                {/* Board title */}
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <h3 className="font-display font-extrabold text-base text-yellow-500 tracking-wider">
                    {group.name}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">{group.teamIds.length}/2 SLOTS</span>
                </div>

                {/* Seeding slots */}
                <div className="space-y-3 flex-1 flex flex-col justify-center" id={`group-slots-${letter}`}>
                  {/* Position 1 */}
                  <div className="space-y-1.5" id={`group-slot-${letter}-1`}>
                    <div className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">SEED #1</div>
                    {isEditable && teams.length >= 16 ? (
                      <select
                        value={pos1TeamId || ''}
                        onChange={(e) => handleAssignTeam(group.id, 1, e.target.value)}
                        className={`w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-yellow-500/50 ${
                          team1 ? 'border-yellow-500/20 font-semibold' : 'text-slate-500 italic'
                        }`}
                        id={`select-team-${letter}-1`}
                      >
                        <option value="">[DRAW VACANT SLOT]</option>
                        {teams.map(t => (
                          <option 
                            key={t.id} 
                            value={t.id} 
                            disabled={assignedTeamIds.includes(t.id) && t.id !== pos1TeamId}
                            className="bg-slate-950 text-white font-sans"
                          >
                            {t.name} ({t.shortName})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-full bg-slate-900/60 border border-white/5 rounded-xl py-2.5 px-3.5 text-xs text-slate-400 flex items-center space-x-2">
                        {team1 ? (
                          <>
                            {team1.logo ? (
                              <img src={team1.logo} alt={team1.name} className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />
                            ) : null}
                            <span className="font-bold text-slate-200">{team1.name}</span>
                          </>
                        ) : (
                          <span className="italic text-slate-600">[Empty Seed Slot]</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Position 2 */}
                  <div className="space-y-1.5" id={`group-slot-${letter}-2`}>
                    <div className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">SEED #2</div>
                    {isEditable && teams.length >= 16 ? (
                      <select
                        value={pos2TeamId || ''}
                        onChange={(e) => handleAssignTeam(group.id, 2, e.target.value)}
                        className={`w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-yellow-500/50 ${
                          team2 ? 'border-yellow-500/20 font-semibold' : 'text-slate-500 italic'
                        }`}
                        id={`select-team-${letter}-2`}
                      >
                        <option value="">[DRAW VACANT SLOT]</option>
                        {teams.map(t => (
                          <option 
                            key={t.id} 
                            value={t.id} 
                            disabled={assignedTeamIds.includes(t.id) && t.id !== pos2TeamId}
                            className="bg-slate-950 text-white font-sans"
                          >
                            {t.name} ({t.shortName})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-full bg-slate-900/60 border border-white/5 rounded-xl py-2.5 px-3.5 text-xs text-slate-400 flex items-center space-x-2">
                        {team2 ? (
                          <>
                            {team2.logo ? (
                              <img src={team2.logo} alt={team2.name} className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />
                            ) : null}
                            <span className="font-bold text-slate-200">{team2.name}</span>
                          </>
                        ) : (
                          <span className="italic text-slate-600">[Empty Seed Slot]</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar Seed Pool */}
        <div className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col h-[540px]" id="unassigned-sidebar">
          <div className="shrink-0 mb-4 pb-2 border-b border-white/5">
            <h3 className="font-display font-bold text-sm text-white">Remaining Seed Pool</h3>
            <p className="text-[11px] text-slate-500 mt-1 font-mono uppercase">{unassignedTeams.length}/16 WAITING TO BE DRAWN</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1" id="seed-pool-list">
            {unassignedTeams.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                <span className="text-xs font-semibold text-slate-300">All Teams Drawn</span>
                <p className="text-[10px] text-slate-500 mt-1 leading-snug">Seeding matrices completed. Trigger the fixture engine to establish matches.</p>
              </div>
            ) : (
              unassignedTeams.map((team) => (
                <div key={team.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center space-x-3 hover:border-yellow-500/20 hover:bg-white/[0.08] transition text-xs" id={`seed-team-${team.id}`}>
                  {team.logo ? (
                    <img src={team.logo} alt={team.name} className="w-6 h-6 object-contain bg-white/5 border border-white/10 rounded p-0.5" referrerPolicy="no-referrer" />
                  ) : null}
                  <div className="truncate">
                    <div className="font-semibold text-slate-200 truncate">{team.name}</div>
                    <div className="text-[9px] font-mono text-slate-400 uppercase mt-0.5">{team.shortName} • {team.country}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
