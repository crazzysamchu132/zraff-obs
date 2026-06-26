import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Tournament, UserProfile } from '../types';
import { Radio, Copy, Check, ExternalLink, Settings, Film } from 'lucide-react';

interface ObsPreviewProps {
  currentUser: UserProfile;
  activeTournament: Tournament | null;
}

export default function ObsPreview({ currentUser, activeTournament }: ObsPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [outputUrl, setOutputUrl] = useState('');

  useEffect(() => {
    setOutputUrl(`${window.location.origin}/output`);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(outputUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const triggerTestGraphics = async (type: string) => {
    try {
      // Find first match or mock match
      let activeMatchId = `match_1_${activeTournament?.id || 'demo'}`;
      
      if (activeTournament) {
        const q = query(collection(db, 'fixtures'), where('tournamentId', '==', activeTournament.id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          activeMatchId = snap.docs[0].id;
        }
      }
      
      await setDoc(doc(db, 'graphics', 'overlay_control'), {
        activeOverlay: type,
        activeMatchId: activeMatchId,
        alertDetails: {
          teamId: 'demo_team',
          playerName: 'Cristiano Ronaldo',
          playerNameOut: 'Karim Benzema',
          minute: 75
        },
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8 p-6" id="obs-preview-container">
      {/* Title */}
      <div className="flex items-center space-x-3">
        <Film className="w-8 h-8 text-yellow-500" />
        <div>
          <h1 className="text-2xl font-display font-extrabold text-white">OBS BROADCAST HUB</h1>
          <p className="text-sm text-slate-400">Configure OBS Studio Browser Sources, review output feeds, and trigger graphic dry-runs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8" id="obs-preview-grid">
        {/* Connection Setup Guidelines */}
        <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-6" id="obs-guide-card">
          <div className="flex items-center space-x-2 pb-2 border-b border-white/5">
            <Settings className="w-5 h-5 text-yellow-500" />
            <h2 className="text-base font-bold text-white uppercase">OBS Configuration Guide</h2>
          </div>

          <div className="space-y-5 text-sm leading-relaxed text-slate-300" id="obs-guide-content">
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase block">1. BROWSER SOURCE URL</span>
              <div className="flex items-center space-x-2 bg-slate-900 border border-white/10 rounded-xl p-2" id="obs-url-copy-box">
                <input
                  type="text"
                  readOnly
                  value={outputUrl}
                  className="bg-transparent border-0 outline-none text-xs font-mono text-slate-300 flex-1 px-2 select-all"
                />
                <button
                  onClick={handleCopy}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-yellow-500 transition shrink-0"
                  id="btn-copy-obs-url"
                  title="Copy OBS Link"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase block">2. CANVAS DIMENSIONS</span>
              <ul className="space-y-3 text-xs font-mono text-slate-400" id="obs-canvas-dimensions-list">
                <li className="flex justify-between pb-1.5 border-b border-white/5">
                  <span>Width:</span> <span className="font-bold text-slate-200">1920</span>
                </li>
                <li className="flex justify-between pb-1.5 border-b border-white/5">
                  <span>Height:</span> <span className="font-bold text-slate-200">1080</span>
                </li>
                <li className="flex justify-between pb-1.5 border-b border-white/5">
                  <span>FPS:</span> <span className="font-bold text-slate-200">60</span>
                </li>
                <li className="flex justify-between pb-1.5 border-b border-white/5">
                  <span>Background CSS:</span> <span className="font-bold text-slate-200">Leave Blank</span>
                </li>
              </ul>
            </div>

            {currentUser.role !== 'viewer' && (
              <div className="space-y-5 pt-2">
                <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase block">3. LIVE BROADCAST OVERLAYS</span>
                
                {/* Broadcast / Fullscreen Scenes */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block">Broadcast Screens</span>
                  <div className="grid grid-cols-2 gap-2" id="screens-triggers">
                    <button
                      onClick={() => triggerTestGraphics('intro')}
                      className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono font-semibold text-left transition flex items-center space-x-1.5"
                      id="test-trigger-intro"
                    >
                      <span>🎥 Intro Scene</span>
                    </button>
                    <button
                      onClick={() => triggerTestGraphics('sponsor')}
                      className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono font-semibold text-left transition flex items-center space-x-1.5"
                      id="test-trigger-sponsor"
                    >
                      <span>⭐ Sponsor Logo</span>
                    </button>
                    <button
                      onClick={() => triggerTestGraphics('group_draw')}
                      className="py-2 px-3 bg-yellow-500/10 hover:bg-yellow-500/15 border border-yellow-500/20 text-yellow-400 rounded-lg text-xs font-mono font-bold text-left transition flex items-center space-x-1.5"
                      id="test-trigger-groups-draw"
                    >
                      <span>📊 Groups Board</span>
                    </button>
                    <button
                      onClick={() => triggerTestGraphics('group_tables')}
                      className="py-2 px-3 bg-yellow-500/10 hover:bg-yellow-500/15 border border-yellow-500/20 text-yellow-400 rounded-lg text-xs font-mono font-bold text-left transition flex items-center space-x-1.5"
                      id="test-trigger-groups-tables"
                    >
                      <span>📈 Groups Table</span>
                    </button>
                    <button
                      onClick={() => triggerTestGraphics('fixture_announcement')}
                      className="py-2 px-3 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 text-blue-400 rounded-lg text-xs font-mono font-bold text-left transition flex items-center space-x-1.5 col-span-2"
                      id="test-trigger-fixtures"
                    >
                      <span>📅 Fixture Bracket</span>
                    </button>
                    <button
                      onClick={() => triggerTestGraphics('champion_celebration')}
                      className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono font-semibold text-left transition flex items-center space-x-1.5 col-span-2"
                      id="test-trigger-celebration"
                    >
                      <span>🏆 Champions Podium</span>
                    </button>
                  </div>
                </div>

                {/* Match overlays */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block">Live Match Screens</span>
                  <div className="grid grid-cols-2 gap-2" id="match-screens-triggers">
                    <button
                      onClick={() => triggerTestGraphics('next_match')}
                      className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono font-semibold text-left transition flex items-center space-x-1.5"
                      id="test-trigger-nextmatch"
                    >
                      <span>⚔️ Next Match</span>
                    </button>
                    <button
                      onClick={() => triggerTestGraphics('match_scoreboard')}
                      className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono font-semibold text-left transition flex items-center space-x-1.5"
                      id="test-trigger-scoreboard"
                    >
                      <span>🕒 Scoreboard</span>
                    </button>
                    <button
                      onClick={() => triggerTestGraphics('half_time')}
                      className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono font-semibold text-left transition flex items-center space-x-1.5"
                      id="test-trigger-halftime"
                    >
                      <span>⏸️ Half Time Stats</span>
                    </button>
                    <button
                      onClick={() => triggerTestGraphics('full_time')}
                      className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono font-semibold text-left transition flex items-center space-x-1.5"
                      id="test-trigger-fulltime"
                    >
                      <span>🏁 Full Time Stats</span>
                    </button>
                  </div>
                </div>

                {/* Instant alerts */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block">Instant Overlays (Lower Thirds)</span>
                  <div className="grid grid-cols-2 gap-2" id="alerts-triggers">
                    <button
                      onClick={() => triggerTestGraphics('goal')}
                      className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono font-semibold text-left transition flex items-center space-x-1.5"
                      id="test-trigger-goal"
                    >
                      <span>⚽ Goal Alert</span>
                    </button>
                    <button
                      onClick={() => triggerTestGraphics('substitution')}
                      className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono font-semibold text-left transition flex items-center space-x-1.5"
                      id="test-trigger-sub"
                    >
                      <span>🔄 Sub Alert</span>
                    </button>
                  </div>
                </div>

                {/* Clear feed */}
                <button
                  onClick={() => triggerTestGraphics('none')}
                  className="w-full py-2.5 bg-red-600/10 hover:bg-red-600/15 border border-red-500/20 text-red-400 rounded-xl text-xs font-mono font-bold tracking-wider transition uppercase"
                  id="test-trigger-clear"
                >
                  ❌ Clear Overlay Graphics
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Realtime Canvas Preview frame */}
        <div className="xl:col-span-2 glass-panel rounded-2xl p-6 border border-white/5 space-y-4 flex flex-col h-[520px]" id="obs-preview-frame-card">
          <div className="flex justify-between items-center pb-2 border-b border-white/5 shrink-0">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
              <h2 className="text-base font-bold text-white uppercase">Real-time Feed Monitor</h2>
            </div>
            
            <a
              href={outputUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-xs text-yellow-500 hover:underline font-mono uppercase"
              id="btn-open-obs-tab"
            >
              <span>New Tab Feed</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex-1 bg-slate-950 border border-white/10 rounded-xl overflow-hidden relative shadow-inner" id="obs-feed-iframe-container">
            {/* Aspect ratio preview block (renders 1920x1080 scaled down to fit parent) */}
            {outputUrl ? (
              <iframe
                src={outputUrl}
                title="OBS Graphics Live Stream Output Preview Feed"
                className="absolute inset-0 w-full h-full border-0 bg-transparent origin-top-left"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.8)' // slightly dark overlay to see transparent items
                }}
                id="obs-preview-iframe"
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
