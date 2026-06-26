import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Team, Tournament, Match, UserProfile, SystemLog } from '../types';
import { Trophy, Users, Calendar, Radio, Users2, Activity, ShieldCheck, ChevronRight } from 'lucide-react';

interface DashboardStatsProps {
  currentUser: UserProfile;
  activeTournament: Tournament | null;
  setActiveTab: (tab: string) => void;
}

export default function DashboardStats({ currentUser, activeTournament, setActiveTab }: DashboardStatsProps) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTeams: 0,
    totalTournaments: 0,
    totalFixtures: 0,
    activeMatches: 0
  });
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Users count
        const usersSnap = await getDocs(collection(db, 'users'));
        const totalUsers = usersSnap.size;

        // Tournaments count
        const tourneysSnap = await getDocs(collection(db, 'tournaments'));
        const totalTournaments = tourneysSnap.size;

        let totalTeams = 0;
        let totalFixtures = 0;
        let activeMatches = 0;

        if (activeTournament) {
          // Teams count in current tournament
          const teamsSnap = await getDocs(query(collection(db, 'teams'), where('tournamentId', '==', activeTournament.id)));
          totalTeams = teamsSnap.size;

          // Fixtures count in current tournament
          const fixturesSnap = await getDocs(query(collection(db, 'fixtures'), where('tournamentId', '==', activeTournament.id)));
          totalFixtures = fixturesSnap.size;

          // Active matches count
          fixturesSnap.forEach((docSnap) => {
            const m = docSnap.data();
            if (m.status === 'Live') activeMatches++;
          });
        }

        setStats({
          totalUsers,
          totalTeams,
          totalTournaments,
          totalFixtures,
          activeMatches
        });

        // Recent Logs
        const logsSnap = await getDocs(query(collection(db, 'system_logs'), limit(5)));
        const logsList: SystemLog[] = [];
        logsSnap.forEach((docSnap) => {
          logsList.push(docSnap.data() as SystemLog);
        });
        // Sort
        logsList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLogs(logsList);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [activeTournament]);

  const cards = [
    { title: 'Total Members', value: stats.totalUsers, icon: Users2, color: 'text-blue-400', desc: 'Registered federation accounts' },
    { title: 'Registered Clubs', value: stats.totalTeams, icon: Users, color: 'text-yellow-500', desc: 'Qualified tournament squads' },
    { title: 'Championship Series', value: stats.totalTournaments, icon: Trophy, color: 'text-amber-500', desc: 'Configured active tournaments' },
    { title: 'Generated Fixtures', value: stats.totalFixtures, icon: Calendar, color: 'text-purple-400', desc: 'Calculated bracket matches' },
    { title: 'Active Live Matches', value: stats.activeMatches, icon: Radio, color: 'text-red-500', desc: 'Matches currently live streaming', ping: stats.activeMatches > 0 },
  ];

  return (
    <div className="space-y-8 p-6" id="dashboard-stats-container">
      {/* Welcome banner */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-white/5 bg-gradient-to-r from-slate-900/40 via-yellow-500/5 to-transparent relative overflow-hidden" id="dashboard-banner">
        <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center space-x-2 text-xs font-mono text-yellow-500 tracking-wider">
          <ShieldCheck className="w-4.5 h-4.5" />
          <span>AUTHORIZED BROADCST CONSOLE ACTIVATED</span>
        </div>
        
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-white mt-2 leading-tight">
          Welcome back, {currentUser.fullName}
        </h1>
        <p className="text-slate-400 text-sm mt-1.5 max-w-2xl leading-relaxed">
          Manage match schedules, assign seeding, log real-time game events, and push premium overlay animations instantly to your OBS Browser Source overlays.
        </p>
      </div>

      {loading ? (
        <div className="py-24 text-center text-slate-400 font-mono tracking-wider text-sm" id="stats-loading">
          COMPUTING HUB ANALYTICS METRICS...
        </div>
      ) : (
        <div className="space-y-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6" id="stats-cards-grid">
            {cards.map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className="glass-panel rounded-2xl p-5 border border-white/5 hover:border-white/10 transition relative overflow-hidden" id={`stats-card-${i}`}>
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-medium text-slate-400">{c.title}</span>
                    <Icon className={`w-5 h-5 ${c.color}`} />
                  </div>
                  <div className="flex items-baseline space-x-2 mt-4">
                    <span className="text-3xl font-bold text-white tracking-tight">{c.value}</span>
                    {c.ping && (
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono uppercase mt-2 tracking-wider">{c.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="dashboard-bottom-grid">
            {/* Quick Actions */}
            <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-white/5 space-y-6" id="quick-links-card">
              <div className="flex items-center space-x-2 pb-2 border-b border-white/5">
                <Activity className="w-5 h-5 text-yellow-500" />
                <h2 className="text-base font-bold text-white">Championship Operations Hub</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="quick-actions-grid">
                <button
                  onClick={() => setActiveTab('tournaments')}
                  className="p-4 bg-white/5 border border-white/5 hover:bg-white/10 rounded-xl text-left transition flex items-center justify-between group"
                  id="qa-tournaments"
                >
                  <div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-yellow-400 transition">Tournament Director</h4>
                    <p className="text-xs text-slate-400 mt-1">Configure active cup guidelines & dates</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
                </button>

                <button
                  onClick={() => setActiveTab('teams')}
                  className="p-4 bg-white/5 border border-white/5 hover:bg-white/10 rounded-xl text-left transition flex items-center justify-between group"
                  id="qa-teams"
                >
                  <div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-yellow-400 transition">Roster Manager</h4>
                    <p className="text-xs text-slate-400 mt-1">Enroll clubs and configure tactical colors</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
                </button>

                <button
                  onClick={() => setActiveTab('groups')}
                  className="p-4 bg-white/5 border border-white/5 hover:bg-white/10 rounded-xl text-left transition flex items-center justify-between group"
                  id="qa-draw"
                >
                  <div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-yellow-400 transition">Group Draw Stage</h4>
                    <p className="text-xs text-slate-400 mt-1">Allocate teams and generate matches</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
                </button>

                <button
                  onClick={() => setActiveTab('fixtures')}
                  className="p-4 bg-white/5 border border-white/5 hover:bg-white/10 rounded-xl text-left transition flex items-center justify-between group"
                  id="qa-bracket"
                >
                  <div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-yellow-400 transition">Interactive Brackets</h4>
                    <p className="text-xs text-slate-400 mt-1">Review live standings & brackets paths</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition" />
                </button>
              </div>
            </div>

            {/* Recent audit activity */}
            <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-6 flex flex-col h-[320px]" id="recent-logs-widget">
              <div className="flex items-center space-x-2 pb-2 border-b border-white/5 shrink-0">
                <Activity className="w-5 h-5 text-yellow-500" />
                <h2 className="text-base font-bold text-white">Platform Activity</h2>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1" id="logs-mini-list">
                {logs.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-12 font-mono uppercase">NO SYSTEM EVENT METRICS</p>
                ) : (
                  logs.map((l) => (
                    <div key={l.id} className="p-3 bg-white/5 border border-white/5 rounded-xl text-[11px] space-y-1" id={`mini-log-${l.id}`}>
                      <div className="flex justify-between text-[9px] font-mono text-slate-400">
                        <span className="text-yellow-500 font-semibold">{l.userName}</span>
                        <span>{new Date(l.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-slate-200 line-clamp-1">{l.action}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
