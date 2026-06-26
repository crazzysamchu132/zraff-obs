import React from 'react';
import { UserProfile, Tournament } from '../types';
import { 
  Trophy, 
  Users, 
  Calendar, 
  Radio, 
  Settings as SettingsIcon, 
  LogOut, 
  Shield, 
  LayoutDashboard,
  User,
  Layers
} from 'lucide-react';

interface HeaderNavProps {
  user: UserProfile | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeTournament: Tournament | null;
  onLogout: () => void;
}

export default function HeaderNav({ user, activeTab, setActiveTab, activeTournament, onLogout }: HeaderNavProps) {
  if (!user) return null;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'operator', 'viewer'] },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy, roles: ['admin', 'manager', 'operator', 'viewer'] },
    { id: 'teams', label: 'Teams', icon: Users, roles: ['admin', 'manager', 'operator', 'viewer'] },
    { id: 'groups', label: 'Group Draw', icon: Layers, roles: ['admin', 'manager', 'operator', 'viewer'] },
    { id: 'fixtures', label: 'Fixtures & Bracket', icon: Calendar, roles: ['admin', 'manager', 'operator', 'viewer'] },
    { id: 'live', label: 'Live Control', icon: Radio, roles: ['admin', 'manager', 'operator'] },
    { id: 'admin', label: 'Admin Panel', icon: Shield, roles: ['admin'] },
  ];

  const allowedTabs = tabs.filter(tab => tab.roles.includes(user.role));

  return (
    <header className="glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between border-b border-white/10" id="app-header">
      {/* Brand & Active Tournament */}
      <div className="flex items-center space-x-6" id="brand-container">
        <div className="flex items-center space-x-2" id="brand-logo">
          <div className="p-2 bg-gradient-to-tr from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 rounded-lg">
            <Trophy className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <span className="font-display font-bold tracking-wider text-xl bg-gradient-to-r from-white via-slate-200 to-yellow-400 bg-clip-text text-transparent">
              Z-RAFF CHAMP
            </span>
            <p className="text-[10px] font-mono tracking-widest text-slate-500">TOURNAMENT ENGINE</p>
          </div>
        </div>

        {activeTournament && (
          <div className="hidden md:flex items-center space-x-3 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full" id="active-tournament-pill">
            {activeTournament.logo ? (
              <img src={activeTournament.logo} alt="Tournament Logo" className="w-5 h-5 object-contain" referrerPolicy="no-referrer" />
            ) : (
              <Trophy className="w-4 h-4 text-yellow-500" />
            )}
            <span className="text-xs font-medium text-slate-300 max-w-[180px] truncate">
              {activeTournament.name}
            </span>
            <span className="text-[9px] px-2 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full font-mono">
              {activeTournament.season}
            </span>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <nav className="hidden lg:flex items-center space-x-1" id="nav-tabs">
        {allowedTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30 text-yellow-400 text-glow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Info & Actions */}
      <div className="flex items-center space-x-4" id="user-actions">
        {/* Profile Card */}
        <div className="flex items-center space-x-3 pr-4 border-r border-white/10" id="user-profile-widget">
          <div className="relative" id="user-avatar-container">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.fullName} 
                className="w-9 h-9 rounded-full object-cover border border-white/20" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                <User className="w-4 h-4 text-slate-400" />
              </div>
            )}
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
              user.status === 'active' ? 'bg-green-500' : 'bg-red-500'
            }`} />
          </div>
          
          <div className="hidden sm:block text-left" id="user-text-info">
            <h4 className="text-sm font-semibold text-slate-200 leading-tight">{user.fullName}</h4>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className="text-[10px] font-mono tracking-wider uppercase text-yellow-500">
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2" id="header-action-buttons">
          <button
            onClick={() => setActiveTab('obs-preview')}
            id="btn-obs-preview"
            className={`p-2 rounded-lg text-slate-400 hover:text-yellow-400 hover:bg-white/5 border ${
              activeTab === 'obs-preview' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5' : 'border-transparent'
            } transition-colors`}
            title="OBS Broadcast Output Preview"
          >
            <Radio className="w-5 h-5" />
          </button>
          <button
            onClick={onLogout}
            id="btn-logout"
            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 border border-transparent transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
