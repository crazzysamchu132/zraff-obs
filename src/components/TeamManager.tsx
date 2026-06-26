import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Team, Player, Tournament, UserProfile } from '../types';
import { Users, Plus, Trash2, Edit2, Download, Upload, Search, User, Shirt, Save, X } from 'lucide-react';

interface TeamManagerProps {
  currentUser: UserProfile;
  activeTournament: Tournament | null;
}

export default function TeamManager({ currentUser, activeTournament }: TeamManagerProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal / Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [logo, setLogo] = useState('');
  const [coach, setCoach] = useState('');
  const [manager, setManager] = useState('');
  const [captain, setCaptain] = useState('');
  const [country, setCountry] = useState('');
  const [district, setDistrict] = useState('');
  const [club, setClub] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0072f5');
  const [secondaryColor, setSecondaryColor] = useState('#ffffff');
  
  // Players list state for the form
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [playerNumber, setPlayerNumber] = useState<number | ''>('');
  const [playerPosition, setPlayerPosition] = useState<'GK' | 'DF' | 'MF' | 'FW'>('MF');

  const fetchTeams = async () => {
    if (!activeTournament) {
      setTeams([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = query(collection(db, 'teams'), where('tournamentId', '==', activeTournament.id));
      const snap = await getDocs(q);
      const list: Team[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Team);
      });
      setTeams(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [activeTournament]);

  const handleAddPlayer = () => {
    if (!playerName || playerNumber === '') return;
    
    // Check if player number already exists in this team roster
    if (players.some(p => p.number === playerNumber)) {
      alert(`Jersey number ${playerNumber} is already allocated!`);
      return;
    }

    const newPlayer: Player = {
      id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: playerName,
      number: Number(playerNumber),
      position: playerPosition
    };

    setPlayers([...players, newPlayer]);
    setPlayerName('');
    setPlayerNumber('');
  };

  const handleRemovePlayer = (id: string) => {
    setPlayers(players.filter(p => p.id !== id));
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTournament) return;

    const teamData = {
      tournamentId: activeTournament.id,
      name,
      shortName: shortName.toUpperCase().slice(0, 3),
      logo: logo || `https://api.dicebear.com/7.x/identicon/svg?seed=${name}`,
      coach,
      manager,
      captain,
      country,
      district,
      club,
      primaryColor,
      secondaryColor,
      players,
      createdAt: new Date().toISOString()
    };

    try {
      if (editingTeamId) {
        await updateDoc(doc(db, 'teams', editingTeamId), teamData);
      } else {
        const newId = `team_${Date.now()}`;
        await setDoc(doc(db, 'teams', newId), teamData);
      }

      // Add audit log
      const logId = `log_${Date.now()}`;
      await setDoc(doc(db, 'system_logs', logId), {
        id: logId,
        userId: currentUser.uid,
        userName: currentUser.fullName,
        action: `${editingTeamId ? 'Updated' : 'Created'} team: ${name} (${shortName})`,
        timestamp: new Date().toISOString()
      });

      setShowAddForm(false);
      resetForm();
      fetchTeams();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to persist team record. Error: ${err?.message || err}`);
    }
  };

  const startEdit = (team: Team) => {
    setEditingTeamId(team.id);
    setName(team.name);
    setShortName(team.shortName);
    setLogo(team.logo);
    setCoach(team.coach);
    setManager(team.manager);
    setCaptain(team.captain);
    setCountry(team.country);
    setDistrict(team.district);
    setClub(team.club);
    setPrimaryColor(team.primaryColor);
    setSecondaryColor(team.secondaryColor);
    setPlayers(team.players || []);
    setShowAddForm(true);
  };

  const handleDelete = async (id: string, teamName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${teamName}? This will remove them from groups and rosters.`)) return;

    try {
      await deleteDoc(doc(db, 'teams', id));

      // Add audit log
      const logId = `log_${Date.now()}`;
      await setDoc(doc(db, 'system_logs', logId), {
        id: logId,
        userId: currentUser.uid,
        userName: currentUser.fullName,
        action: `Deleted team: ${teamName}`,
        timestamp: new Date().toISOString()
      });

      fetchTeams();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to delete team. Error: ${err?.message || err}`);
    }
  };

  const resetForm = () => {
    setEditingTeamId(null);
    setName('');
    setShortName('');
    setLogo('');
    setCoach('');
    setManager('');
    setCaptain('');
    setCountry('');
    setDistrict('');
    setClub('');
    setPrimaryColor('#0072f5');
    setSecondaryColor('#ffffff');
    setPlayers([]);
    setPlayerName('');
    setPlayerNumber('');
  };

  // Export Teams as JSON
  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(teams, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${activeTournament?.name.replace(/\s+/g, '_')}_teams.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import Teams from JSON
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file || !activeTournament) return;

    fileReader.onload = async (event) => {
      try {
        const importedList = JSON.parse(event.target?.result as string);
        if (!Array.isArray(importedList)) {
          alert("Invalid file format. Must be a JSON array of teams.");
          return;
        }

        for (const team of importedList) {
          const id = `team_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
          const cleanTeam = {
            tournamentId: activeTournament.id,
            name: team.name || "Unnamed Team",
            shortName: (team.shortName || "TBD").toUpperCase().slice(0, 3),
            logo: team.logo || `https://api.dicebear.com/7.x/identicon/svg?seed=${team.name}`,
            coach: team.coach || "",
            manager: team.manager || "",
            captain: team.captain || "",
            country: team.country || "",
            district: team.district || "",
            club: team.club || "",
            primaryColor: team.primaryColor || "#0072f5",
            secondaryColor: team.secondaryColor || "#ffffff",
            players: team.players || [],
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'teams', id), cleanTeam);
        }

        // Add audit log
        const logId = `log_${Date.now()}`;
        await setDoc(doc(db, 'system_logs', logId), {
          id: logId,
          userId: currentUser.uid,
          userName: currentUser.fullName,
          action: `Bulk imported ${importedList.length} teams into tournament`,
          timestamp: new Date().toISOString()
        });

        alert(`Successfully imported ${importedList.length} teams!`);
        fetchTeams();
      } catch (err) {
        console.error(err);
        alert("Failed to parse file. Make sure it is valid JSON.");
      }
    };
    fileReader.readAsText(file);
  };

  const filteredTeams = teams.filter(team => 
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.coach.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isEditable = currentUser.role === 'admin' || currentUser.role === 'manager';

  if (!activeTournament) {
    return (
      <div className="p-12 text-center" id="team-manager-unselected">
        <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">No Active Tournament Selected</h2>
        <p className="text-slate-400 mt-2 max-w-sm mx-auto">Please select or publish an active tournament in the Tournaments panel before configuring team details.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6" id="team-manager-container">
      {/* Title & Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4" id="tm-header">
        <div className="flex items-center space-x-3">
          <Users className="w-8 h-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-display font-extrabold text-white">TEAM REGISTRATION & ROSTERS</h1>
            <p className="text-sm text-slate-400">Configure participant clubs, tactical primary/secondary colors, and manager metadata.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto" id="tm-actions">
          {/* Export */}
          {teams.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 py-2.5 px-4 rounded-xl transition text-sm font-semibold"
              title="Export Current Teams to JSON"
              id="btn-export-teams"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          )}

          {/* Import */}
          {isEditable && (
            <label className="flex items-center space-x-2 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 py-2.5 px-4 rounded-xl cursor-pointer transition text-sm font-semibold">
              <Upload className="w-4 h-4" />
              <span>Import JSON</span>
              <input type="file" accept=".json" onChange={handleImport} className="hidden" id="btn-import-teams" />
            </label>
          )}

          {/* Add Team */}
          {isEditable && !showAddForm && (
            <button
              onClick={() => { resetForm(); setShowAddForm(true); }}
              className="flex items-center space-x-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 font-bold py-2.5 px-4 rounded-xl shadow-lg hover:from-yellow-400 hover:to-amber-500 transition active:scale-[0.98]"
              id="btn-add-team"
            >
              <Plus className="w-4 h-4" />
              <span>Register Team</span>
            </button>
          )}
        </div>
      </div>

      {/* Add / Edit Form */}
      {showAddForm && (
        <form onSubmit={handleCreateOrUpdate} className="glass-panel rounded-2xl p-6 sm:p-8 border border-white/5 space-y-8" id="team-form">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h2 className="text-lg font-bold text-white">
              {editingTeamId ? 'Modify Registered Team' : 'Register New Participant'}
            </h2>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); resetForm(); }}
              className="text-sm text-slate-400 hover:text-white"
              id="btn-cancel-team"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Column 1: Core details */}
            <div className="space-y-4">
              <h3 className="text-xs font-mono tracking-wider text-yellow-500 uppercase pb-1 border-b border-white/5">CLUB & ORIGIN DETAILS</h3>
              
              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Team / Club Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none focus:border-yellow-500/50"
                  placeholder="e.g. Al-Hilal SFC"
                  id="form-team-name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Short Code (3 Char)</label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={shortName}
                    onChange={(e) => setShortName(e.target.value.toUpperCase())}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none"
                    placeholder="HIL"
                    id="form-team-short"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Club Entity</label>
                  <input
                    type="text"
                    value={club}
                    onChange={(e) => setClub(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none"
                    placeholder="e.g. Al-Hilal"
                    id="form-team-club"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Team Emblem / Logo URL</label>
                <input
                  type="url"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none focus:border-yellow-500/50"
                  placeholder="https://example.com/logo.png"
                  id="form-team-logo"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Country</label>
                  <input
                    type="text"
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none"
                    placeholder="Saudi Arabia"
                    id="form-team-country"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono tracking-wider uppercase text-slate-400">District / Region</label>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none"
                    placeholder="Riyadh"
                    id="form-team-district"
                  />
                </div>
              </div>
            </div>

            {/* Column 2: Management & Colors */}
            <div className="space-y-4">
              <h3 className="text-xs font-mono tracking-wider text-yellow-500 uppercase pb-1 border-b border-white/5">STAFF & GRAPHICS COLORS</h3>

              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Head Coach</label>
                <input
                  type="text"
                  required
                  value={coach}
                  onChange={(e) => setCoach(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none"
                  placeholder="e.g. Jorge Jesus"
                  id="form-team-coach"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Team General Manager</label>
                <input
                  type="text"
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none"
                  placeholder="e.g. Fahad Al-Mofarij"
                  id="form-team-manager"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Squad Captain (Name)</label>
                <input
                  type="text"
                  value={captain}
                  onChange={(e) => setCaptain(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none"
                  placeholder="e.g. Salem Al-Dawsari"
                  id="form-team-captain"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Primary Color</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                      id="form-team-primary-color"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-white text-xs outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Secondary Color</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                      id="form-team-secondary-color"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="flex-1 bg-slate-900 border border-white/10 rounded-xl py-2 px-3 text-white text-xs outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Player roster builder */}
            <div className="space-y-4">
              <h3 className="text-xs font-mono tracking-wider text-yellow-500 uppercase pb-1 border-b border-white/5">ROSTER BUILDER</h3>
              
              {/* Add player widget */}
              <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-3" id="player-inputs-widget">
                <div className="text-xs font-semibold text-slate-300">ADD PLAYER TO SQUAD</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg py-1.5 px-3 text-white text-xs outline-none"
                      placeholder="Player Name"
                      id="input-player-name"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={playerNumber}
                      onChange={(e) => setPlayerNumber(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg py-1.5 px-3 text-white text-xs outline-none"
                      placeholder="No."
                      id="input-player-number"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <select
                    value={playerPosition}
                    onChange={(e) => setPlayerPosition(e.target.value as any)}
                    className="flex-1 bg-slate-900 border border-white/10 rounded-lg py-1.5 px-3 text-white text-xs outline-none appearance-none"
                    id="input-player-position"
                  >
                    <option value="GK">Goalkeeper (GK)</option>
                    <option value="DF">Defender (DF)</option>
                    <option value="MF">Midfielder (MF)</option>
                    <option value="FW">Forward (FW)</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddPlayer}
                    className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs transition"
                    id="btn-add-player-roster"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Player list scroll */}
              <div className="border border-white/10 rounded-xl h-[240px] overflow-y-auto p-3 bg-slate-900/50 space-y-1.5" id="squad-list-scroller">
                {players.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs font-mono">NO SQUAD PLAYERS REGISTERED</div>
                ) : (
                  players.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 bg-white/5 border border-white/5 rounded-lg hover:bg-white/10 transition text-xs" id={`roster-player-${p.id}`}>
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 flex items-center justify-center font-mono text-[10px] font-bold">
                          {p.number}
                        </span>
                        <div>
                          <span className="font-semibold text-slate-200">{p.name}</span>
                          <span className="text-[10px] font-mono text-slate-500 uppercase ml-2">[{p.position}]</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePlayer(p.id)}
                        className="p-1 text-slate-400 hover:text-red-400 transition"
                        title="Remove Player"
                        id={`btn-remove-player-${p.id}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            id="form-team-submit"
            className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 font-bold py-3 px-4 rounded-xl hover:from-yellow-400 hover:to-amber-500 transition duration-300 shadow-lg"
          >
            {editingTeamId ? 'Save Participant Records' : 'Register Tournament Participant'}
          </button>
        </form>
      )}

      {/* Directory Search & List */}
      <div className="flex items-center space-x-3 max-w-md bg-white/5 border border-white/10 rounded-xl px-4 py-2" id="teams-search-bar">
        <Search className="w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-0 outline-none text-white text-sm w-full"
          placeholder="Search registered clubs, coaches, abbreviations..."
          id="search-teams-input"
        />
      </div>

      {loading ? (
        <div className="py-24 text-center text-slate-400 font-mono tracking-wider text-sm" id="teams-loading">
          RETRIEVING TEAM REGISTER RECORDS...
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="glass-panel rounded-2xl py-20 text-center border border-white/5" id="teams-empty-state">
          <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white">No Registered Teams Found</h2>
          <p className="text-slate-400 mt-2 max-w-md mx-auto">Register teams manually or import them using our standard JSON bulk schema to populate the tournament.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" id="teams-grid">
          {filteredTeams.map((team) => (
            <div 
              key={team.id}
              id={`team-card-${team.id}`}
              className="glass-panel rounded-2xl p-5 border border-white/5 hover:border-white/15 transition flex flex-col justify-between"
            >
              <div>
                {/* Header emblem & colours */}
                <div className="flex justify-between items-start mb-4">
                  {team.logo ? (
                    <img src={team.logo} alt={team.name} className="w-14 h-14 rounded-xl object-contain bg-white/5 border border-white/10 p-1" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-display font-extrabold text-lg text-yellow-500">
                      {team.shortName || team.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex space-x-1" id={`team-colors-${team.id}`} title="Team Colors">
                    <span className="w-3 h-6 rounded-l" style={{ backgroundColor: team.primaryColor }} />
                    <span className="w-3 h-6 rounded-r border-r border-y border-white/10" style={{ backgroundColor: team.secondaryColor }} />
                  </div>
                </div>

                {/* Team Info */}
                <div className="space-y-2 mb-4">
                  <h3 className="font-display font-bold text-base text-white leading-tight">{team.name}</h3>
                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <span className="font-mono px-2 py-0.5 bg-white/5 border border-white/10 rounded">{team.shortName}</span>
                    <span>• {team.country}</span>
                  </div>
                </div>

                {/* Roster & Coach summary */}
                <div className="border-t border-white/5 pt-3 space-y-1.5 text-xs text-slate-400 font-sans" id={`team-info-summary-${team.id}`}>
                  <div><strong className="text-slate-300">Coach:</strong> {team.coach}</div>
                  {team.captain && <div><strong className="text-slate-300">Captain:</strong> {team.captain}</div>}
                  <div><strong className="text-slate-300">Squad:</strong> {team.players?.length || 0} Registered players</div>
                </div>
              </div>

              {/* Actions */}
              {isEditable && (
                <div className="flex items-center gap-2 mt-5 pt-3 border-t border-white/5" id={`team-actions-${team.id}`}>
                  <button
                    onClick={() => startEdit(team)}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 bg-white/5 text-slate-300 hover:text-white border border-white/10 hover:bg-white/10 rounded-xl text-xs font-semibold transition"
                    id={`btn-edit-team-${team.id}`}
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(team.id, team.name)}
                    className="p-2 bg-white/5 text-slate-400 hover:text-red-400 border border-white/10 hover:bg-white/10 rounded-xl transition"
                    id={`btn-delete-team-${team.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
