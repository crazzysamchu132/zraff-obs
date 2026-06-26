import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, getDocs, updateDoc, writeBatch, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Team, Group, Tournament, UserProfile, Match } from '../types';
import { Layers, Shuffle, CheckCircle, RefreshCw, AlertTriangle, Plus, Trash2 } from 'lucide-react';

interface GroupDrawManagerProps {
  currentUser: UserProfile;
  activeTournament: Tournament | null;
}

// Extend Group interface locally to support optional capacity
interface CustomGroup extends Group {
  capacity?: number;
}

export default function GroupDrawManager({ currentUser, activeTournament }: GroupDrawManagerProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [groups, setGroups] = useState<CustomGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Default seed letters A-H
  const defaultLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

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
      const groupsList: CustomGroup[] = [];
      groupsSnap.forEach((docSnap) => {
        groupsList.push(docSnap.data() as CustomGroup);
      });

      // If no groups exist in Firestore for this tournament, seed initial 8 groups (A-H)
      if (groupsList.length === 0) {
        const initialGroups: CustomGroup[] = defaultLetters.map(letter => ({
          id: `group_${letter}_${activeTournament.id}`,
          name: `Group ${letter}`,
          tournamentId: activeTournament.id,
          teamIds: [],
          teamPositions: {},
          capacity: 2 // default to 2
        }));
        
        const batch = writeBatch(db);
        initialGroups.forEach((group) => {
          batch.set(doc(db, 'groups', group.id), group);
        });
        await batch.commit();
        setGroups(initialGroups);
      } else {
        // Sort groups alphabetically by name
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

  // Handle adding a new group (letters A to Z)
  const handleAddGroup = async () => {
    if (!activeTournament) return;
    if (groups.length >= 26) {
      alert("Maximum of 26 groups (A to Z) can be created.");
      return;
    }

    const existingLetters = groups.map(g => g.name.split(' ')[1]);
    let nextLetter = 'A';
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i);
      if (!existingLetters.includes(letter)) {
        nextLetter = letter;
        break;
      }
    }

    const newGroup: CustomGroup = {
      id: `group_${nextLetter}_${activeTournament.id}`,
      name: `Group ${nextLetter}`,
      tournamentId: activeTournament.id,
      teamIds: [],
      teamPositions: {},
      capacity: 4 // default new groups to capacity 4
    };

    try {
      await setDoc(doc(db, 'groups', newGroup.id), newGroup);

      // Audit Log
      const logId = `log_${Date.now()}`;
      await setDoc(doc(db, 'system_logs', logId), {
        id: logId,
        userId: currentUser.uid,
        userName: currentUser.fullName,
        action: `Created group ${newGroup.name} with capacity 4`,
        timestamp: new Date().toISOString()
      });

      fetchTeamsAndGroups();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to add group. Error: ${err?.message || err}`);
    }
  };

  // Handle deleting a group and freeing up its assigned teams
  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!activeTournament) return;
    if (!window.confirm(`Are you sure you want to delete ${groupName}? Any teams assigned to this group will be returned to the seed pool.`)) return;

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'groups', groupId));
      await batch.commit();

      // Audit Log
      const logId = `log_${Date.now()}`;
      await setDoc(doc(db, 'system_logs', logId), {
        id: logId,
        userId: currentUser.uid,
        userName: currentUser.fullName,
        action: `Deleted group ${groupName}`,
        timestamp: new Date().toISOString()
      });

      fetchTeamsAndGroups();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to delete group. Error: ${err?.message || err}`);
    }
  };

  // Handle setting group capacity (2, 3, or 4 teams per group)
  const handleUpdateCapacity = async (groupId: string, newCapacity: number) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    // Filter out team positions that exceed new capacity
    const updatedTeamPositions = { ...group.teamPositions };
    let updatedTeamIds = [...group.teamIds];

    Object.keys(updatedTeamPositions).forEach((teamId) => {
      const pos = updatedTeamPositions[teamId];
      if (pos > newCapacity) {
        delete updatedTeamPositions[teamId];
        updatedTeamIds = updatedTeamIds.filter(id => id !== teamId);
      }
    });

    try {
      await updateDoc(doc(db, 'groups', groupId), {
        capacity: newCapacity,
        teamIds: updatedTeamIds,
        teamPositions: updatedTeamPositions
      });

      fetchTeamsAndGroups();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to update group capacity. Error: ${err?.message || err}`);
    }
  };

  // Assign team manually to a group slot
  const handleAssignTeam = async (groupId: string, position: number, teamId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    // Check if team already assigned in another slot (either in this or another group)
    const prevGroup = groups.find(g => g.teamIds.includes(teamId));
    
    // Create copy of teamIds and teamPositions
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

      // Trigger dynamic fixture updates if teams change and fixtures are already created
      if (activeTournament) {
        await updateAffectedFixtures(groupId, position, existingTeamAtPos, teamId);
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
  const updateAffectedFixtures = async (groupId: string, position: number, oldTeamId: string | undefined, newTeamId: string) => {
    if (!activeTournament) return;
    
    try {
      const fixturesSnap = await getDocs(query(collection(db, 'fixtures'), where('tournamentId', '==', activeTournament.id)));
      const fixturesList: Match[] = [];
      fixturesSnap.forEach((docSnap) => {
        fixturesList.push(docSnap.data() as Match);
      });

      if (fixturesList.length === 0) return; // No fixtures generated yet

      const newTeam = teams.find(t => t.id === newTeamId);
      const batch = writeBatch(db);
      let updatedCount = 0;

      // Scan and update matches
      fixturesList.forEach((match) => {
        let isHomeAffected = false;
        let isAwayAffected = false;

        // If we have old team ID, we can do replacement
        if (oldTeamId) {
          if (match.homeTeamId === oldTeamId) isHomeAffected = true;
          if (match.awayTeamId === oldTeamId) isAwayAffected = true;
        } else {
          // If no old team ID (vacant slot filled), we map group letter & position
          const groupLetter = groupId.split('_')[1]; // e.g. group_A_123 -> A
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
        }

        if (isHomeAffected && newTeam) {
          batch.update(doc(db, 'fixtures', match.id), {
            homeTeamId: newTeam.id,
            homeTeamName: newTeam.name,
            homeTeamShortName: newTeam.shortName,
            homeTeamLogo: newTeam.logo
          });
          updatedCount++;
        }
        if (isAwayAffected && newTeam) {
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

  // Conduct random auto seeding draw
  const handleRandomDraw = async () => {
    if (teams.length < 2) {
      alert("At least 2 teams must be registered before you can run a random group draw.");
      return;
    }
    if (!window.confirm(`This will randomly distribute all ${teams.length} teams into current group slots. Are you sure?`)) return;

    try {
      const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
      const batch = writeBatch(db);

      let teamIndex = 0;

      groups.forEach((group) => {
        const capacity = group.capacity || 2;
        const groupTeamIds: string[] = [];
        const groupTeamPositions: { [teamId: string]: number } = {};

        for (let pos = 1; pos <= capacity; pos++) {
          if (teamIndex < shuffledTeams.length) {
            const team = shuffledTeams[teamIndex];
            groupTeamIds.push(team.id);
            groupTeamPositions[team.id] = pos;
            teamIndex++;
          }
        }

        batch.update(doc(db, 'groups', group.id), {
          teamIds: groupTeamIds,
          teamPositions: groupTeamPositions
        });
      });

      await batch.commit();

      // Add log
      const logId = `log_${Date.now()}`;
      await setDoc(doc(db, 'system_logs', logId), {
        id: logId,
        userId: currentUser.uid,
        userName: currentUser.fullName,
        action: `Conducted randomized automatic group draw for ${teams.length} teams`,
        timestamp: new Date().toISOString()
      });

      // Silently update fixtures
      await handleGenerateFixturesSilent();

      fetchTeamsAndGroups();
      alert("Random group draw completed successfully!");
    } catch (err) {
      console.error(err);
      alert('Error conducting random draw.');
    }
  };

  const handleGenerateFixtures = async () => {
    const assignedCount = groups.reduce((acc, g) => acc + g.teamIds.length, 0);
    if (assignedCount < 2) {
      alert("At least 2 teams must be assigned to groups before generating fixtures.");
      return;
    }

    if (!window.confirm(`This will generate a tournament bracket matched to the ${assignedCount} assigned teams. Existing fixtures will be cleared. Continue?`)) return;

    try {
      await generateKnockoutFixtures();
      alert("Championship fixtures and bracket generated successfully!");
    } catch (err: any) {
      console.error(err);
      alert(`Failed to generate fixtures: ${err?.message || err}`);
    }
  };

  // Internal silent generation to propagate draw updates
  const handleGenerateFixturesSilent = async () => {
    try {
      await generateKnockoutFixtures();
    } catch (err) {
      console.error(err);
    }
  };

  // Dynamic Knockout Bracket Generator based on total teams assigned to groups
  const generateKnockoutFixtures = async () => {
    if (!activeTournament) return;

    // 1. Gather all assigned teams in order of groups and slot positions
    const assignedTeamsList: Team[] = [];
    groups.forEach((group) => {
      const positionsMap = group.teamPositions || {};
      const sortedTeamIds = [...group.teamIds].sort((a, b) => {
        const posA = positionsMap[a] || 99;
        const posB = positionsMap[b] || 99;
        return posA - posB;
      });
      sortedTeamIds.forEach((tid) => {
        const team = teams.find(t => t.id === tid);
        if (team) {
          assignedTeamsList.push(team);
        }
      });
    });

    const N = assignedTeamsList.length;
    if (N < 2) return;

    const batch = writeBatch(db);

    // Clean out existing fixtures first
    const fixturesSnap = await getDocs(query(collection(db, 'fixtures'), where('tournamentId', '==', activeTournament.id)));
    fixturesSnap.forEach((docSnap) => {
      batch.delete(doc(db, 'fixtures', docSnap.id));
    });

    // Match builder helper
    const createMatchData = (num: number, round: 'Round of 16' | 'Quarter Finals' | 'Semi Finals' | 'Third Place' | 'Final', home: Team | null, away: Team | null): Match => {
      const id = `match_${num}_${activeTournament.id}`;
      return {
        id,
        tournamentId: activeTournament.id,
        matchNumber: num,
        homeTeamId: home?.id || '',
        awayTeamId: away?.id || '',
        homeTeamName: home?.name || '',
        awayTeamName: away?.name || '',
        homeTeamShortName: home?.shortName || '',
        awayTeamShortName: away?.shortName || '',
        homeTeamLogo: home?.logo || '',
        awayTeamLogo: away?.logo || '',
        date: activeTournament.startDate,
        kickoffTime: `${16 + Math.floor(num / 2)}:00`,
        venue: activeTournament.venue,
        status: 'Scheduled',
        round,
        referee: `Referee Pool #${num}`,
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
    };

    // Determine starting round based on the size of the team pool
    if (N >= 16) {
      // Classic Round of 16 starting bracket (Matches 1-16)
      const classicSeedingPossible = groups.length >= 8 && groups.slice(0, 8).every(g => g.teamIds.length >= 2);

      const getTeamInGroupPos = (letter: string, pos: number): Team | null => {
        const group = groups.find(g => g.name.endsWith(letter));
        if (!group) return null;
        const teamId = Object.keys(group.teamPositions).find(tid => group.teamPositions[tid] === pos);
        return teams.find(t => t.id === teamId) || null;
      };

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

      for (let num = 1; num <= 8; num++) {
        let home: Team | null = null;
        let away: Team | null = null;

        if (classicSeedingPossible) {
          const pairing = matchpairings[num - 1];
          home = getTeamInGroupPos(pairing.homeGrp, pairing.homePos);
          away = getTeamInGroupPos(pairing.awayGrp, pairing.awayPos);
        } else {
          home = assignedTeamsList[(num - 1) * 2] || null;
          away = assignedTeamsList[(num - 1) * 2 + 1] || null;
        }

        batch.set(doc(db, 'fixtures', `match_${num}_${activeTournament.id}`), createMatchData(num, 'Round of 16', home, away));
      }

      // Templates for subsequent rounds (9 to 16)
      for (let num = 9; num <= 12; num++) {
        batch.set(doc(db, 'fixtures', `match_${num}_${activeTournament.id}`), createMatchData(num, 'Quarter Finals', null, null));
      }
      for (let num = 13; num <= 14; num++) {
        batch.set(doc(db, 'fixtures', `match_${num}_${activeTournament.id}`), createMatchData(num, 'Semi Finals', null, null));
      }
      batch.set(doc(db, 'fixtures', `match_${15}_${activeTournament.id}`), createMatchData(15, 'Third Place', null, null));
      batch.set(doc(db, 'fixtures', `match_${16}_${activeTournament.id}`), createMatchData(16, 'Final', null, null));

    } else if (N >= 8) {
      // Quarter Finals starting bracket (Matches 9-16)
      for (let num = 9; num <= 12; num++) {
        const home = assignedTeamsList[(num - 9) * 2] || null;
        const away = assignedTeamsList[(num - 9) * 2 + 1] || null;
        batch.set(doc(db, 'fixtures', `match_${num}_${activeTournament.id}`), createMatchData(num, 'Quarter Finals', home, away));
      }

      for (let num = 13; num <= 14; num++) {
        batch.set(doc(db, 'fixtures', `match_${num}_${activeTournament.id}`), createMatchData(num, 'Semi Finals', null, null));
      }
      batch.set(doc(db, 'fixtures', `match_${15}_${activeTournament.id}`), createMatchData(15, 'Third Place', null, null));
      batch.set(doc(db, 'fixtures', `match_${16}_${activeTournament.id}`), createMatchData(16, 'Final', null, null));

    } else if (N >= 4) {
      // Semi Finals starting bracket (Matches 13-16)
      for (let num = 13; num <= 14; num++) {
        const home = assignedTeamsList[(num - 13) * 2] || null;
        const away = assignedTeamsList[(num - 13) * 2 + 1] || null;
        batch.set(doc(db, 'fixtures', `match_${num}_${activeTournament.id}`), createMatchData(num, 'Semi Finals', home, away));
      }

      batch.set(doc(db, 'fixtures', `match_${15}_${activeTournament.id}`), createMatchData(15, 'Third Place', null, null));
      batch.set(doc(db, 'fixtures', `match_${16}_${activeTournament.id}`), createMatchData(16, 'Final', null, null));

    } else {
      // Final Match only (Match 16)
      const home = assignedTeamsList[0] || null;
      const away = assignedTeamsList[1] || null;
      batch.set(doc(db, 'fixtures', `match_16_${activeTournament.id}`), createMatchData(16, 'Final', home, away));
    }

    await batch.commit();

    // Trigger update in graphics setting as well (show groups overlay)
    await setDoc(doc(db, 'graphics', 'overlay_control'), {
      activeOverlay: 'group_draw',
      activeMatchId: N >= 16 ? `match_1_${activeTournament.id}` : N >= 8 ? `match_9_${activeTournament.id}` : N >= 4 ? `match_13_${activeTournament.id}` : `match_16_${activeTournament.id}`,
      createdAt: new Date().toISOString()
    });

    // Audit Log
    const logId = `log_${Date.now()}`;
    await setDoc(doc(db, 'system_logs', logId), {
      id: logId,
      userId: currentUser.uid,
      userName: currentUser.fullName,
      action: `Generated dynamic tournament bracket fixtures for ${N} assigned teams starting at ${
        N >= 16 ? 'Round of 16' : N >= 8 ? 'Quarter Finals' : N >= 4 ? 'Semi Finals' : 'Final'
      }`,
      timestamp: new Date().toISOString()
    });

    fetchTeamsAndGroups();
  };

  const isEditable = currentUser.role === 'admin' || currentUser.role === 'manager';
  const assignedTeamsCount = groups.reduce((acc, g) => acc + g.teamIds.length, 0);
  const canGenerateFixtures = assignedTeamsCount >= 2;

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
            <p className="text-sm text-slate-400">Manage custom groups, scale capacity (2-4 per group) and execute dynamic bracket seedings.</p>
          </div>
        </div>

        {isEditable && (
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto" id="groups-toolbar">
            <button
              onClick={handleAddGroup}
              className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 text-yellow-500 py-2.5 px-4 rounded-xl transition text-sm font-semibold"
              id="btn-add-group"
              title="Add a custom group (A to Z)"
            >
              <Plus className="w-4 h-4" />
              <span>Add Group</span>
            </button>

            <button
              onClick={handleRandomDraw}
              className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 py-2.5 px-4 rounded-xl transition text-sm font-semibold"
              id="btn-random-draw"
            >
              <Shuffle className="w-4 h-4 text-yellow-500" />
              <span>Auto Seed Draw</span>
            </button>

            {canGenerateFixtures && (
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

      {teams.length < 2 && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-sm flex items-start space-x-3" id="teams-count-warning">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <span className="font-bold">Roster Shortage:</span> You must register at least 2 teams in the "Teams" tab before you can manage seeding groups or start drawing.
          </div>
        </div>
      )}

      {/* Info Stats Row */}
      <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col sm:flex-row gap-6 justify-between text-xs font-mono text-slate-400">
        <div>Total Registered Teams: <span className="text-white font-bold">{teams.length}/48</span></div>
        <div>Total Assigned: <span className="text-yellow-500 font-bold">{assignedTeamsCount} Teams</span></div>
        <div>Remaining Seed Pool: <span className="text-white font-bold">{unassignedTeams.length} Teams</span></div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8" id="groups-draw-layout">
        {/* Seeding Boards (Groups A-Z) */}
        <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="groups-boards">
          {groups.map((group) => {
            const letter = group.name.split(' ')[1];
            const capacity = group.capacity || 2;
            const positions = Array.from({ length: capacity }, (_, i) => i + 1);

            return (
              <div 
                key={group.id} 
                id={`group-board-${letter}`}
                className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col space-y-4"
              >
                {/* Board header */}
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-display font-extrabold text-base text-yellow-500 tracking-wider">
                      {group.name}
                    </h3>
                    {isEditable && (
                      <button
                        onClick={() => handleDeleteGroup(group.id, group.name)}
                        className="text-slate-500 hover:text-red-400 p-1 rounded transition"
                        title="Delete Group"
                        id={`btn-delete-group-${letter}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  
                  {/* Capacity buttons */}
                  {isEditable ? (
                    <div className="flex items-center space-x-1 bg-white/5 rounded-lg p-0.5 border border-white/10" id={`capacity-select-${letter}`}>
                      {[2, 3, 4].map((cap) => (
                        <button
                          key={cap}
                          onClick={() => handleUpdateCapacity(group.id, cap)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                            capacity === cap ? 'bg-yellow-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                          }`}
                          title={`Set capacity to ${cap} teams`}
                        >
                          {cap}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-500">
                      {group.teamIds.length}/{capacity} SLOTS
                    </span>
                  )}
                </div>

                {/* Seeding slots */}
                <div className="space-y-4 flex-1 flex flex-col justify-start" id={`group-slots-${letter}`}>
                  {positions.map((pos) => {
                    const posTeamId = Object.keys(group.teamPositions).find(tid => group.teamPositions[tid] === pos);
                    const team = teams.find(t => t.id === posTeamId);

                    return (
                      <div key={pos} className="space-y-1.5" id={`group-slot-${letter}-${pos}`}>
                        <div className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">SEED #{pos}</div>
                        {isEditable && teams.length >= 2 ? (
                          <select
                            value={posTeamId || ''}
                            onChange={(e) => handleAssignTeam(group.id, pos, e.target.value)}
                            className={`w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-yellow-500/50 ${
                              team ? 'border-yellow-500/20 font-semibold' : 'text-slate-500 italic'
                            }`}
                            id={`select-team-${letter}-${pos}`}
                          >
                            <option value="">[DRAW VACANT SLOT]</option>
                            {teams.map(t => (
                              <option 
                                key={t.id} 
                                value={t.id} 
                                disabled={assignedTeamIds.includes(t.id) && t.id !== posTeamId}
                                className="bg-slate-950 text-white font-sans"
                              >
                                {t.name} ({t.shortName})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="w-full bg-slate-900/60 border border-white/5 rounded-xl py-2.5 px-3.5 text-xs text-slate-400 flex items-center space-x-2">
                            {team ? (
                              <>
                                {team.logo ? (
                                  <img src={team.logo} alt={team.name} className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />
                                ) : null}
                                <span className="font-bold text-slate-200">{team.name}</span>
                              </>
                            ) : (
                              <span className="italic text-slate-600">[Empty Seed Slot]</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar Seed Pool */}
        <div className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col h-[540px]" id="unassigned-sidebar">
          <div className="shrink-0 mb-4 pb-2 border-b border-white/5">
            <h3 className="font-display font-bold text-sm text-white">Remaining Seed Pool</h3>
            <p className="text-[11px] text-slate-500 mt-1 font-mono uppercase">{unassignedTeams.length} WAITING TO BE DRAWN</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1" id="seed-pool-list">
            {unassignedTeams.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                <span className="text-xs font-semibold text-slate-300">All Teams Drawn</span>
                <p className="text-[10px] text-slate-500 mt-1 leading-snug">Seeding completed. Trigger the fixture engine to establish matches.</p>
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

