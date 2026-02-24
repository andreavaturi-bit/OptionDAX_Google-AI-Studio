import React, { useState, useEffect } from 'react';
import usePortfolioStore from '../store/portfolioStore';
import useUserStore from '../store/userStore';
import { UserProfile } from '../types';

const AdminDashboard: React.FC = () => {
    const { structures } = usePortfolioStore();
    const { profile, fetchAllProfiles } = useUserStore();
    const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        const users = await fetchAllProfiles();
        setAllUsers(users);
        setLoading(false);
    };

    if (profile?.role !== 'admin') {
        return <div className="p-8 text-center text-slate-500">Accesso negato. Area riservata agli amministratori.</div>;
    }

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pannello di Amministrazione</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* List of Users */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 bg-slate-50 dark:bg-gray-700/50 border-b border-slate-200 dark:border-gray-700 flex justify-between items-center">
                        <h2 className="font-bold text-slate-700 dark:text-gray-200">Utenti Registrati</h2>
                        <button onClick={loadUsers} className="text-xs text-accent hover:underline">Aggiorna</button>
                    </div>
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Caricamento utenti...</div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
                            {allUsers.length === 0 ? (
                                <div className="p-4 text-center text-slate-500 text-sm">Nessun utente trovato.</div>
                            ) : (
                                allUsers.map(u => (
                                    <div key={u.id} className="p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-gray-700/50">
                                        <div>
                                            <div className="font-medium text-slate-800 dark:text-white">{u.email}</div>
                                            <div className="text-xs text-slate-500">Ruolo: {u.role}</div>
                                        </div>
                                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Attivo</span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* List of Structures (Read-only view for Admin) */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 bg-slate-50 dark:bg-gray-700/50 border-b border-slate-200 dark:border-gray-700">
                        <h2 className="font-bold text-slate-700 dark:text-gray-200">Strategie Attive</h2>
                        <p className="text-xs text-slate-500 mt-1">Visibili a tutti gli utenti (default)</p>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
                        {structures.map(s => (
                            <div key={s.id} className="p-4 flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-slate-800 dark:text-white">{s.tag}</div>
                                    <div className="text-xs text-slate-500">{new Date(s.createdAt || '').toLocaleDateString()}</div>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${s.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {s.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
