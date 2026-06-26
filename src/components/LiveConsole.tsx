import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, setDoc, query, collection, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Match, Team, MatchEvent, UserProfile } from '../types';
import { Play, Pause, RotateCcw, AlertTriangle, Radio, Shield, HelpCircle, Trophy, RefreshCw, Send, Check } from 'lucide-react';

interface LiveConsoleProps {
  currentUser: UserProfile;
  matchId: string;
  onBackToBracket: () => void;
}

export default function LiveConsole({ currentUser, matchId, onBackToBracket }: LiveConsoleProps) {
  const [match, setMatch] = useState<Match | null>(null);
  const [homeTeam, setHomeTeam] = useState<Team | null>(null);
  const [awayTeam, setAwayTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  // Stats input state
  const [possessionHome, setPossessionHome] = useState(50);
  const [shotsHome, setShotsHome] = useState(0);
  const [shotsAway, setShotsAway] = useState(0);
  const [cornersHome, setCornersHome] = useState(0);
  const [cornersAway, setCornersAway] = useState(0);

  // New Event Builder states
  const [eventType, setEventType] = useState<'goal' | 'yellow_card' | 'red_card' | 'substitution'>('goal');
  const [eventTeamId, setEventTeamId] = useState('');
  const [eventMinute, setEventMinute] = useState<number>(0);
  const [selectedPlayerName, setSelectedPlayerName] = useState('');
  const [selectedPlayerOutName, setSelectedPlayerOutName] = useState('');

  // Timer Interval Reference
  const [timeState, setTimeState] = useState({ elapsedSeconds: 0, isRunning: false });

  // Load match and teams
  const fetchMatchDetails = async () => {
    setLoading(true);
    try {
      const matchDoc = await getDoc(doc(db, 'fixtures', matchId));
      if (matchDoc.exists()) {
        const mData = matchDoc.data() as Match;
        setMatch(mData);

        // Fetch team details
        if (mData.homeTeamId && !mData.homeTeamId.includes('Winner') && !mData.homeTeamId.includes('Loser')) {
          const homeDoc = await getDoc(doc(db, 'teams', mData.homeTeamId));
          if (homeDoc.exists()) setHomeTeam(homeDoc.data() as Team);
        }
        if (mData.awayTeamId && !mData.awayTeamId.includes('Winner') && !mData.awayTeamId.includes('Loser')) {
          const awayDoc = await getDoc(doc(db, 'teams', mData.awayTeamId));
          if (awayDoc.exists()) setAwayTeam(awayDoc.data() as Team);
        }

        // Initialize state
        setPossessionHome(mData.stats?.possession?.home || 50);
        setShotsHome(mData.stats?.shots?.home || 0);
        setShotsAway(mData.stats?.shots?.away || 0);
        setCornersHome(mData.stats?.corners?.home || 0);
        setCornersAway(mData.stats?.corners?.away || 0);
        setTimeState({
          elapsedSeconds: mData.timer?.elapsedSeconds || 0,
          isRunning: mData.timer?.isRunning || false
        });
        setEventTeamId(mData.homeTeamId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchDetails();
  }, [matchId]);

  // Handle active countdown / countup timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timeState.isRunning) {
      interval = setInterval(() => {
        setTimeState(prev => {
          const nextSeconds = prev.elapsedSeconds + 1;
          // Sync to Firestore every 10 seconds to reduce write quotas, but maintain accurate state
          if (nextSeconds % 10 === 0 && match) {
            updateDoc(doc(db, 'fixtures', matchId), {
              'timer.elapsedSeconds': nextSeconds,
              'timer.lastUpdated': new Date().toISOString()
            });
          }
          return { ...prev, elapsedSeconds: nextSeconds };
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeState.isRunning, matchId, match]);

  const handleToggleTimer = async () => {
    if (!match) return;
    const isRunning = !timeState.isRunning;
    setTimeState(prev => ({ ...prev, isRunning }));
    
    await updateDoc(doc(db, 'fixtures', matchId), {
      'timer.isRunning': isRunning,
      'timer.elapsedSeconds': timeState.elapsedSeconds,
      'timer.lastUpdated': new Date().toISOString()
    });
  };

  const handleResetTimer = async () => {
    if (!match || !window.confirm('Reset timer to 00:00?')) return;
    setTimeState({ elapsedSeconds: 0, isRunning: false });
    await updateDoc(doc(db, 'fixtures', matchId), {
      'timer.isRunning': false,
      'timer.elapsedSeconds': 0,
      'timer.lastUpdated': new Date().toISOString()
    });
  };

  const handleIncrementScore = async (team: 'home' | 'away', amount: number) => {
    if (!match) return;
    const currentScore = { ...match.score };
    currentScore[team] = Math.max(0, currentScore[team] + amount);

    await updateDoc(doc(db, 'fixtures', matchId), { score: currentScore });
    setMatch({ ...match, score: currentScore });
  };

  const handleToggleHalf = async () => {
    if (!match) return;
    const nextHalf = match.timer.half === 1 ? 2 : 1;
    // Set timer start point according to half
    const nextSeconds = nextHalf === 2 ? 45 * 60 : 0;
    
    setTimeState({ elapsedSeconds: nextSeconds, isRunning: false });
    await updateDoc(doc(db, 'fixtures', matchId), {
      'timer.half': nextHalf,
      'timer.elapsedSeconds': nextSeconds,
      'timer.isRunning': false,
      'timer.lastUpdated': new Date().toISOString()
    });
    setMatch({
      ...match,
      timer: { ...match.timer, half: nextHalf, elapsedSeconds: nextSeconds, isRunning: false }
    });
  };

  const handleAddEvent = async () => {
    if (!match || !selectedPlayerName) return;

    const newEvent: MatchEvent = {
      id: `event_${Date.now()}`,
      type: eventType,
      minute: eventMinute || Math.floor(timeState.elapsedSeconds / 60) || 1,
      teamId: eventTeamId,
      playerName: selectedPlayerName,
      ...(eventType === 'substitution' && { playerNameOut: selectedPlayerOutName })
    };

    const updatedEvents = [...(match.events || []), newEvent];
    let updatedScore = { ...match.score };

    // Auto increment score on goal
    if (eventType === 'goal') {
      if (eventTeamId === match.homeTeamId) {
        updatedScore.home += 1;
      } else {
        updatedScore.away += 1;
      }
    }

    await updateDoc(doc(db, 'fixtures', matchId), {
      events: updatedEvents,
      score: updatedScore
    });

    // Update state
    setMatch({ ...match, events: updatedEvents, score: updatedScore });

    // Send instant Overlay Broadcast command to OBS!
    await triggerBroadcastOverlay(eventType, {
      teamId: eventTeamId,
      playerName: selectedPlayerName,
      playerNameOut: selectedPlayerOutName,
      minute: newEvent.minute
    });

    // Reset inputs
    setSelectedPlayerName('');
    setSelectedPlayerOutName('');
  };

  const handleRemoveEvent = async (id: string) => {
    if (!match || !window.confirm('Are you sure you want to delete this event?')) return;
    const ev = match.events.find(e => e.id === id);
    let updatedScore = { ...match.score };

    if (ev && ev.type === 'goal') {
      if (ev.teamId === match.homeTeamId) {
        updatedScore.home = Math.max(0, updatedScore.home - 1);
      } else {
        updatedScore.away = Math.max(0, updatedScore.away - 1);
      }
    }

    const updatedEvents = match.events.filter(e => e.id !== id);
    await updateDoc(doc(db, 'fixtures', matchId), {
      events: updatedEvents,
      score: updatedScore
    });
    setMatch({ ...match, events: updatedEvents, score: updatedScore });
  };

  const handleUpdateStats = async () => {
    if (!match) return;
    const statsObj = {
      possession: { home: possessionHome, away: 100 - possessionHome },
      shots: { home: shotsHome, away: shotsAway },
      corners: { home: cornersHome, away: cornersAway }
    };

    await updateDoc(doc(db, 'fixtures', matchId), { stats: statsObj });
    setMatch({ ...match, stats: statsObj });
    alert('Stats updated and broadcasted successfully!');
  };

  // OBS triggers helper
  const triggerBroadcastOverlay = async (overlayName: string, alertDetails?: any) => {
    try {
      await setDoc(doc(db, 'graphics', 'overlay_control'), {
        activeOverlay: overlayName,
        activeMatchId: matchId,
        alertDetails: alertDetails || null,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
    }
  };

  // End match and advance teams automatically
  const handleEndMatchAndAdvance = async () => {
    if (!match) return;

    if (match.score.home === match.score.away) {
      const manualWinner = window.prompt(
        `Championship knockout matches cannot end in a draw! Enter "H" if Home team won on Penalties, or "A" if Away team won:`,
        "H"
      );
      if (!manualWinner || (manualWinner.toUpperCase() !== 'H' && manualWinner.toUpperCase() !== 'A')) {
        alert("Must specify a penalty shoot-out winner to end match.");
        return;
      }
      const winnerId = manualWinner.toUpperCase() === 'H' ? match.homeTeamId : match.awayTeamId;
      await endAndAdvance(winnerId);
    } else {
      const winnerId = match.score.home > match.score.away ? match.homeTeamId : match.awayTeamId;
      await endAndAdvance(winnerId);
    }
  };

  const endAndAdvance = async (winnerId: string) => {
    if (!match) return;
    try {
      const loserId = winnerId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;

      // Update current match status to Finished
      await updateDoc(doc(db, 'fixtures', matchId), {
        status: 'Finished',
        winnerId,
        'timer.isRunning': false
      });

      // Advance brackets
      await propagateWinnerBracket(match.matchNumber, winnerId, loserId);

      // Audit Log
      const logId = `log_${Date.now()}`;
      await setDoc(doc(db, 'system_logs', logId), {
        id: logId,
        userId: currentUser.uid,
        userName: currentUser.fullName,
        action: `Finished Match #${match.matchNumber}. Winner advanced: ${
          winnerId === match.homeTeamId ? match.homeTeamName : match.awayTeamName
        }`,
        timestamp: new Date().toISOString()
      });

      alert('Match completed! Winners advanced.');
      onBackToBracket();
    } catch (err) {
      console.error(err);
      alert('Error advancing teams.');
    }
  };

  // Core Progression Algorithm
  const propagateWinnerBracket = async (matchNum: number, winnerId: string, loserId: string) => {
    // Locate the winner team details
    const winTeamDoc = await getDoc(doc(db, 'teams', winnerId));
    const winTeam = winTeamDoc.exists() ? winTeamDoc.data() : null;
    if (!winTeam) return;

    const loseTeamDoc = await getDoc(doc(db, 'teams', loserId));
    const loseTeam = loseTeamDoc.exists() ? loseTeamDoc.data() : null;

    let targetMatchNum = 0;
    let slotType: 'home' | 'away' = 'home';

    // R16 (1-8) -> QF (9-12)
    if (matchNum === 1) { targetMatchNum = 9; slotType = 'home'; }
    if (matchNum === 3) { targetMatchNum = 9; slotType = 'away'; }
    
    if (matchNum === 2) { targetMatchNum = 10; slotType = 'home'; }
    if (matchNum === 4) { targetMatchNum = 10; slotType = 'away'; }

    if (matchNum === 5) { targetMatchNum = 11; slotType = 'home'; }
    if (matchNum === 7) { targetMatchNum = 11; slotType = 'away'; }

    if (matchNum === 6) { targetMatchNum = 12; slotType = 'home'; }
    if (matchNum === 8) { targetMatchNum = 12; slotType = 'away'; }

    // QF (9-12) -> SF (13-14)
    if (matchNum === 9) { targetMatchNum = 13; slotType = 'home'; }
    if (matchNum === 11) { targetMatchNum = 13; slotType = 'away'; }

    if (matchNum === 10) { targetMatchNum = 14; slotType = 'home'; }
    if (matchNum === 12) { targetMatchNum = 14; slotType = 'away'; }

    // SF (13-14) -> Finals (15-16)
    // Losers play 3rd Place Match #15, Winners play Final Match #16
    if (matchNum === 13) {
      // Propagate Loser SF1 to Match 15 (Home)
      if (loseTeam) {
        await updateMatchSlot(15, 'home', loserId, loseTeam.name, loseTeam.shortName, loseTeam.logo);
      }
      // Propagate Winner SF1 to Match 16 (Home)
      targetMatchNum = 16; slotType = 'home';
    }
    if (matchNum === 14) {
      // Propagate Loser SF2 to Match 15 (Away)
      if (loseTeam) {
        await updateMatchSlot(15, 'away', loserId, loseTeam.name, loseTeam.shortName, loseTeam.logo);
      }
      // Propagate Winner SF2 to Match 16 (Away)
      targetMatchNum = 16; slotType = 'away';
    }

    if (targetMatchNum > 0) {
      await updateMatchSlot(targetMatchNum, slotType, winnerId, winTeam.name, winTeam.shortName, winTeam.logo);
    }
  };

  const updateMatchSlot = async (mNum: number, slot: 'home' | 'away', teamId: string, name: string, short: string, logo: string) => {
    const matchIdToUpdate = `match_${mNum}_${match?.tournamentId}`;
    const updateObj: any = {};
    if (slot === 'home') {
      updateObj.homeTeamId = teamId;
      updateObj.homeTeamName = name;
      updateObj.homeTeamShortName = short;
      updateObj.homeTeamLogo = logo;
    } else {
      updateObj.awayTeamId = teamId;
      updateObj.awayTeamName = name;
      updateObj.awayTeamShortName = short;
      updateObj.awayTeamLogo = logo;
    }
    await updateDoc(doc(db, 'fixtures', matchIdToUpdate), updateObj);
  };

  // Format digital seconds to MM:SS
  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = (seconds % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 font-mono tracking-wider text-sm" id="live-console-loading">
        LOADING LIVE MATCH STREAM CONSOLE...
      </div>
    );
  }

  if (!match) return null;

  const currentHomeRoster = homeTeam?.players || [];
  const currentAwayRoster = awayTeam?.players || [];
  const activeRoster = eventTeamId === match.homeTeamId ? currentHomeRoster : currentAwayRoster;

  return (
    <div className="space-y-8 p-6" id="live-console-wrapper">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" id="lc-header">
        <div className="flex items-center space-x-3">
          <div className="w-3 h-3 bg-red-600 rounded-full animate-ping shrink-0" />
          <div>
            <h1 className="text-2xl font-display font-extrabold text-white">LIVE MATCH CONTROL ROOM</h1>
            <p className="text-sm text-slate-400">Stream deck dashboard for scores, timing, events, and instant OBS overlays triggers.</p>
          </div>
        </div>

        <button
          onClick={onBackToBracket}
          className="bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 py-2 px-4 rounded-xl text-xs font-semibold transition"
          id="btn-back-to-bracket"
        >
          Return to Schedule
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8" id="lc-bento-grid">
        {/* SCOREBOARD CARD (Interactive) */}
        <div className="xl:col-span-2 glass-panel rounded-2xl p-6 sm:p-8 border border-white/10 space-y-8 flex flex-col justify-between" id="lc-scoreboard-card">
          {/* Match meta */}
          <div className="flex justify-between items-center text-xs text-slate-400 font-mono border-b border-white/5 pb-4">
            <span className="uppercase text-yellow-500 font-bold">{match.round} • Match #{match.matchNumber}</span>
            <span>{match.venue}</span>
          </div>

          {/* Interactive Score controller */}
          <div className="flex items-center justify-between py-6" id="score-counter-widget">
            {/* Home */}
            <div className="flex flex-col items-center space-y-4 w-5/12 text-center" id="home-score-ctrl">
              {match.homeTeamLogo ? (
                <img src={match.homeTeamLogo} alt={match.homeTeamName} className="w-16 h-16 object-contain bg-white/5 rounded-xl p-1" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-xl p-1 flex items-center justify-center font-display font-extrabold text-slate-500 text-lg">
                  {match.homeTeamShortName || "H"}
                </div>
              )}
              <h3 className="font-display font-extrabold text-base text-white truncate max-w-full">{match.homeTeamName}</h3>
              
              {match.status !== 'Finished' && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleIncrementScore('home', -1)}
                    className="w-10 h-10 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg flex items-center justify-center font-bold font-mono transition text-lg"
                    id="btn-dec-home"
                  >
                    -
                  </button>
                  <button
                    onClick={() => handleIncrementScore('home', 1)}
                    className="w-10 h-10 bg-yellow-500 hover:bg-yellow-400 text-slate-950 rounded-lg flex items-center justify-center font-bold font-mono transition text-lg"
                    id="btn-inc-home"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            {/* Display Big Numbers */}
            <div className="flex flex-col items-center justify-center w-2/12" id="score-timer-center">
              <div className="text-5xl sm:text-6xl font-mono font-extrabold text-yellow-400 text-glow flex items-center space-x-3">
                <span>{match.score.home}</span>
                <span className="text-slate-600 text-3xl font-sans">-</span>
                <span>{match.score.away}</span>
              </div>
              <span className="text-xs px-2.5 py-0.5 bg-white/5 text-slate-400 border border-white/5 rounded-full font-mono uppercase mt-4">
                {match.timer.half === 1 ? '1st Half' : '2nd Half'}
              </span>
            </div>

            {/* Away */}
            <div className="flex flex-col items-center space-y-4 w-5/12 text-center" id="away-score-ctrl">
              {match.awayTeamLogo ? (
                <img src={match.awayTeamLogo} alt={match.awayTeamName} className="w-16 h-16 object-contain bg-white/5 rounded-xl p-1" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-xl p-1 flex items-center justify-center font-display font-extrabold text-slate-500 text-lg">
                  {match.awayTeamShortName || "A"}
                </div>
              )}
              <h3 className="font-display font-extrabold text-base text-white truncate max-w-full">{match.awayTeamName}</h3>
              
              {match.status !== 'Finished' && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleIncrementScore('away', -1)}
                    className="w-10 h-10 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg flex items-center justify-center font-bold font-mono transition text-lg"
                    id="btn-dec-away"
                  >
                    -
                  </button>
                  <button
                    onClick={() => handleIncrementScore('away', 1)}
                    className="w-10 h-10 bg-yellow-500 hover:bg-yellow-400 text-slate-950 rounded-lg flex items-center justify-center font-bold font-mono transition text-lg"
                    id="btn-inc-away"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* TIMER CONSOLE */}
          {match.status !== 'Finished' && (
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0" id="lc-timer-console">
              <div className="flex items-center space-x-4">
                <div className="text-3xl font-mono font-bold text-slate-200 tracking-wider">
                  {formatTime(timeState.elapsedSeconds)}
                </div>
                <span className="text-xs text-slate-500 font-mono">COUNT-UP TIMER</span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleToggleTimer}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                    timeState.isRunning 
                      ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                      : 'bg-green-600 hover:bg-green-500 text-white'
                  }`}
                  id="btn-timer-toggle"
                >
                  {timeState.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{timeState.isRunning ? 'Pause Timer' : 'Start Timer'}</span>
                </button>

                <button
                  onClick={handleResetTimer}
                  className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl transition"
                  title="Reset Timer"
                  id="btn-timer-reset"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={handleToggleHalf}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs font-semibold transition"
                  id="btn-toggle-half"
                >
                  Switch to {match.timer.half === 1 ? '2nd' : '1st'} Half
                </button>
              </div>
            </div>
          )}

          {/* End Match option */}
          {match.status !== 'Finished' && (
            <button
              onClick={handleEndMatchAndAdvance}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-extrabold py-3 px-4 rounded-xl transition duration-300 flex items-center justify-center space-x-2 shrink-0 shadow-lg"
              id="btn-end-match-advance"
            >
              <Trophy className="w-4 h-4" />
              <span>Full-Time: Finalize Score & Advance Winner</span>
            </button>
          )}

          {match.status === 'Finished' && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-center text-sm font-semibold flex items-center justify-center space-x-2" id="finished-match-indicator">
              <Check className="w-5 h-5 text-green-500" />
              <span>MATCH FINISHED AND ADVANCED. OPERATOR CONTROL LOCKED.</span>
            </div>
          )}
        </div>

        {/* BROADCAST overlay controllers */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-6 flex flex-col" id="lc-broadcast-panel">
          <div className="flex items-center space-x-2 shrink-0 pb-3 border-b border-white/5">
            <Radio className="w-5 h-5 text-yellow-500" />
            <h2 className="text-base font-bold text-white uppercase">OBS Broadcast Controls</h2>
          </div>

          <div className="space-y-4 flex-1 overflow-y-auto" id="broadcast-triggers">
            {/* Dashboard screens */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Static Broadcast Screens</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => triggerBroadcastOverlay('intro')}
                  className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-200 transition text-left"
                  id="overlay-intro-btn"
                >
                  🎥 Match Intro
                </button>
                <button
                  onClick={() => triggerBroadcastOverlay('sponsor')}
                  className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-200 transition text-left"
                  id="overlay-sponsor-btn"
                >
                  ⭐ Sponsor Logo
                </button>
                <button
                  onClick={() => triggerBroadcastOverlay('group_draw')}
                  className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-200 transition text-left"
                  id="overlay-draw-btn"
                >
                  📊 Group Seeding
                </button>
                <button
                  onClick={() => triggerBroadcastOverlay('next_match')}
                  className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-200 transition text-left"
                  id="overlay-next-btn"
                >
                  📅 Next Match
                </button>
              </div>
            </div>

            {/* Scoreboard trigger */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Active Scoreboard overlays</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => triggerBroadcastOverlay('match_scoreboard')}
                  className="py-2.5 px-3 bg-yellow-500/10 hover:bg-yellow-500/15 border border-yellow-500/25 rounded-xl text-xs text-yellow-400 transition text-left font-semibold"
                  id="overlay-score-btn"
                >
                  ⏱️ Live Score Bar
                </button>
                <button
                  onClick={() => triggerBroadcastOverlay('half_time')}
                  className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-200 transition text-left"
                  id="overlay-halftime-btn"
                >
                  ⏸️ Halftime Stats
                </button>
                <button
                  onClick={() => triggerBroadcastOverlay('full_time')}
                  className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-200 transition text-left"
                  id="overlay-fulltime-btn"
                >
                  🏁 Fulltime Stats
                </button>
                <button
                  onClick={() => triggerBroadcastOverlay('champion_celebration')}
                  className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-200 transition text-left"
                  id="overlay-champion-celebration-btn"
                >
                  🏆 Champions Podium
                </button>
              </div>
            </div>

            {/* Close Overlay */}
            <button
              onClick={() => triggerBroadcastOverlay('none')}
              className="w-full py-2 bg-red-600/10 hover:bg-red-600/15 border border-red-500/20 rounded-xl text-xs text-red-400 font-bold tracking-wider transition uppercase"
              id="overlay-clear-btn"
            >
              ❌ Clear Overlay Graphics
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8" id="lc-lower-grid">
        {/* EVENT LOGGER & BUILDER */}
        <div className="xl:col-span-2 glass-panel rounded-2xl p-6 border border-white/10 space-y-6" id="lc-events-manager">
          <div className="flex items-center space-x-2 pb-3 border-b border-white/5 shrink-0">
            <Radio className="w-5 h-5 text-yellow-500" />
            <h2 className="text-base font-bold text-white uppercase">Register Live Match Events</h2>
          </div>

          {match.status !== 'Finished' ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="event-builder-widget">
              {/* Type select */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono tracking-wider text-slate-400">EVENT TYPE</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none"
                  id="event-type-select"
                >
                  <option value="goal">Goal ⚽</option>
                  <option value="yellow_card">Yellow Card 🟨</option>
                  <option value="red_card">Red Card 🟥</option>
                  <option value="substitution">Substitution 🔄</option>
                </select>
              </div>

              {/* Team select */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono tracking-wider text-slate-400">TEAM AFFECTED</label>
                <select
                  value={eventTeamId}
                  onChange={(e) => setEventTeamId(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none"
                  id="event-team-select"
                >
                  <option value={match.homeTeamId}>Home: {match.homeTeamShortName}</option>
                  <option value={match.awayTeamId}>Away: {match.awayTeamShortName}</option>
                </select>
              </div>

              {/* Player / Details */}
              <div className="col-span-1 md:col-span-2 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono tracking-wider text-slate-400">
                      {eventType === 'substitution' ? 'PLAYER ENTERING' : 'PLAYER NAME'}
                    </label>
                    {activeRoster.length > 0 ? (
                      <select
                        value={selectedPlayerName}
                        onChange={(e) => setSelectedPlayerName(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none"
                        id="event-player-select"
                      >
                        <option value="">Select Player</option>
                        {activeRoster.map(p => (
                          <option key={p.id} value={p.name}>#{p.number} - {p.name} [{p.position}]</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={selectedPlayerName}
                        onChange={(e) => setSelectedPlayerName(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none"
                        placeholder="Type player name"
                        id="event-player-manual-input"
                      />
                    )}
                  </div>

                  {eventType === 'substitution' && (
                    <div className="space-y-1.5" id="sub-player-out-field">
                      <label className="text-[10px] font-mono tracking-wider text-slate-400">PLAYER EXITING</label>
                      {activeRoster.length > 0 ? (
                        <select
                          value={selectedPlayerOutName}
                          onChange={(e) => setSelectedPlayerOutName(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none"
                          id="event-player-out-select"
                        >
                          <option value="">Select Player</option>
                          {activeRoster.map(p => (
                            <option key={p.id} value={p.name}>#{p.number} - {p.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={selectedPlayerOutName}
                          onChange={(e) => setSelectedPlayerOutName(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none"
                          placeholder="Type exiting player"
                          id="event-player-out-manual"
                        />
                      )}
                    </div>
                  )}

                  {eventType !== 'substitution' && (
                    <div className="space-y-1.5" id="event-minute-field">
                      <label className="text-[10px] font-mono tracking-wider text-slate-400">MINUTE</label>
                      <input
                        type="number"
                        value={eventMinute || ''}
                        onChange={(e) => setEventMinute(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none"
                        placeholder="Current minute"
                        id="event-minute-input"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleAddEvent}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold py-2 px-4 rounded-xl text-xs transition uppercase tracking-wider flex items-center justify-center space-x-2"
                  id="btn-register-event"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Register & Stream Event Alert</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">Roster details and events are locked for completed matches.</p>
          )}

          {/* Events Log List */}
          <div className="border-t border-white/5 pt-4" id="events-log-list-section">
            <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase block mb-3">Live Match Log</span>
            <div className="space-y-2 h-[200px] overflow-y-auto pr-1" id="match-events-logger">
              {(!match.events || match.events.length === 0) ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">NO LOGGED MATCH EVENTS</div>
              ) : (
                [...match.events].reverse().map((ev) => (
                  <div key={ev.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between text-xs" id={`logged-event-${ev.id}`}>
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-yellow-500 font-bold">{ev.minute}'</span>
                      <span className="text-slate-400">
                        {ev.teamId === match.homeTeamId ? match.homeTeamShortName : match.awayTeamShortName}
                      </span>
                      <div>
                        <span className="font-semibold text-slate-200">
                          {ev.type === 'goal' ? '⚽ GOAL:' : ev.type === 'yellow_card' ? '🟨 YELLOW:' : ev.type === 'red_card' ? '🟥 RED:' : '🔄 SUB:'}
                        </span>
                        <span className="text-slate-300 ml-1.5">
                          {ev.playerName}
                          {ev.playerNameOut && ` for ${ev.playerNameOut}`}
                        </span>
                      </div>
                    </div>
                    {match.status !== 'Finished' && (
                      <button
                        onClick={() => handleRemoveEvent(ev.id)}
                        className="text-[10px] text-red-400 hover:underline px-2 py-0.5 rounded hover:bg-red-500/10"
                        id={`btn-remove-event-${ev.id}`}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* STATISTICS SLIDERS */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-6 flex flex-col justify-between" id="lc-stats-sliders">
          <div className="flex items-center space-x-2 pb-3 border-b border-white/5 shrink-0">
            <Radio className="w-5 h-5 text-yellow-500" />
            <h2 className="text-base font-bold text-white uppercase">Match Stats Sliders</h2>
          </div>

          <div className="space-y-5 flex-1" id="sliders-inputs">
            {/* Possession */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span>{match.homeTeamShortName} Possession ({possessionHome}%)</span>
                <span>{match.awayTeamShortName} Possession ({100 - possessionHome}%)</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                value={possessionHome}
                onChange={(e) => setPossessionHome(Number(e.target.value))}
                className="w-full accent-yellow-500"
                id="possession-range-input"
              />
            </div>

            {/* Shots */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono tracking-wider text-slate-400">{match.homeTeamShortName} SHOTS</label>
                <input
                  type="number"
                  min="0"
                  value={shotsHome}
                  onChange={(e) => setShotsHome(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none"
                  id="shots-home-input"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono tracking-wider text-slate-400">{match.awayTeamShortName} SHOTS</label>
                <input
                  type="number"
                  min="0"
                  value={shotsAway}
                  onChange={(e) => setShotsAway(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none"
                  id="shots-away-input"
                />
              </div>
            </div>

            {/* Corners */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono tracking-wider text-slate-400">{match.homeTeamShortName} CORNERS</label>
                <input
                  type="number"
                  min="0"
                  value={cornersHome}
                  onChange={(e) => setCornersHome(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none"
                  id="corners-home-input"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono tracking-wider text-slate-400">{match.awayTeamShortName} CORNERS</label>
                <input
                  type="number"
                  min="0"
                  value={cornersAway}
                  onChange={(e) => setCornersAway(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none"
                  id="corners-away-input"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleUpdateStats}
            className="w-full mt-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition shrink-0"
            id="btn-save-stats"
          >
            Broadcast Statistics Update
          </button>
        </div>
      </div>
    </div>
  );
}
