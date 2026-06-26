import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, updateDoc, doc, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, SystemLog } from '../types';
import { Shield, Users, Activity, Check, X, Edit2, AlertCircle } from 'lucide-react';

interface AdminPanelProps {
  currentUser: UserProfile;
}

export default function AdminPanel({ currentUser }: AdminPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<'admin' | 'manager' | 'operator' | 'viewer'>('viewer');

  const fetchUsersAndLogs = async () => {
    setLoading(true);
    try {
      // Fetch users
      const usersSnap = await getDocs(query(collection(db, 'users')));
      const usersList: UserProfile[] = [];
      usersSnap.forEach((docSnap) => {
        usersList.push(docSnap.data() as UserProfile);
      });
      setUsers(usersList);

      // Fetch logs
      const logsSnap = await getDocs(query(collection(db, 'system_logs'), limit(30)));
      const logsList: SystemLog[] = [];
      logsSnap.forEach((docSnap) => {
        logsList.push(docSnap.data() as SystemLog);
      });
      // Sort logs descending by timestamp
      logsList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(logsList);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch administrator data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndLogs();
  }, []);

  const handleUpdateRole = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      setUsers(users.map(u => u.uid === userId ? { ...u, role: newRole } : u));
      setEditingUserId(null);
    } catch (err: any) {
      console.error(err);
      alert('Failed to update user role.');
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    const updatedStatus = user.status === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        status: updatedStatus
      });
      setUsers(users.map(u => u.uid === user.uid ? { ...u, status: updatedStatus } : u));
    } catch (err: any) {
      console.error(err);
      alert('Failed to update status.');
    }
  };

  if (currentUser.role !== 'admin') {
    return (
      <div className="p-8 text-center" id="unauthorized-container">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-slate-400 mt-2">Only administrators can view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6" id="admin-panel-container">
      {/* Title */}
      <div className="flex items-center space-x-3" id="admin-panel-header">
        <Shield className="w-8 h-8 text-yellow-500" />
        <div>
          <h1 className="text-2xl font-display font-extrabold text-white">ADMINISTRATIVE CONTROL CENTER</h1>
          <p className="text-sm text-slate-400">Manage user credentials, security clearance levels, and review platform audit logs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8" id="admin-bento-grid">
        {/* User Management */}
        <div className="xl:col-span-2 glass-panel rounded-2xl p-6 space-y-6 border border-white/5" id="user-management-card">
          <div className="flex items-center justify-between" id="user-management-header">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-bold text-white">Registered Users</h2>
            </div>
            <span className="text-xs font-mono text-slate-500">{users.length} total users</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 font-mono text-sm" id="users-loading">
              LOADING CREDENTIAL RECORDS...
            </div>
          ) : (
            <div className="overflow-x-auto" id="users-table-container">
              <table className="w-full text-left border-collapse" id="users-table">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-mono tracking-wider uppercase text-slate-400">
                    <th className="pb-3">User</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Joined</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {users.map((user) => (
                    <tr key={user.uid} className="hover:bg-white/[0.01] transition" id={`user-row-${user.uid}`}>
                      <td className="py-3">
                        <div className="flex items-center space-x-3">
                          <img src={user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.username}`} alt={user.fullName} className="w-8 h-8 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                          <div>
                            <div className="font-semibold text-slate-200">{user.fullName}</div>
                            <div className="text-xs text-slate-400">@{user.username} • {user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        {editingUserId === user.uid ? (
                          <div className="flex items-center space-x-1">
                            <select
                              value={newRole}
                              onChange={(e) => setNewRole(e.target.value as any)}
                              className="bg-slate-900 border border-white/15 rounded px-2 py-1 text-xs text-white"
                              id={`select-role-${user.uid}`}
                            >
                              <option value="admin">Admin</option>
                              <option value="manager">Manager</option>
                              <option value="operator">Operator</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <button
                              onClick={() => handleUpdateRole(user.uid)}
                              className="p-1 text-green-500 hover:bg-green-500/10 rounded"
                              id={`save-role-${user.uid}`}
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                              id={`cancel-role-${user.uid}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-full font-mono uppercase">
                              {user.role}
                            </span>
                            {user.uid !== currentUser.uid && (
                              <button
                                onClick={() => {
                                  setEditingUserId(user.uid);
                                  setNewRole(user.role);
                                }}
                                className="p-1 text-slate-500 hover:text-white rounded"
                                title="Edit Role"
                                id={`edit-role-btn-${user.uid}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                          user.status === 'active' 
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-slate-400 font-mono">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        {user.uid !== currentUser.uid ? (
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`text-xs px-2.5 py-1 rounded font-medium border transition ${
                              user.status === 'active'
                                ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                : 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                            }`}
                            id={`status-toggle-${user.uid}`}
                          >
                            {user.status === 'active' ? 'Suspend' : 'Activate'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500 italic">Self</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Audit Logs */}
        <div className="glass-panel rounded-2xl p-6 space-y-6 border border-white/5 flex flex-col h-[500px]" id="system-logs-card">
          <div className="flex items-center space-x-2 shrink-0">
            <Activity className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-bold text-white">Audit Logs</h2>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 font-mono text-sm">
              FETCHING AUDIT TRAIL...
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1" id="logs-list">
              {logs.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-12 font-mono">NO SYSTEM LOGS RECORDED</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-3 bg-white/5 border border-white/5 rounded-xl text-xs space-y-1" id={`log-item-${log.id}`}>
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span className="text-yellow-500 font-semibold">{log.userName}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-200">{log.action}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
