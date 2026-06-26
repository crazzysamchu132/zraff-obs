import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Match, Team, Tournament, UserProfile } from '../types';
import { Calendar, Award, Lock, Unlock, ShieldAlert, FileSpreadsheet, Play, CheckCircle } from 'lucide-react';

interface FixtureBracketManagerProps {
  currentUser: UserProfile;
  activeTournament: Tournament | null;
  onSelectMatchToControl: (matchId: string) => void;
}

export default function FixtureBracketManager({ currentUser, activeTournament, onSelectMatchToControl }: FixtureBracketManagerProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'schedule' | 'bracket'>('bracket');

  // Referee assign state
  const [assigningMatchId, setAssigningMatchId] = useState<string | null>(null);
  const [tempReferee, setTempReferee] = useState('');

  const fetchMatchesAndTeams = async () => {
    if (!activeTournament) return;
    setLoading(true);
    try {
      // Fetch teams (for referencing logos / colors)
      const teamsSnap = await getDocs(query(collection(db, 'teams'), where('tournamentId', '==', activeTournament.id)));
      const teamsList: Team[] = [];
      teamsSnap.forEach((docSnap) => {
        teamsList.push({ id: docSnap.id, ...docSnap.data() } as Team);
      });
      setTeams(teamsList);

      // Fetch matches
      const matchesSnap = await getDocs(query(collection(db, 'fixtures'), where('tournamentId', '==', activeTournament.id)));
      const matchesList: Match[] = [];
      matchesSnap.forEach((docSnap) => {
        matchesList.push(docSnap.data() as Match);
      });

      // Sort matches by matchNumber
      matchesList.sort((a, b) => a.matchNumber - b.matchNumber);
      setMatches(matchesList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchesAndTeams();
  }, [activeTournament]);

  const handleLockFixture = async (matchId: string, locked: boolean) => {
    try {
      await updateDoc(doc(db, 'fixtures', matchId), { locked });
      setMatches(matches.map(m => m.id === matchId ? { ...m, locked } : m));
      
      // Audit log
      const logId = `log_${Date.now()}`;
      await setDoc(doc(db, 'system_logs', logId), {
        id: logId,
        userId: currentUser.uid,
        userName: currentUser.fullName,
        action: `${locked ? 'Locked' : 'Unlocked'} match number ${matches.find(m => m.id === matchId)?.matchNumber}`,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
      alert('Failed to update fixture lock.');
    }
  };

  const handleAssignReferee = async (matchId: string) => {
    try {
      await updateDoc(doc(db, 'fixtures', matchId), { referee: tempReferee });
      setMatches(matches.map(m => m.id === matchId ? { ...m, referee: tempReferee } : m));
      setAssigningMatchId(null);
      setTempReferee('');
    } catch (err) {
      console.error(err);
      alert('Failed to assign referee.');
    }
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Match Number,Round,Home Team,Away Team,Date,Kickoff,Venue,Status,Score,Referee\r\n";
    
    matches.forEach((m) => {
      const scoreStr = m.status === 'Finished' ? `"${m.score.home} - ${m.score.away}"` : '"N/A"';
      csvContent += `${m.matchNumber},${m.round},"${m.homeTeamName}","${m.awayTeamName}",${m.date},${m.kickoffTime},"${m.venue}",${m.status},${scoreStr},"${m.referee}"\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", `${activeTournament?.name.replace(/\s+/g, '_')}_schedule.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const isEditable = currentUser.role === 'admin' || currentUser.role === 'manager';

  // Group matches by round for bracket view
  const r16Matches = matches.filter(m => m.round === 'Round of 16');
  const qfMatches = matches.filter(m => m.round === 'Quarter Finals');
  const sfMatches = matches.filter(m => m.round === 'Semi Finals');
  const thirdMatch = matches.find(m => m.round === 'Third Place');
  const finalMatch = matches.find(m => m.round === 'Final');

  if (!activeTournament) {
    return (
      <div className="p-12 text-center" id="fixtures-unselected">
        <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">No Active Tournament Selected</h2>
        <p className="text-slate-400 mt-2 max-w-sm mx-auto">Please select a tournament under the Tournaments directory to display the bracket hierarchy.</p>
      </div>
    );
  }

  // Bracket Match Box Render helper
  const renderBracketMatch = (match: Match | undefined) => {
    if (!match) {
      return (
        <div className="p-4 bg-slate-900/30 border border-white/5 rounded-xl text-xs font-mono text-slate-600 text-center uppercase tracking-wider">
          MATCH RESERVED
        </div>
      );
    }

    const homeTeam = teams.find(t => t.id === match.homeTeamId);
    const awayTeam = teams.find(t => t.id === match.awayTeamId);

    const isLive = match.status === 'Live';
    const isFinished = match.status === 'Finished';

    return (
      <div 
        id={`bracket-match-box-${match.matchNumber}`}
        className={`p-3 bg-slate-900/90 border rounded-xl space-y-2.5 transition duration-300 relative group ${
          isLive ? 'border-yellow-500/50 animate-glow' : 'border-white/10 hover:border-white/25'
        }`}
      >
        {/* Match Header Info */}
        <div className="flex justify-between items-center text-[9px] font-mono text-slate-500">
          <span>MATCH #{match.matchNumber}</span>
          <span className={`px-1.5 py-0.5 rounded uppercase font-bold ${
            isLive ? 'bg-red-500/10 text-red-500' : isFinished ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-slate-400'
          }`}>
            {match.status}
          </span>
        </div>

        {/* Teams details */}
        <div className="space-y-1.5">
          {/* Home */}
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center space-x-2 truncate">
              {homeTeam && homeTeam.logo ? (
                <img src={homeTeam.logo} alt={homeTeam.name} className="w-4.5 h-4.5 object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-4.5 h-4.5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-mono text-[8px] text-slate-500">?</div>
              )}
              <span className={`font-semibold truncate max-w-[100px] ${
                isFinished && match.winnerId !== match.homeTeamId ? 'text-slate-500 line-through' : 'text-slate-200'
              }`}>
                {match.homeTeamName || 'TBD Winner'}
              </span>
            </div>
            {isFinished || isLive ? (
              <span className={`font-mono font-extrabold text-sm ${
                isFinished && match.winnerId === match.homeTeamId ? 'text-yellow-400 text-glow' : 'text-slate-300'
              }`}>
                {match.score.home}
              </span>
            ) : null}
          </div>

          {/* Away */}
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center space-x-2 truncate">
              {awayTeam && awayTeam.logo ? (
                <img src={awayTeam.logo} alt={awayTeam.name} className="w-4.5 h-4.5 object-contain" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-4.5 h-4.5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-mono text-[8px] text-slate-500">?</div>
              )}
              <span className={`font-semibold truncate max-w-[100px] ${
                isFinished && match.winnerId !== match.awayTeamId ? 'text-slate-500 line-through' : 'text-slate-200'
              }`}>
                {match.awayTeamName || 'TBD Winner'}
              </span>
            </div>
            {isFinished || isLive ? (
              <span className={`font-mono font-extrabold text-sm ${
                isFinished && match.winnerId === match.awayTeamId ? 'text-yellow-400 text-glow' : 'text-slate-300'
              }`}>
                {match.score.away}
              </span>
            ) : null}
          </div>
        </div>

        {/* Floating actions */}
        {(currentUser.role !== 'viewer') && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition duration-300">
            <button
              onClick={() => onSelectMatchToControl(match.id)}
              className="w-full text-center py-1 bg-yellow-500 hover:bg-yellow-400 text-slate-950 rounded-lg text-[10px] font-bold flex items-center justify-center space-x-1"
              id={`bracket-control-btn-${match.matchNumber}`}
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>Broadcast console</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8 p-6" id="fixture-manager-container">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4" id="fixtures-header">
        <div className="flex items-center space-x-3">
          <Calendar className="w-8 h-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-display font-extrabold text-white">CHAMPIONSHIP FIXTURES & BRACKET</h1>
            <p className="text-sm text-slate-400">View matches scheduling lists and progress winners dynamically across the knockout system.</p>
          </div>
        </div>

        {matches.length > 0 && (
          <div className="flex items-center bg-white/5 border border-white/10 p-1.5 rounded-xl shrink-0" id="view-mode-toggle">
            <button
              onClick={() => setViewMode('bracket')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'bracket' ? 'bg-yellow-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
              id="btn-bracket-view"
            >
              Bracket
            </button>
            <button
              onClick={() => setViewMode('schedule')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === 'schedule' ? 'bg-yellow-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
              id="btn-schedule-view"
            >
              List Schedule
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-24 text-center text-slate-400 font-mono tracking-wider text-sm" id="fixtures-loading">
          RETRIEVING TOURNAMENT SCHEDULE RECORDS...
        </div>
      ) : matches.length === 0 ? (
        <div className="glass-panel rounded-2xl py-20 text-center border border-white/5" id="fixtures-empty-state">
          <ShieldAlert className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white">Championship Fixtures Not Generated</h2>
          <p className="text-slate-400 mt-2 max-w-sm mx-auto">First complete assigning all 16 teams inside the "Group Draw" tab, and then click "Generate Fixtures".</p>
        </div>
      ) : (
        <>
          {/* visual BRACKET View */}
          {viewMode === 'bracket' && (
            <div className="overflow-x-auto pb-4 cursor-grab active:cursor-grabbing" id="bracket-scroller">
              <div className="min-w-[1100px] grid grid-cols-5 gap-8 py-4 items-center relative" id="bracket-canvas">
                {/* Round of 16 */}
                <div className="space-y-6" id="bracket-col-r16">
                  <h3 className="text-xs font-mono font-extrabold tracking-widest text-slate-400 uppercase border-b border-white/5 pb-2">ROUND OF 16</h3>
                  <div className="space-y-4">
                    {r16Matches.slice(0, 4).map(m => renderBracketMatch(m))}
                  </div>
                  <div className="space-y-4">
                    {r16Matches.slice(4, 8).map(m => renderBracketMatch(m))}
                  </div>
                </div>

                {/* Quarter Finals */}
                <div className="space-y-16" id="bracket-col-qf">
                  <h3 className="text-xs font-mono font-extrabold tracking-widest text-slate-400 uppercase border-b border-white/5 pb-2">QUARTER FINALS</h3>
                  <div className="space-y-16">
                    {renderBracketMatch(qfMatches[0])}
                    {renderBracketMatch(qfMatches[1])}
                    {renderBracketMatch(qfMatches[2])}
                    {renderBracketMatch(qfMatches[3])}
                  </div>
                </div>

                {/* Semi Finals */}
                <div className="space-y-36" id="bracket-col-sf">
                  <h3 className="text-xs font-mono font-extrabold tracking-widest text-slate-400 uppercase border-b border-white/5 pb-2">SEMI FINALS</h3>
                  <div className="space-y-32">
                    {renderBracketMatch(sfMatches[0])}
                    {renderBracketMatch(sfMatches[1])}
                  </div>
                </div>

                {/* Finals & Third Place */}
                <div className="space-y-24" id="bracket-col-finals">
                  <h3 className="text-xs font-mono font-extrabold tracking-widest text-slate-400 uppercase border-b border-white/5 pb-2">FINALS & CHAMPION</h3>
                  
                  {/* Third Place */}
                  <div className="space-y-3">
                    <div className="text-[10px] font-mono tracking-wider text-slate-500 uppercase">THIRD PLACE PLAYOFF</div>
                    {renderBracketMatch(thirdMatch)}
                  </div>

                  {/* Championship final */}
                  <div className="space-y-3">
                    <div className="text-[10px] font-mono tracking-widest text-yellow-500 uppercase">THE CHAMPIONSHIP FINAL</div>
                    {renderBracketMatch(finalMatch)}
                  </div>
                </div>

                {/* Champions podium */}
                <div className="flex flex-col items-center justify-center space-y-6" id="bracket-col-champion">
                  <h3 className="text-xs font-mono font-extrabold tracking-widest text-slate-400 uppercase border-b border-white/5 pb-2 w-full text-center">TOURNAMENT CHAMPION</h3>
                  
                  {finalMatch && finalMatch.status === 'Finished' && finalMatch.winnerId ? (
                    <div className="p-6 glass-panel-gold rounded-2xl flex flex-col items-center text-center space-y-4 border-yellow-500 animate-glow w-full max-w-[200px]" id="podium-card">
                      <Award className="w-14 h-14 text-yellow-400 text-glow" />
                      <div>
                        <div className="text-[10px] font-mono text-yellow-500 tracking-wider">WINNER</div>
                        <h4 className="font-display font-extrabold text-lg text-white mt-1">
                          {finalMatch.winnerId === finalMatch.homeTeamId ? finalMatch.homeTeamName : finalMatch.awayTeamName}
                        </h4>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-900/40 border border-dashed border-white/10 rounded-2xl flex flex-col items-center text-center space-y-3 text-slate-500 w-full max-w-[200px]" id="podium-card-placeholder">
                      <Award className="w-12 h-12 text-slate-700" />
                      <span className="text-xs font-mono">CHAMPION PENDING</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SCHEDULE LIST View */}
          {viewMode === 'schedule' && (
            <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-4" id="schedule-list-panel">
              <div className="flex justify-between items-center pb-2 border-b border-white/10 shrink-0">
                <span className="text-sm font-mono text-slate-400">{matches.length} total matches</span>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2 px-4 text-xs font-semibold text-slate-300 transition"
                  id="btn-export-schedule-csv"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-500" />
                  <span>Export CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto" id="schedule-table-scroller">
                <table className="w-full text-left border-collapse" id="schedule-table">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] font-mono tracking-widest text-slate-500 uppercase">
                      <th className="pb-3">No.</th>
                      <th className="pb-3">Round</th>
                      <th className="pb-3">Home Team</th>
                      <th className="pb-3 text-center">Score</th>
                      <th className="pb-3">Away Team</th>
                      <th className="pb-3">Date / Time</th>
                      <th className="pb-3">Venue</th>
                      <th className="pb-3">Referee</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {matches.map((m) => (
                      <tr key={m.id} className="hover:bg-white/[0.01] transition" id={`schedule-row-${m.matchNumber}`}>
                        <td className="py-3.5 font-mono text-yellow-500 font-bold">#{m.matchNumber}</td>
                        <td className="py-3.5">
                          <span className="text-xs font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-slate-300">
                            {m.round}
                          </span>
                        </td>
                        <td className="py-3.5 font-semibold text-slate-200">{m.homeTeamName || 'TBD Winner'}</td>
                        <td className="py-3.5 text-center font-mono font-extrabold text-sm text-yellow-400">
                          {m.status === 'Finished' || m.status === 'Live' ? `${m.score.home} - ${m.score.away}` : 'vs'}
                        </td>
                        <td className="py-3.5 font-semibold text-slate-200">{m.awayTeamName || 'TBD Winner'}</td>
                        <td className="py-3.5 text-xs text-slate-400 font-mono">
                          {m.date} • {m.kickoffTime}
                        </td>
                        <td className="py-3.5 text-xs text-slate-400">{m.venue}</td>
                        <td className="py-3.5 text-xs">
                          {assigningMatchId === m.id ? (
                            <div className="flex items-center space-x-1" id="assign-referee-input-group">
                              <input
                                type="text"
                                value={tempReferee}
                                onChange={(e) => setTempReferee(e.target.value)}
                                className="bg-slate-900 border border-white/15 rounded px-2 py-0.5 text-xs text-white outline-none w-28"
                                placeholder="Referee Name"
                                id="referee-temp-input"
                              />
                              <button
                                onClick={() => handleAssignReferee(m.id)}
                                className="px-2 py-0.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded text-[10px]"
                                id="referee-save-btn"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <span className="text-slate-300">{m.referee || 'Unassigned'}</span>
                              {isEditable && (
                                <button
                                  onClick={() => { setAssigningMatchId(m.id); setTempReferee(m.referee); }}
                                  className="text-[10px] text-yellow-500 hover:underline"
                                  id="referee-edit-btn"
                                >
                                  Assign
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {isEditable && (
                              <button
                                onClick={() => handleLockFixture(m.id, !m.locked)}
                                className="p-1.5 bg-white/5 border border-white/10 rounded-lg text-slate-400 hover:text-white transition"
                                title={m.locked ? "Unlock Fixture" : "Lock Fixture"}
                                id={`lock-btn-${m.matchNumber}`}
                              >
                                {m.locked ? <Lock className="w-3.5 h-3.5 text-yellow-500" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            
                            {(currentUser.role !== 'viewer') && (
                              <button
                                onClick={() => onSelectMatchToControl(m.id)}
                                className="px-3 py-1 bg-yellow-500 hover:bg-yellow-400 text-slate-950 rounded-lg text-xs font-bold transition flex items-center space-x-1"
                                id={`row-control-btn-${m.matchNumber}`}
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>Control</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
