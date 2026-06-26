import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Match, Team, GraphicsState, Group } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Calendar, MapPin, Star, Award, Sparkles } from 'lucide-react';

export default function ObsGraphicsOverlay() {
  const [graphicsState, setGraphicsState] = useState<GraphicsState>({
    activeOverlay: 'none',
    activeMatchId: ''
  });
  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [timeStr, setTimeStr] = useState('00:00');

  const demoMatch: Match = {
    id: 'demo',
    tournamentId: 'demo',
    matchNumber: 1,
    round: 'Final',
    date: '2026-06-26',
    kickoffTime: '20:00',
    venue: 'Z-Raff Showcase Arena',
    homeTeamId: 'demo_home',
    homeTeamName: 'Red Devils FC',
    homeTeamShortName: 'RED',
    homeTeamLogo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100&auto=format&fit=crop&q=60',
    awayTeamId: 'demo_away',
    awayTeamName: 'Blue Knights United',
    awayTeamShortName: 'BLU',
    awayTeamLogo: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=100&auto=format&fit=crop&q=60',
    status: 'Live',
    score: { home: 2, away: 1 },
    timer: {
      elapsedSeconds: 2700,
      isRunning: true,
      lastUpdated: new Date().toISOString(),
      half: 1
    },
    stats: {
      possession: { home: 58, away: 42 },
      shots: { home: 12, away: 8 },
      corners: { home: 6, away: 4 }
    },
    events: [
      { id: 'e1', type: 'goal', teamId: 'demo_home', playerName: 'Cristiano Ronaldo', minute: 23 },
      { id: 'e2', type: 'goal', teamId: 'demo_away', playerName: 'Lionel Messi', minute: 34 },
      { id: 'e3', type: 'goal', teamId: 'demo_home', playerName: 'Neymar Jr', minute: 41 }
    ],
    winnerId: 'demo_home',
    referee: 'Howard Webb',
    locked: false
  };

  const displayMatch = match || demoMatch;

  // Load teams once for cached lookup
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const snap = await getDocs(collection(db, 'teams'));
        const list: Team[] = [];
        snap.forEach((d) => list.push(d.data() as Team));
        setTeams(list);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTeams();
  }, []);

  // Listen to Graphics control document in real-time
  useEffect(() => {
    let unsubscribeMatch: (() => void) | null = null;

    const unsubscribe = onSnapshot(doc(db, 'graphics', 'overlay_control'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as GraphicsState;
        setGraphicsState(data);

        // Unsubscribe from previous match listener if any
        if (unsubscribeMatch) {
          unsubscribeMatch();
          unsubscribeMatch = null;
        }

        // Fetch the corresponding active match details in real-time
        if (data.activeMatchId) {
          unsubscribeMatch = onSnapshot(doc(db, 'fixtures', data.activeMatchId), (mSnap) => {
            if (mSnap.exists()) {
              setMatch(mSnap.data() as Match);
            }
          }, (err) => {
            console.error("Match onSnapshot error in overlay:", err);
          });
        }
      }
    }, (err) => {
      console.error("Graphics control onSnapshot error in overlay:", err);
    });

    return () => {
      unsubscribe();
      if (unsubscribeMatch) unsubscribeMatch();
    };
  }, []);

  // Sync Timer string
  useEffect(() => {
    const activeMatchForTimer = match || demoMatch;
    const updateTimeStr = () => {
      let seconds = activeMatchForTimer.timer.elapsedSeconds || 0;
      if (activeMatchForTimer.timer.isRunning) {
        const elapsedSinceUpdate = Math.floor((Date.now() - new Date(activeMatchForTimer.timer.lastUpdated).getTime()) / 1000);
        seconds += Math.max(0, elapsedSinceUpdate);
      }
      const m = Math.floor(seconds / 60).toString().padStart(2, '0');
      const s = (seconds % 60).toString().padStart(2, '0');
      setTimeStr(`${m}:${s}`);
    };

    updateTimeStr();
    let interval: NodeJS.Timeout | null = null;
    if (activeMatchForTimer.timer.isRunning) {
      interval = setInterval(updateTimeStr, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [match]);

  // Timeout auto-close helper for temporary lower third alerts (goal, cards, subs)
  useEffect(() => {
    const tempOverlays = ['goal', 'substitution', 'yellow_card', 'red_card'];
    if (tempOverlays.includes(graphicsState.activeOverlay)) {
      const timer = setTimeout(async () => {
        try {
          await updateDoc(doc(db, 'graphics', 'overlay_control'), {
            activeOverlay: 'match_scoreboard', // Fallback back to normal scoreboard
            alertDetails: null
          });
        } catch (err) {
          console.error(err);
        }
      }, 7000); // Display for 7 seconds
      return () => clearTimeout(timer);
    }
  }, [graphicsState.activeOverlay]);

  // Resolve team colors or fallbacks
  const getTeamColor = (teamId: string, type: 'primary' | 'secondary') => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return type === 'primary' ? '#0072f5' : '#ffffff';
    return type === 'primary' ? team.primaryColor : team.secondaryColor;
  };

  return (
    <div 
      className="w-[1920px] h-[1080px] relative overflow-hidden bg-transparent select-none text-white font-sans" 
      id="obs-graphics-stage"
    >
      <AnimatePresence mode="wait">
        
        {/* 1. INTRO OVERLAY */}
        {graphicsState.activeOverlay === 'intro' && (
          <motion.div
            key="intro-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#020817]/95 flex flex-col items-center justify-center space-y-8"
          >
            <motion.div
              initial={{ scale: 0.6, rotate: -15, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 15 }}
              className="p-8 bg-gradient-to-tr from-yellow-500/10 to-amber-500/10 border-2 border-yellow-500/40 rounded-full shadow-[0_0_50px_rgba(197,168,92,0.3)]"
            >
              <Trophy className="w-36 h-36 text-yellow-400 text-glow" />
            </motion.div>

            <div className="text-center space-y-4">
              <motion.h1
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-6xl font-display font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white via-yellow-400 to-amber-600 uppercase"
              >
                Z-RAFF CHAMPIONS CUP
              </motion.h1>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-lg font-mono tracking-[0.4em] text-slate-400"
              >
                LIVE BROADCAST FEED
              </motion.p>
            </div>
          </motion.div>
        )}

        {/* 2. SPONSOR PRESENTATION */}
        {graphicsState.activeOverlay === 'sponsor' && (
          <motion.div
            key="sponsor-overlay"
            initial={{ y: 150, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 150, opacity: 0 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 glass-panel-gold rounded-2xl py-4 px-12 flex items-center space-x-6 shadow-[0_0_40px_rgba(197,168,92,0.2)]"
          >
            <span className="text-xs font-mono text-yellow-500 tracking-wider">OFFICIAL TITLE SPONSOR</span>
            <div className="h-8 w-[1px] bg-white/10" />
            <div className="flex items-center space-x-3">
              <Star className="w-6 h-6 text-yellow-400 fill-current" />
              <span className="font-display font-black text-2xl tracking-wider text-white">Z-RAFF GLOBAL AIRWAYS</span>
            </div>
          </motion.div>
        )}

        {/* 3. NEXT MATCH PREVIEW */}
        {graphicsState.activeOverlay === 'next_match' && (
          <motion.div
            key="next-match-overlay"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 bg-[#020817]/95 flex items-center justify-center"
          >
            <div className="w-[1200px] grid grid-cols-3 gap-12 items-center" id="next-match-banner">
              {/* Home */}
              <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col items-center text-center space-y-6"
              >
                {displayMatch.homeTeamLogo ? (
                  <img src={displayMatch.homeTeamLogo} alt={displayMatch.homeTeamName} className="w-48 h-48 object-contain bg-white/5 rounded-3xl p-4 border border-white/10 shadow-2xl" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-48 h-48 bg-white/5 border border-white/10 rounded-3xl p-4 shadow-2xl flex items-center justify-center font-display font-extrabold text-white text-5xl">
                    {displayMatch.homeTeamShortName || "H"}
                  </div>
                )}
                <h2 className="text-4xl font-display font-extrabold text-white">{displayMatch.homeTeamName}</h2>
                <span className="text-lg font-mono px-4 py-1 bg-white/5 border border-white/10 rounded-full text-slate-300">
                  {displayMatch.homeTeamShortName}
                </span>
              </motion.div>

              {/* Match Details center */}
              <div className="flex flex-col items-center justify-center space-y-8 text-center">
                <span className="text-sm font-mono text-yellow-500 tracking-[0.3em] uppercase">UPCOMING CLASH</span>
                
                <div className="h-16 w-[1px] bg-white/10" />
                
                <div className="space-y-3">
                  <div className="text-5xl font-display font-black text-slate-100">VS</div>
                  <p className="text-xs font-mono text-slate-400">{displayMatch.round}</p>
                </div>

                <div className="h-16 w-[1px] bg-white/10" />

                <div className="space-y-2 text-slate-400 text-sm">
                  <div className="flex items-center justify-center space-x-2">
                    <Calendar className="w-4 h-4 text-yellow-500" />
                    <span>{displayMatch.date} • {displayMatch.kickoffTime}</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <MapPin className="w-4 h-4 text-yellow-500" />
                    <span>{displayMatch.venue}</span>
                  </div>
                </div>
              </div>

              {/* Away */}
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col items-center text-center space-y-6"
              >
                {displayMatch.awayTeamLogo ? (
                  <img src={displayMatch.awayTeamLogo} alt={displayMatch.awayTeamName} className="w-48 h-48 object-contain bg-white/5 rounded-3xl p-4 border border-white/10 shadow-2xl" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-48 h-48 bg-white/5 border border-white/10 rounded-3xl p-4 shadow-2xl flex items-center justify-center font-display font-extrabold text-white text-5xl">
                    {displayMatch.awayTeamShortName || "A"}
                  </div>
                )}
                <h2 className="text-4xl font-display font-extrabold text-white">{displayMatch.awayTeamName}</h2>
                <span className="text-lg font-mono px-4 py-1 bg-white/5 border border-white/10 rounded-full text-slate-300">
                  {displayMatch.awayTeamShortName}
                </span>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* 4. SCOREBOARD TOP-LEFT FLOATER */}
        {graphicsState.activeOverlay === 'match_scoreboard' && (
          <motion.div
            key="scoreboard-floater"
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="absolute top-12 left-12 flex items-center bg-[#020817]/95 border border-white/10 rounded-xl overflow-hidden shadow-2xl"
            id="broadcast-live-scoreboard"
          >
            {/* Header / Tourney Flag */}
            <div className="bg-yellow-500 text-slate-950 px-3 py-4 font-mono font-black text-xs flex items-center justify-center h-full">
              Z-RAFF
            </div>

            {/* Home info */}
            <div className="px-4 py-3 flex items-center space-x-2.5">
              <span className="font-display font-extrabold text-sm text-white">{displayMatch.homeTeamShortName}</span>
              {displayMatch.homeTeamLogo ? (
                <img src={displayMatch.homeTeamLogo} alt={displayMatch.homeTeamName} className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
              ) : null}
              <div className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: getTeamColor(displayMatch.homeTeamId, 'primary') }} />
            </div>

            {/* Scores box */}
            <div className="bg-slate-900 px-5 py-3 font-mono font-extrabold text-lg text-yellow-400 text-glow border-x border-white/5">
              {displayMatch.score.home} - {displayMatch.score.away}
            </div>

            {/* Away info */}
            <div className="px-4 py-3 flex items-center space-x-2.5">
              <div className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: getTeamColor(displayMatch.awayTeamId, 'primary') }} />
              {displayMatch.awayTeamLogo ? (
                <img src={displayMatch.awayTeamLogo} alt={displayMatch.awayTeamName} className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
              ) : null}
              <span className="font-display font-extrabold text-sm text-white">{displayMatch.awayTeamShortName}</span>
            </div>

            {/* Clock */}
            <div className="bg-slate-950 px-4 py-3 font-mono text-sm text-slate-300 min-w-[70px] text-center border-l border-white/10">
              {timeStr}
              <span className="text-[10px] text-yellow-500 ml-1">
                {displayMatch.timer.half === 1 ? "1T" : "2T"}
              </span>
            </div>
          </motion.div>
        )}

        {/* 5. HALFTIME / FULLTIME STATS PANELS */}
        {(graphicsState.activeOverlay === 'half_time' || graphicsState.activeOverlay === 'full_time') && (
          <motion.div
            key="stats-summary-overlay"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute inset-0 bg-[#020817]/95 flex items-center justify-center"
          >
            <div className="w-[850px] glass-panel-gold rounded-3xl p-8 border border-yellow-500/30 space-y-8 shadow-[0_0_50px_rgba(197,168,92,0.15)]">
              {/* Title */}
              <div className="text-center space-y-2 border-b border-white/10 pb-4">
                <span className="text-sm font-mono text-yellow-500 tracking-widest uppercase">MATCH SUMMARY STATISTICS</span>
                <h2 className="text-3xl font-display font-extrabold text-white uppercase">
                  {graphicsState.activeOverlay === 'half_time' ? 'HALF TIME REPORT' : 'FULL TIME REPORT'}
                </h2>
              </div>

              {/* Header Logos */}
              <div className="flex justify-between items-center px-12">
                <div className="flex items-center space-x-4">
                  {displayMatch.homeTeamLogo ? (
                    <img src={displayMatch.homeTeamLogo} alt={displayMatch.homeTeamName} className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
                  ) : null}
                  <span className="font-display font-extrabold text-xl text-white">{displayMatch.homeTeamShortName}</span>
                </div>
                <div className="text-4xl font-mono font-black text-yellow-400 text-glow">
                  {displayMatch.score.home} - {displayMatch.score.away}
                </div>
                <div className="flex items-center space-x-4">
                  <span className="font-display font-extrabold text-xl text-white">{displayMatch.awayTeamShortName}</span>
                  {displayMatch.awayTeamLogo ? (
                    <img src={displayMatch.awayTeamLogo} alt={displayMatch.awayTeamName} className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
                  ) : null}
                </div>
              </div>

              {/* Stats entries */}
              <div className="space-y-4 pt-4" id="overlay-stats-bars">
                {/* Possession */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>{displayMatch.stats?.possession?.home || 50}%</span>
                    <span>BALL POSSESSION</span>
                    <span>{displayMatch.stats?.possession?.away || 50}%</span>
                  </div>
                  <div className="h-2 bg-slate-900 rounded-full overflow-hidden flex">
                    <div className="h-full bg-yellow-500" style={{ width: `${displayMatch.stats?.possession?.home || 50}%` }} />
                    <div className="h-full bg-sky-blue" style={{ width: `${displayMatch.stats?.possession?.away || 50}%` }} />
                  </div>
                </div>

                {/* Shots */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono text-slate-300">
                    <span className="font-bold">{displayMatch.stats?.shots?.home || 0}</span>
                    <span>TOTAL SHOTS</span>
                    <span className="font-bold">{displayMatch.stats?.shots?.away || 0}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full" />
                </div>

                {/* Corners */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono text-slate-300">
                    <span className="font-bold">{displayMatch.stats?.corners?.home || 0}</span>
                    <span>CORNERS CONCEDED</span>
                    <span className="font-bold">{displayMatch.stats?.corners?.away || 0}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full" />
                </div>
              </div>

              {/* Goalscorers list */}
              <div className="grid grid-cols-2 gap-8 pt-4 border-t border-white/5 text-xs font-mono text-slate-400">
                <div className="space-y-1 text-left">
                  {displayMatch.events?.filter(e => e.type === 'goal' && e.teamId === displayMatch.homeTeamId).map(e => (
                    <div key={e.id}>⚽ {e.playerName} ({e.minute}')</div>
                  ))}
                </div>
                <div className="space-y-1 text-right">
                  {displayMatch.events?.filter(e => e.type === 'goal' && e.teamId === displayMatch.awayTeamId).map(e => (
                    <div key={e.id}>⚽ {e.playerName} ({e.minute}')</div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 6. TEMPORARY ALERT LOWER-THIRD LOBBY (Goal, Substitution, Cards) */}
        {(graphicsState.activeOverlay === 'goal' || 
          graphicsState.activeOverlay === 'yellow_card' || 
          graphicsState.activeOverlay === 'red_card' || 
          graphicsState.activeOverlay === 'substitution') && graphicsState.alertDetails && (
          <motion.div
            key="alert-lower-third"
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            transition={{ type: 'spring', damping: 12 }}
            className="absolute bottom-20 left-12 w-[680px] bg-slate-950/95 border border-white/10 rounded-2xl overflow-hidden flex shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          >
            {/* Color Accent bar */}
            <div 
              className="w-4" 
              style={{ 
                backgroundColor: graphicsState.activeOverlay === 'yellow_card' 
                  ? '#eab308' 
                  : graphicsState.activeOverlay === 'red_card' 
                    ? '#ef4444' 
                    : getTeamColor(graphicsState.alertDetails.teamId, 'primary') 
              }} 
            />

            {/* Event specific visual */}
            <div className="p-6 flex-1 flex items-center justify-between" id="alert-content-inner">
              <div className="flex items-center space-x-5">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
                  {graphicsState.activeOverlay === 'goal' && <span className="text-3xl">⚽</span>}
                  {graphicsState.activeOverlay === 'yellow_card' && <div className="w-6 h-9 bg-yellow-500 rounded border border-white/20 shadow-lg" />}
                  {graphicsState.activeOverlay === 'red_card' && <div className="w-6 h-9 bg-red-600 rounded border border-white/20 shadow-lg" />}
                  {graphicsState.activeOverlay === 'substitution' && <span className="text-3xl">🔄</span>}
                </div>

                <div>
                  <div className="text-[10px] font-mono tracking-widest text-slate-500 uppercase flex items-center gap-2">
                    <span>LIVE STREAM ALERTS</span>
                    <span>•</span>
                    <span className="text-yellow-500 font-bold">{graphicsState.alertDetails.minute || 1}' MINUTE</span>
                  </div>

                  <h2 className="text-2xl font-display font-extrabold text-white mt-1 uppercase">
                    {graphicsState.activeOverlay === 'goal' && 'GOAL! GOAL! GOAL!'}
                    {graphicsState.activeOverlay === 'yellow_card' && 'YELLOW CARD CAUTION'}
                    {graphicsState.activeOverlay === 'red_card' && 'RED CARD SENT OFF'}
                    {graphicsState.activeOverlay === 'substitution' && 'TACTICAL SUBSTITUTION'}
                  </h2>

                  <div className="text-sm font-semibold text-slate-300 mt-1 flex items-center gap-2">
                    {graphicsState.activeOverlay === 'substitution' ? (
                      <div>
                        <span className="text-green-400">IN: {graphicsState.alertDetails.playerName}</span>
                        <span className="text-slate-500 mx-2">|</span>
                        <span className="text-red-400">OUT: {graphicsState.alertDetails.playerNameOut}</span>
                      </div>
                    ) : (
                      <span>{graphicsState.alertDetails.playerName}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Logo of team */}
              {graphicsState.alertDetails.teamId && (
                <img 
                  src={teams.find(t => t.id === graphicsState.alertDetails.teamId)?.logo} 
                  alt="Team Logo" 
                  className="w-14 h-14 object-contain opacity-70 bg-white/5 rounded-xl p-1" 
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          </motion.div>
        )}

        {/* 7. CHAMPION CELEBRATION */}
        {graphicsState.activeOverlay === 'champion_celebration' && (
          <motion.div
            key="champions-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#020817]/95 flex flex-col items-center justify-center space-y-8"
          >
            {/* Particles emulation */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none" id="celebration-particles">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute bg-yellow-400 rounded-full opacity-60"
                  style={{
                    width: Math.random() * 8 + 4,
                    height: Math.random() * 8 + 4,
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`
                  }}
                  animate={{
                    y: [0, -100 - Math.random() * 200],
                    x: [0, (Math.random() - 0.5) * 100],
                    scale: [1, 0]
                  }}
                  transition={{
                    duration: Math.random() * 3 + 2,
                    repeat: Infinity,
                    ease: 'easeOut'
                  }}
                />
              ))}
            </div>

            <motion.div
              initial={{ scale: 0.5, y: 100, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 10, delay: 0.1 }}
              className="relative p-12 bg-gradient-to-tr from-yellow-500/10 to-amber-500/10 border-2 border-yellow-500/40 rounded-full shadow-[0_0_80px_rgba(197,168,92,0.4)]"
            >
              <Trophy className="w-48 h-48 text-yellow-400 text-glow" />
              <Sparkles className="absolute top-4 right-4 w-10 h-10 text-yellow-300 animate-pulse" />
            </motion.div>

            <div className="text-center space-y-4 z-10">
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-xs font-mono text-yellow-500 tracking-[0.6em] uppercase"
              >
                TOURNAMENT CHAMPIONS
              </motion.span>
              
              <motion.h1
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-6xl sm:text-7xl font-display font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-yellow-400 to-amber-600 uppercase"
              >
                {displayMatch.winnerId === displayMatch.homeTeamId ? displayMatch.homeTeamName : displayMatch.awayTeamName}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="text-slate-400 font-mono text-sm uppercase tracking-widest mt-2"
              >
                VALIANT CONQUERORS OF THE Z-RAFF CHAMPIONS CUP
              </motion.p>
            </div>
          </motion.div>
        )}

        {/* 8. GROUP DRAW SLIDES */}
        {graphicsState.activeOverlay === 'group_draw' && (
          <motion.div
            key="draw-groups-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#020817]/95 flex flex-col items-center justify-center p-12"
          >
            <div className="text-center space-y-1 mb-8 shrink-0">
              <span className="text-xs font-mono text-yellow-500 tracking-widest">OFFICIAL GROUP SEEDING DRAWS</span>
              <h2 className="text-3xl font-display font-extrabold text-white">CHAMPIONS CUP GROUP BOARDS</h2>
            </div>

            <DrawGroupsLayout teams={teams} />
          </motion.div>
        )}

        {/* 9. GROUP TABLES OVERLAY */}
        {graphicsState.activeOverlay === 'group_tables' && (
          <motion.div
            key="group-tables-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#020817]/95 flex flex-col items-center justify-center p-12"
          >
            <div className="text-center space-y-1 mb-8 shrink-0">
              <span className="text-xs font-mono text-yellow-500 tracking-widest">OFFICIAL GROUPS STANDINGS</span>
              <h2 className="text-3xl font-display font-extrabold text-white">TOURNAMENT GROUPS OVERVIEW</h2>
            </div>

            <GroupTablesOverlay teams={teams} />
          </motion.div>
        )}

        {/* 10. FIXTURE BRACKET ANNOUNCEMENT OVERLAY */}
        {graphicsState.activeOverlay === 'fixture_announcement' && (
          <motion.div
            key="fixture-announcement-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#020817]/95 flex flex-col items-center justify-center p-12"
          >
            <div className="text-center space-y-1 mb-8 shrink-0">
              <span className="text-xs font-mono text-yellow-500 tracking-widest">TOURNAMENT FIXTURES & BRACKET</span>
              <h2 className="text-3xl font-display font-extrabold text-white">CHAMPIONSHIP PLAYOFF PATH</h2>
            </div>

            <FixtureBracketOverlay teams={teams} />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// Inner helper component to render group tables / standings on overlay
function GroupTablesOverlay({ teams }: { teams: Team[] }) {
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'groups'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: Group[] = [];
      snap.forEach((d) => list.push(d.data() as Group));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setGroups(list);
    }, (err) => {
      console.error("Groups onSnapshot error in overlay:", err);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="grid grid-cols-4 gap-6 w-[1600px]" id="overlay-groups-table-grid">
      {groups.map((group) => {
        const capacity = (group as any).capacity || 2;
        const positions = Array.from({ length: capacity }, (_, i) => i + 1);

        return (
          <motion.div
            key={group.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-slate-900/85 border border-yellow-500/10 rounded-2xl p-5 space-y-4 shadow-[0_4px_30px_rgba(0,0,0,0.4)] backdrop-blur-md"
          >
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="font-display font-black text-sm text-yellow-500 tracking-wider uppercase">
                {group.name}
              </h3>
              <span className="text-[9px] font-mono text-slate-500 tracking-widest font-bold">STANDINGS</span>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-12 text-[8px] font-mono font-bold tracking-wider text-slate-500 uppercase px-2">
                <span className="col-span-1">POS</span>
                <span className="col-span-7">CLUB</span>
                <span className="col-span-2 text-center">SEED</span>
                <span className="col-span-2 text-right">STATUS</span>
              </div>

              {positions.map((pos) => {
                const teamId = Object.keys(group.teamPositions || {}).find(
                  (tid) => group.teamPositions[tid] === pos
                );
                const team = teams.find((t) => t.id === teamId);

                return (
                  <div
                    key={pos}
                    className={`grid grid-cols-12 items-center px-2 py-2 bg-white/5 border border-white/5 rounded-xl text-xs font-semibold ${
                      pos === 1 ? 'border-yellow-500/20 bg-yellow-500/[0.02]' : ''
                    }`}
                  >
                    <span className={`col-span-1 font-mono text-[10px] ${pos === 1 ? 'text-yellow-400 font-bold' : 'text-slate-400'}`}>
                      {pos}
                    </span>
                    
                    <div className="col-span-7 flex items-center space-x-2 truncate">
                      {team ? (
                        <>
                          {team.logo ? (
                            <img
                              src={team.logo}
                              alt={team.name}
                              className="w-4.5 h-4.5 object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : null}
                          <span className="font-display font-bold text-[11px] text-slate-200 truncate">
                            {team.name}
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-600 italic">VACANT</span>
                      )}
                    </div>

                    <span className="col-span-2 text-center font-mono text-[10px] text-yellow-500 bg-yellow-500/5 px-1 py-0.5 rounded border border-yellow-500/10">
                      S{pos}
                    </span>

                    <span className="col-span-2 text-right font-mono text-[9px] text-slate-400">
                      {team ? 'READY' : 'TBD'}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// Inner helper component to render dynamic fixtures & live brackets on overlay
function FixtureBracketOverlay({ teams }: { teams: Team[] }) {
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    const fetchMatches = async () => {
      const snap = await getDoc(doc(db, 'settings', 'system_defaults'));
      if (snap.exists() && snap.data()?.activeTournamentId) {
        const activeTournamentId = snap.data().activeTournamentId;
        const q = query(collection(db, 'fixtures'), where('tournamentId', '==', activeTournamentId));
        const unsubscribe = onSnapshot(q, (mSnap) => {
          const list: Match[] = [];
          mSnap.forEach((d) => list.push(d.data() as Match));
          list.sort((a, b) => a.matchNumber - b.matchNumber);
          setMatches(list);
        });
        return unsubscribe;
      }
    };
    
    let unsub: (() => void) | undefined;
    fetchMatches().then(u => { unsub = u; });
    return () => { if (unsub) unsub(); };
  }, []);

  const qfMatches = matches.filter(m => m.round === 'Quarter Finals');
  const sfMatches = matches.filter(m => m.round === 'Semi Finals');
  const finalMatch = matches.find(m => m.round === 'Final');

  const renderOverlayMatch = (match: Match | undefined, label?: string) => {
    if (!match) {
      return (
        <div className="p-3 bg-slate-900/40 border border-dashed border-white/5 rounded-xl text-[10px] font-mono text-slate-600 text-center uppercase tracking-wider">
          {label || 'MATCH RESERVED'}
        </div>
      );
    }

    const homeTeam = teams.find(t => t.id === match.homeTeamId);
    const awayTeam = teams.find(t => t.id === match.awayTeamId);

    const isLive = match.status === 'Live';
    const isFinished = match.status === 'Finished';

    return (
      <div
        className={`p-3 bg-slate-900/90 border rounded-xl space-y-2 transition duration-300 relative shadow-md ${
          isLive ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.25)]' : 'border-white/10'
        }`}
      >
        <div className="flex justify-between items-center text-[8px] font-mono text-slate-500 uppercase tracking-widest border-b border-white/5 pb-1">
          <span>MATCH #{match.matchNumber}</span>
          {isLive ? (
            <span className="text-red-500 font-extrabold flex items-center space-x-1 animate-pulse">
              <span>● LIVE</span>
            </span>
          ) : isFinished ? (
            <span className="text-green-500 font-extrabold">FINISHED</span>
          ) : (
            <span>SCHEDULED</span>
          )}
        </div>

        {/* Home Row */}
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center space-x-2 truncate">
            {homeTeam?.logo ? (
              <img src={homeTeam.logo} alt={homeTeam.name} className="w-4.5 h-4.5 object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-4.5 h-4.5 bg-white/5 rounded border border-white/10 flex items-center justify-center font-mono text-[9px] text-slate-400 font-extrabold">H</div>
            )}
            <span className={`font-semibold truncate max-w-[120px] ${
              isFinished && match.winnerId !== match.homeTeamId ? 'text-slate-500 line-through' : 'text-slate-200'
            }`}>
              {match.homeTeamName || 'TBD Winner'}
            </span>
          </div>
          {(isFinished || isLive) && (
            <span className={`font-mono font-extrabold text-sm ${
              isFinished && match.winnerId === match.homeTeamId ? 'text-yellow-400 text-glow' : 'text-slate-300'
            }`}>
              {match.score.home}
            </span>
          )}
        </div>

        {/* Away Row */}
        <div className="flex justify-between items-center text-xs border-t border-white/5 pt-1.5">
          <div className="flex items-center space-x-2 truncate">
            {awayTeam?.logo ? (
              <img src={awayTeam.logo} alt={awayTeam.name} className="w-4.5 h-4.5 object-contain" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-4.5 h-4.5 bg-white/5 rounded border border-white/10 flex items-center justify-center font-mono text-[9px] text-slate-400 font-extrabold">A</div>
            )}
            <span className={`font-semibold truncate max-w-[120px] ${
              isFinished && match.winnerId !== match.awayTeamId ? 'text-slate-500 line-through' : 'text-slate-200'
            }`}>
              {match.awayTeamName || 'TBD Winner'}
            </span>
          </div>
          {(isFinished || isLive) && (
            <span className={`font-mono font-extrabold text-sm ${
              isFinished && match.winnerId === match.awayTeamId ? 'text-yellow-400 text-glow' : 'text-slate-300'
            }`}>
              {match.score.away}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-[1600px] flex flex-col justify-center space-y-8 animate-fade-in" id="overlay-bracket-view">
      <div className="grid grid-cols-4 gap-8 items-center bg-[#020817]/40 p-8 rounded-3xl border border-white/5 backdrop-blur-lg shadow-2xl">
        
        {/* Quarter Finals */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-extrabold tracking-widest text-slate-500 uppercase border-b border-white/5 pb-2 text-center">QUARTER FINALS</h3>
          <div className="space-y-4">
            {renderOverlayMatch(qfMatches[0], 'QF Match 1')}
            {renderOverlayMatch(qfMatches[1], 'QF Match 2')}
            {renderOverlayMatch(qfMatches[2], 'QF Match 3')}
            {renderOverlayMatch(qfMatches[3], 'QF Match 4')}
          </div>
        </div>

        {/* Semi Finals */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-extrabold tracking-widest text-slate-400 uppercase border-b border-white/5 pb-2 text-center">SEMI FINALS</h3>
          <div className="space-y-24">
            {renderOverlayMatch(sfMatches[0], 'SF Match 1')}
            {renderOverlayMatch(sfMatches[1], 'SF Match 2')}
          </div>
        </div>

        {/* Final */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-extrabold tracking-widest text-yellow-500 uppercase border-b border-white/5 pb-2 text-center">CHAMPIONSHIP FINAL</h3>
          <div className="space-y-4">
            {renderOverlayMatch(finalMatch, 'The Grand Final')}
          </div>
        </div>

        {/* Champion Podium */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <h3 className="text-xs font-mono font-extrabold tracking-widest text-slate-400 uppercase border-b border-white/5 pb-2 w-full text-center">TOURNAMENT CHAMPION</h3>
          {finalMatch && finalMatch.status === 'Finished' && finalMatch.winnerId ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-6 glass-panel-gold rounded-2xl flex flex-col items-center text-center space-y-4 border border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.3)] w-full max-w-[260px] bg-gradient-to-tr from-yellow-500/10 to-amber-500/10"
            >
              <Award className="w-14 h-14 text-yellow-400 text-glow fill-current" />
              <div>
                <div className="text-[10px] font-mono text-yellow-500 tracking-wider font-extrabold uppercase">WINNER</div>
                <h4 className="font-display font-extrabold text-lg text-white mt-1 uppercase">
                  {finalMatch.winnerId === finalMatch.homeTeamId ? finalMatch.homeTeamName : finalMatch.awayTeamName}
                </h4>
              </div>
            </motion.div>
          ) : (
            <div className="p-6 bg-slate-900/40 border border-dashed border-white/10 rounded-2xl flex flex-col items-center text-center space-y-3 text-slate-500 w-full max-w-[260px]">
              <Award className="w-12 h-12 text-slate-700" />
              <span className="text-xs font-mono">CHAMPION PENDING</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Inner helper component to load and render groups on overlay screen in real-time
function DrawGroupsLayout({ teams }: { teams: Team[] }) {
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'groups'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: Group[] = [];
      snap.forEach((d) => list.push(d.data() as Group));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setGroups(list);
    }, (err) => {
      console.error("Groups onSnapshot error in overlay:", err);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="grid grid-cols-4 gap-6 w-[1600px]" id="overlay-groups-board-grid">
      {groups.map((group) => {
        const capacity = (group as any).capacity || 2;
        const positions = Array.from({ length: capacity }, (_, i) => i + 1);

        return (
          <motion.div
            key={group.id}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 space-y-4"
          >
            <h3 className="font-display font-extrabold text-sm text-yellow-500 tracking-wider border-b border-white/5 pb-2 uppercase">
              {group.name}
            </h3>

            <div className="space-y-2.5">
              {positions.map((pos) => {
                const teamId = Object.keys(group.teamPositions || {}).find(
                  (tid) => group.teamPositions[tid] === pos
                );
                const team = teams.find((t) => t.id === teamId);

                return (
                  <div
                    key={pos}
                    className="flex items-center space-x-3 p-2 bg-white/5 border border-white/5 rounded-xl"
                  >
                    {team ? (
                      <>
                        {team.logo ? (
                          <img
                            src={team.logo}
                            alt={team.name}
                            className="w-5 h-5 object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : null}
                        <span className="font-display font-bold text-xs text-slate-200 truncate">
                          {team.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-600 italic">
                        EMPTY SEED SLOT
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
