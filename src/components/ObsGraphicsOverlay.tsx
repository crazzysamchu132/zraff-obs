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
    if (!match) return;
    const updateTimeStr = () => {
      let seconds = match.timer.elapsedSeconds || 0;
      if (match.timer.isRunning) {
        const elapsedSinceUpdate = Math.floor((Date.now() - new Date(match.timer.lastUpdated).getTime()) / 1000);
        seconds += Math.max(0, elapsedSinceUpdate);
      }
      const m = Math.floor(seconds / 60).toString().padStart(2, '0');
      const s = (seconds % 60).toString().padStart(2, '0');
      setTimeStr(`${m}:${s}`);
    };

    updateTimeStr();
    let interval: NodeJS.Timeout | null = null;
    if (match.timer.isRunning) {
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
        {graphicsState.activeOverlay === 'next_match' && match && (
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
                {match.homeTeamLogo ? (
                  <img src={match.homeTeamLogo} alt={match.homeTeamName} className="w-48 h-48 object-contain bg-white/5 rounded-3xl p-4 border border-white/10 shadow-2xl" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-48 h-48 bg-white/5 border border-white/10 rounded-3xl p-4 shadow-2xl flex items-center justify-center font-display font-extrabold text-white text-5xl">
                    {match.homeTeamShortName || "H"}
                  </div>
                )}
                <h2 className="text-4xl font-display font-extrabold text-white">{match.homeTeamName}</h2>
                <span className="text-lg font-mono px-4 py-1 bg-white/5 border border-white/10 rounded-full text-slate-300">
                  {match.homeTeamShortName}
                </span>
              </motion.div>

              {/* Match Details center */}
              <div className="flex flex-col items-center justify-center space-y-8 text-center">
                <span className="text-sm font-mono text-yellow-500 tracking-[0.3em] uppercase">UPCOMING CLASH</span>
                
                <div className="h-16 w-[1px] bg-white/10" />
                
                <div className="space-y-3">
                  <div className="text-5xl font-display font-black text-slate-100">VS</div>
                  <p className="text-xs font-mono text-slate-400">{match.round}</p>
                </div>

                <div className="h-16 w-[1px] bg-white/10" />

                <div className="space-y-2 text-slate-400 text-sm">
                  <div className="flex items-center justify-center space-x-2">
                    <Calendar className="w-4 h-4 text-yellow-500" />
                    <span>{match.date} • {match.kickoffTime}</span>
                  </div>
                  <div className="flex items-center justify-center space-x-2">
                    <MapPin className="w-4 h-4 text-yellow-500" />
                    <span>{match.venue}</span>
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
                {match.awayTeamLogo ? (
                  <img src={match.awayTeamLogo} alt={match.awayTeamName} className="w-48 h-48 object-contain bg-white/5 rounded-3xl p-4 border border-white/10 shadow-2xl" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-48 h-48 bg-white/5 border border-white/10 rounded-3xl p-4 shadow-2xl flex items-center justify-center font-display font-extrabold text-white text-5xl">
                    {match.awayTeamShortName || "A"}
                  </div>
                )}
                <h2 className="text-4xl font-display font-extrabold text-white">{match.awayTeamName}</h2>
                <span className="text-lg font-mono px-4 py-1 bg-white/5 border border-white/10 rounded-full text-slate-300">
                  {match.awayTeamShortName}
                </span>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* 4. SCOREBOARD TOP-LEFT FLOATER */}
        {graphicsState.activeOverlay === 'match_scoreboard' && match && (
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
              <span className="font-display font-extrabold text-sm text-white">{match.homeTeamShortName}</span>
              {match.homeTeamLogo ? (
                <img src={match.homeTeamLogo} alt={match.homeTeamName} className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
              ) : null}
              <div className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: getTeamColor(match.homeTeamId, 'primary') }} />
            </div>

            {/* Scores box */}
            <div className="bg-slate-900 px-5 py-3 font-mono font-extrabold text-lg text-yellow-400 text-glow border-x border-white/5">
              {match.score.home} - {match.score.away}
            </div>

            {/* Away info */}
            <div className="px-4 py-3 flex items-center space-x-2.5">
              <div className="w-[4px] h-[4px] rounded-full" style={{ backgroundColor: getTeamColor(match.awayTeamId, 'primary') }} />
              {match.awayTeamLogo ? (
                <img src={match.awayTeamLogo} alt={match.awayTeamName} className="w-6 h-6 object-contain" referrerPolicy="no-referrer" />
              ) : null}
              <span className="font-display font-extrabold text-sm text-white">{match.awayTeamShortName}</span>
            </div>

            {/* Clock */}
            <div className="bg-slate-950 px-4 py-3 font-mono text-sm text-slate-300 min-w-[70px] text-center border-l border-white/10">
              {timeStr}
              <span className="text-[10px] text-yellow-500 ml-1">
                {match.timer.half === 1 ? "1T" : "2T"}
              </span>
            </div>
          </motion.div>
        )}

        {/* 5. HALFTIME / FULLTIME STATS PANELS */}
        {(graphicsState.activeOverlay === 'half_time' || graphicsState.activeOverlay === 'full_time') && match && (
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
                  {match.homeTeamLogo ? (
                    <img src={match.homeTeamLogo} alt={match.homeTeamName} className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
                  ) : null}
                  <span className="font-display font-extrabold text-xl text-white">{match.homeTeamShortName}</span>
                </div>
                <div className="text-4xl font-mono font-black text-yellow-400 text-glow">
                  {match.score.home} - {match.score.away}
                </div>
                <div className="flex items-center space-x-4">
                  <span className="font-display font-extrabold text-xl text-white">{match.awayTeamShortName}</span>
                  {match.awayTeamLogo ? (
                    <img src={match.awayTeamLogo} alt={match.awayTeamName} className="w-16 h-16 object-contain" referrerPolicy="no-referrer" />
                  ) : null}
                </div>
              </div>

              {/* Stats entries */}
              <div className="space-y-4 pt-4" id="overlay-stats-bars">
                {/* Possession */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>{match.stats?.possession?.home || 50}%</span>
                    <span>BALL POSSESSION</span>
                    <span>{match.stats?.possession?.away || 50}%</span>
                  </div>
                  <div className="h-2 bg-slate-900 rounded-full overflow-hidden flex">
                    <div className="h-full bg-yellow-500" style={{ width: `${match.stats?.possession?.home || 50}%` }} />
                    <div className="h-full bg-sky-blue" style={{ width: `${match.stats?.possession?.away || 50}%` }} />
                  </div>
                </div>

                {/* Shots */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono text-slate-300">
                    <span className="font-bold">{match.stats?.shots?.home || 0}</span>
                    <span>TOTAL SHOTS</span>
                    <span className="font-bold">{match.stats?.shots?.away || 0}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full" />
                </div>

                {/* Corners */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono text-slate-300">
                    <span className="font-bold">{match.stats?.corners?.home || 0}</span>
                    <span>CORNERS CONCEDED</span>
                    <span className="font-bold">{match.stats?.corners?.away || 0}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full" />
                </div>
              </div>

              {/* Goalscorers list */}
              <div className="grid grid-cols-2 gap-8 pt-4 border-t border-white/5 text-xs font-mono text-slate-400">
                <div className="space-y-1 text-left">
                  {match.events?.filter(e => e.type === 'goal' && e.teamId === match.homeTeamId).map(e => (
                    <div key={e.id}>⚽ {e.playerName} ({e.minute}')</div>
                  ))}
                </div>
                <div className="space-y-1 text-right">
                  {match.events?.filter(e => e.type === 'goal' && e.teamId === match.awayTeamId).map(e => (
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
        {graphicsState.activeOverlay === 'champion_celebration' && match && (
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
                {match.winnerId === match.homeTeamId ? match.homeTeamName : match.awayTeamName}
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

      </AnimatePresence>
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
        const letter = group.name.split(' ')[1];
        
        // Resolve teams
        const pos1TeamId = Object.keys(group.teamPositions).find(tid => group.teamPositions[tid] === 1);
        const pos2TeamId = Object.keys(group.teamPositions).find(tid => group.teamPositions[tid] === 2);
        
        const team1 = teams.find(t => t.id === pos1TeamId);
        const team2 = teams.find(t => t.id === pos2TeamId);

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
              {/* Pos 1 */}
              <div className="flex items-center space-x-3 p-2 bg-white/5 border border-white/5 rounded-xl">
                {team1 ? (
                  <>
                    {team1.logo ? (
                      <img src={team1.logo} alt={team1.name} className="w-5 h-5 object-contain" referrerPolicy="no-referrer" />
                    ) : null}
                    <span className="font-display font-bold text-xs text-slate-200 truncate">{team1.name}</span>
                  </>
                ) : (
                  <span className="text-[10px] font-mono text-slate-600 italic">EMPTY SEED SLOT</span>
                )}
              </div>

              {/* Pos 2 */}
              <div className="flex items-center space-x-3 p-2 bg-white/5 border border-white/5 rounded-xl">
                {team2 ? (
                  <>
                    {team2.logo ? (
                      <img src={team2.logo} alt={team2.name} className="w-5 h-5 object-contain" referrerPolicy="no-referrer" />
                    ) : null}
                    <span className="font-display font-bold text-xs text-slate-200 truncate">{team2.name}</span>
                  </>
                ) : (
                  <span className="text-[10px] font-mono text-slate-600 italic">EMPTY SEED SLOT</span>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
