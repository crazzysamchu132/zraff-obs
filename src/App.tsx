import React, { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile, Tournament } from './types';

// Modular UI Panels
import HeaderNav from './components/HeaderNav';
import DashboardStats from './components/DashboardStats';
import TournamentManager from './components/TournamentManager';
import TeamManager from './components/TeamManager';
import GroupDrawManager from './components/GroupDrawManager';
import FixtureBracketManager from './components/FixtureBracketManager';
import LiveConsole from './components/LiveConsole';
import AdminPanel from './components/AdminPanel';
import ObsPreview from './components/ObsPreview';
import ObsGraphicsOverlay from './components/ObsGraphicsOverlay';
import PasswordLockScreen from './components/PasswordLockScreen';

const DEFAULT_USER: UserProfile = {
  uid: 'admin-guest-id',
  fullName: 'Tournament Director',
  username: 'admin',
  email: 'director@example.com',
  phone: '',
  photoURL: 'https://api.dicebear.com/7.x/adventurer/svg?seed=admin',
  role: 'admin',
  status: 'active',
  createdAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  emailVerified: true
};

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(DEFAULT_USER);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedMatchToControl, setSelectedMatchToControl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return localStorage.getItem('app_unlocked') === 'true';
  });

  // Router listener
  useEffect(() => {
    const handleLocationChange = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Listen to active tournament from defaults, or query active list
  useEffect(() => {
    if (!currentUser) return;
    
    // Read the active tournament
    const unsubscribeActive = onSnapshot(doc(db, 'settings', 'system_defaults'), async (snap) => {
      if (snap.exists()) {
        const defaults = snap.data();
        if (defaults.activeTournamentId) {
          const tDoc = await getDoc(doc(db, 'tournaments', defaults.activeTournamentId));
          if (tDoc.exists()) {
            setActiveTournament({ id: tDoc.id, ...tDoc.data() } as Tournament);
          }
        }
      }
    }, (err) => {
      console.error("Settings system_defaults onSnapshot error:", err);
    });

    return () => unsubscribeActive();
  }, [currentUser]);

  // Handle setting active tournament
  const handleSetActiveTournament = async (t: Tournament | null) => {
    setActiveTournament(t);
    if (t) {
      // Save to system defaults
      await setDoc(doc(db, 'settings', 'system_defaults'), {
        activeTournamentId: t.id
      });
    }
  };

  // If we are showing the OBS Overlay Browser Source, bypass all headers & menus!
  if (pathname === '/output' || pathname === '/output/') {
    return <ObsGraphicsOverlay />;
  }

  // Gatekeeper Password Lock for all control routes
  if (!isUnlocked) {
    return (
      <PasswordLockScreen 
        onUnlock={() => {
          setIsUnlocked(true);
          localStorage.setItem('app_unlocked', 'true');
        }} 
      />
    );
  }

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen bg-[#020817] flex items-center justify-center font-mono text-sm tracking-widest text-slate-400">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>ESTABLISHING SECURE FEDERATION CHANNEL...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#020817]" id="app-platform-shell">
      <HeaderNav 
        user={currentUser} 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedMatchToControl(null); // clear match selection
        }} 
        activeTournament={activeTournament}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto pb-12" id="app-content-body">
        {selectedMatchToControl ? (
          <LiveConsole 
            currentUser={currentUser}
            matchId={selectedMatchToControl}
            onBackToBracket={() => setSelectedMatchToControl(null)}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardStats 
                currentUser={currentUser} 
                activeTournament={activeTournament} 
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'tournaments' && (
              <TournamentManager 
                currentUser={currentUser}
                activeTournament={activeTournament}
                setActiveTournament={handleSetActiveTournament}
              />
            )}

            {activeTab === 'teams' && (
              <TeamManager 
                currentUser={currentUser}
                activeTournament={activeTournament}
              />
            )}

            {activeTab === 'groups' && (
              <GroupDrawManager 
                currentUser={currentUser}
                activeTournament={activeTournament}
              />
            )}

            {activeTab === 'fixtures' && (
              <FixtureBracketManager 
                currentUser={currentUser}
                activeTournament={activeTournament}
                onSelectMatchToControl={(matchId) => setSelectedMatchToControl(matchId)}
              />
            )}

            {activeTab === 'live' && (
              <div className="p-8 text-center glass-panel rounded-2xl max-w-md mx-auto mt-12" id="live-console-hint">
                <span className="text-4xl">⏱️</span>
                <h3 className="text-lg font-bold text-white mt-3">Active Match Control</h3>
                <p className="text-slate-400 text-xs mt-2">
                  Please select an upcoming or live match from the "Fixtures & Bracket" panel, and click "Control Match" to initialize the stream deck controls.
                </p>
                <button
                  onClick={() => setActiveTab('fixtures')}
                  className="mt-5 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold py-2 px-4 rounded-xl text-xs transition"
                >
                  View Bracket Schedules
                </button>
              </div>
            )}

            {activeTab === 'admin' && (
              <AdminPanel currentUser={currentUser} />
            )}

            {activeTab === 'obs-preview' && (
              <ObsPreview 
                currentUser={currentUser}
                activeTournament={activeTournament}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
