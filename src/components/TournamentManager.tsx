import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Tournament, UserProfile } from '../types';
import { Trophy, Calendar, MapPin, Plus, Trash2, Edit, Check, Settings, Eye } from 'lucide-react';

interface TournamentManagerProps {
  currentUser: UserProfile;
  activeTournament: Tournament | null;
  setActiveTournament: (t: Tournament | null) => void;
}

export default function TournamentManager({ currentUser, activeTournament, setActiveTournament }: TournamentManagerProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [logo, setLogo] = useState('');
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorLogo, setSponsorLogo] = useState('');
  const [season, setSeason] = useState('2026');
  const [venue, setVenue] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [banner, setBanner] = useState('');

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'tournaments'));
      const list: Tournament[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Tournament);
      });
      setTournaments(list);

      // Default active tournament if none set and list is not empty
      if (!activeTournament && list.length > 0) {
        // Find the active one or first one
        const activeItem = list.find(t => t.status === 'active') || list[0];
        setActiveTournament(activeItem);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `tournament_${Date.now()}`;
    const newTournament: Tournament = {
      id,
      name,
      logo: logo || 'https://api.dicebear.com/7.x/identicon/svg?seed=' + encodeURIComponent(name),
      sponsorName,
      sponsorLogo: sponsorLogo || 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(sponsorName || 'Sponsor'),
      season,
      venue,
      organizer,
      description,
      status: 'active',
      startDate,
      endDate,
      banner: banner || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=60',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'tournaments', id), newTournament);
      
      // Add log
      const logId = `log_${Date.now()}`;
      await setDoc(doc(db, 'system_logs', logId), {
        id: logId,
        userId: currentUser.uid,
        userName: currentUser.fullName,
        action: `Created new tournament: ${name}`,
        timestamp: new Date().toISOString()
      });

      // Reset form & reload
      setShowAddForm(false);
      resetForm();
      fetchTournaments();
    } catch (err) {
      console.error(err);
      alert('Error creating tournament');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    try {
      const updatedData = {
        name,
        logo,
        sponsorName,
        sponsorLogo,
        season,
        venue,
        organizer,
        description,
        startDate,
        endDate,
        banner
      };
      await updateDoc(doc(db, 'tournaments', editingId), updatedData);
      
      // Update log
      const logId = `log_${Date.now()}`;
      await setDoc(doc(db, 'system_logs', logId), {
        id: logId,
        userId: currentUser.uid,
        userName: currentUser.fullName,
        action: `Updated tournament: ${name}`,
        timestamp: new Date().toISOString()
      });

      setEditingId(null);
      resetForm();
      fetchTournaments();
    } catch (err) {
      console.error(err);
      alert('Error updating tournament');
    }
  };

  const handleDelete = async (id: string, tName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${tName}? All associated data could be lost.`)) return;

    try {
      await deleteDoc(doc(db, 'tournaments', id));
      
      if (activeTournament?.id === id) {
        setActiveTournament(null);
      }

      // Add log
      const logId = `log_${Date.now()}`;
      await setDoc(doc(db, 'system_logs', logId), {
        id: logId,
        userId: currentUser.uid,
        userName: currentUser.fullName,
        action: `Deleted tournament: ${tName}`,
        timestamp: new Date().toISOString()
      });

      fetchTournaments();
    } catch (err) {
      console.error(err);
      alert('Error deleting tournament');
    }
  };

  const startEdit = (t: Tournament) => {
    setEditingId(t.id);
    setName(t.name);
    setLogo(t.logo);
    setSponsorName(t.sponsorName);
    setSponsorLogo(t.sponsorLogo);
    setSeason(t.season);
    setVenue(t.venue);
    setOrganizer(t.organizer);
    setDescription(t.description);
    setStartDate(t.startDate);
    setEndDate(t.endDate);
    setBanner(t.banner);
    setShowAddForm(true);
  };

  const resetForm = () => {
    setName('');
    setLogo('');
    setSponsorName('');
    setSponsorLogo('');
    setSeason('2026');
    setVenue('');
    setOrganizer('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setBanner('');
  };

  const isEditable = currentUser.role === 'admin' || currentUser.role === 'manager';

  return (
    <div className="space-y-8 p-6" id="tournament-manager-container">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" id="tm-header">
        <div className="flex items-center space-x-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-display font-extrabold text-white">TOURNAMENT DIRECTORY</h1>
            <p className="text-sm text-slate-400">Manage and coordinate multi-season championship configurations.</p>
          </div>
        </div>

        {isEditable && !showAddForm && (
          <button
            onClick={() => { resetForm(); setEditingId(null); setShowAddForm(true); }}
            id="btn-add-tournament"
            className="flex items-center space-x-2 bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 font-bold py-2.5 px-4 rounded-xl shadow-lg hover:from-yellow-400 hover:to-amber-500 transition active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>New Tournament</span>
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {showAddForm && (
        <form onSubmit={editingId ? handleUpdate : handleCreate} className="glass-panel rounded-2xl p-6 sm:p-8 border border-white/5 space-y-6" id="tournament-form">
          <div className="flex justify-between items-center border-b border-white/10 pb-4">
            <h2 className="text-lg font-bold text-white">
              {editingId ? 'Edit Tournament Settings' : 'Create New Tournament'}
            </h2>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); resetForm(); }}
              className="text-sm text-slate-400 hover:text-white"
              id="btn-cancel-tournament"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Tournament Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none focus:border-yellow-500/50"
                  placeholder="e.g. AFC Champions League"
                  id="form-tournament-name"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Tournament Logo URL</label>
                <input
                  type="url"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none focus:border-yellow-500/50"
                  placeholder="https://example.com/logo.png"
                  id="form-tournament-logo"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Season Year</label>
                  <input
                    type="text"
                    required
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none"
                    placeholder="2026"
                    id="form-tournament-season"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Organizer</label>
                  <input
                    type="text"
                    required
                    value={organizer}
                    onChange={(e) => setOrganizer(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none"
                    placeholder="e.g. AFC"
                    id="form-tournament-organizer"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Primary Venue Name</label>
                <input
                  type="text"
                  required
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none"
                  placeholder="e.g. Khalifa International Stadium"
                  id="form-tournament-venue"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none"
                    id="form-tournament-start"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono tracking-wider uppercase text-slate-400">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none"
                    id="form-tournament-end"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Sponsor Name</label>
                  <input
                    type="text"
                    value={sponsorName}
                    onChange={(e) => setSponsorName(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none"
                    placeholder="e.g. Qatar Airways"
                    id="form-tournament-sponsor"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Sponsor Logo URL</label>
                  <input
                    type="url"
                    value={sponsorLogo}
                    onChange={(e) => setSponsorLogo(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none"
                    placeholder="Sponsor Logo Image URL"
                    id="form-tournament-sponsor-logo"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Banner Background URL</label>
                <input
                  type="url"
                  value={banner}
                  onChange={(e) => setBanner(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2.5 px-4 text-white text-sm outline-none font-sans"
                  placeholder="https://images.unsplash.com/... or keep blank"
                  id="form-tournament-banner"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono tracking-wider uppercase text-slate-400">Tournament Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl py-2 px-4 text-white text-sm outline-none resize-none"
                  placeholder="Describe details of this competitive event..."
                  id="form-tournament-description"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            id="form-tournament-submit"
            className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 text-slate-950 font-bold py-3 px-4 rounded-xl hover:from-yellow-400 hover:to-amber-500 transition duration-300 shadow-lg"
          >
            {editingId ? 'Save Configuration Updates' : 'Publish Tournament Configuration'}
          </button>
        </form>
      )}

      {/* Directory List */}
      {loading ? (
        <div className="py-24 text-center text-slate-400 font-mono tracking-wider text-sm" id="tm-loading">
          RETRIEVING TOURNAMENT DIRECTORY RECORDS...
        </div>
      ) : tournaments.length === 0 ? (
        <div className="glass-panel rounded-2xl py-20 text-center border border-white/5" id="tm-empty-state">
          <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white">No Tournaments Configured</h2>
          <p className="text-slate-400 mt-2 max-w-md mx-auto">Create a tournament to begin managing groups, teams, player rosters, and live OBS overlay graphics.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="tournaments-grid">
          {tournaments.map((t) => {
            const isActive = activeTournament?.id === t.id;
            return (
              <div 
                key={t.id}
                id={`tournament-card-${t.id}`}
                className={`glass-panel rounded-2xl overflow-hidden flex flex-col relative transition duration-300 group hover:-translate-y-1 ${
                  isActive ? 'border-yellow-500/35 shadow-[0_0_20px_rgba(197,168,92,0.1)]' : 'border-white/5 hover:border-white/15'
                }`}
              >
                {/* Banner Header */}
                <div className="h-32 relative bg-slate-950" id={`t-card-banner-${t.id}`}>
                  {t.banner ? (
                    <img src={t.banner} alt={t.name} className="w-full h-full object-cover opacity-40 group-hover:opacity-50 transition" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-950 opacity-40" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                  
                  {/* Status Badges */}
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className="text-[10px] px-2 py-0.5 bg-slate-950/80 text-slate-300 border border-white/10 rounded-full font-mono">
                      {t.season}
                    </span>
                    {isActive && (
                      <span className="text-[10px] px-2 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/25 rounded-full font-mono flex items-center gap-1">
                        <Check className="w-3 h-3" /> ACTIVE HOST
                      </span>
                    )}
                  </div>
                </div>

                {/* Body Details */}
                <div className="p-6 flex-1 flex flex-col space-y-4" id={`t-card-body-${t.id}`}>
                  {/* Logo & Name */}
                  <div className="flex items-start space-x-4">
                    {t.logo ? (
                      <img src={t.logo} alt={t.name} className="w-12 h-12 rounded-xl object-contain bg-white/5 border border-white/10 p-1.5" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-yellow-500 font-display">T</div>
                    )}
                    <div>
                      <h3 className="font-display font-bold text-lg text-white group-hover:text-yellow-400 transition leading-snug">
                        {t.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">{t.organizer} Championship Series</p>
                    </div>
                  </div>

                  {/* Description */}
                  {t.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 h-8 leading-relaxed">
                      {t.description}
                    </p>
                  )}

                  {/* Key Meta */}
                  <div className="grid grid-cols-2 gap-4 pt-2 text-xs border-t border-white/5 font-mono text-slate-400" id={`t-card-meta-${t.id}`}>
                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-yellow-500" />
                      <span className="truncate">{new Date(t.startDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-yellow-500" />
                      <span className="truncate">{t.venue}</span>
                    </div>
                  </div>

                  {/* Sponsor Foot */}
                  {t.sponsorName && (
                    <div className="flex items-center justify-between pt-3 border-t border-white/5 text-[10px]" id={`t-card-sponsor-${t.id}`}>
                      <span className="font-mono text-slate-500 uppercase">TITLE SPONSOR</span>
                      <div className="flex items-center space-x-1.5">
                        {t.sponsorLogo ? (
                          <img src={t.sponsorLogo} alt={t.sponsorName} className="w-4 h-4 object-contain" referrerPolicy="no-referrer" />
                        ) : null}
                        <span className="text-slate-300 font-medium">{t.sponsorName}</span>
                      </div>
                    </div>
                  )}

                  {/* Actions buttons */}
                  <div className="pt-4 mt-auto flex items-center gap-2" id={`t-card-actions-${t.id}`}>
                    <button
                      onClick={() => setActiveTournament(t)}
                      className={`flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 text-xs font-semibold rounded-xl border transition ${
                        isActive
                          ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                          : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                      }`}
                      id={`btn-select-tournament-${t.id}`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isActive ? 'Host Active' : 'Set Active'}</span>
                    </button>

                    {isEditable && (
                      <>
                        <button
                          onClick={() => startEdit(t)}
                          className="p-2 bg-white/5 border border-white/10 text-slate-400 hover:text-white rounded-xl transition"
                          title="Edit Settings"
                          id={`btn-edit-tournament-${t.id}`}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {currentUser.role === 'admin' && (
                          <button
                            onClick={() => handleDelete(t.id, t.name)}
                            className="p-2 bg-white/5 border border-white/10 text-slate-400 hover:text-red-400 rounded-xl transition"
                            title="Delete Configuration"
                            id={`btn-delete-tournament-${t.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
