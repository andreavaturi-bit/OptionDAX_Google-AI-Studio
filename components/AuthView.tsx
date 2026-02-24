import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { LogoFull, CheckBadgeIcon } from './icons';

const AuthView: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      if (error) {
        setError(error.message);
      } else {
        setEmailSent(true);
      }
    }
    setLoading(false);
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-gray-900 px-4 text-center">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-slate-200 dark:border-gray-700">
          <div className="flex justify-center mb-6 text-accent">
            <div className="p-4 bg-accent/10 rounded-full">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Controlla la tua Email</h2>
          <p className="text-slate-600 dark:text-gray-400 mb-8">
            Abbiamo inviato un link di conferma a <span className="font-bold text-slate-900 dark:text-white">{email}</span>. 
            Clicca sul link per attivare il tuo account professionale.
          </p>
          <button
            onClick={() => setEmailSent(false)}
            className="text-sm font-semibold text-accent hover:underline"
          >
            &larr; Torna al login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 overflow-hidden">
        <div className="p-8">
          <div className="flex justify-center mb-8">
            <LogoFull className="h-10" />
          </div>
          
          <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">
            {isLogin ? 'Bentornato nel Mercato' : 'Crea il tuo Account'}
          </h2>
          <p className="text-slate-500 dark:text-gray-400 text-center text-sm mb-8">
            {isLogin ? 'Accedi per gestire le tue opzioni' : 'Inizia la tua analisi professionale oggi'}
          </p>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1">Email</label>
              <input
                type="email"
                required
                className="w-full bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@azienda.com"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1">Password</label>
              <input
                type="password"
                required
                className="w-full bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:ring-2 focus:ring-accent outline-none transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-loss text-sm text-center">
                {error}
              </div>
            )}

            <button
              disabled={loading}
              type="submit"
              className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-3 rounded-lg shadow-lg shadow-accent/20 transition-all transform active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Elaborazione...' : isLogin ? 'Accedi' : 'Registrati'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm font-semibold text-slate-500 dark:text-gray-400 hover:text-accent transition-colors"
            >
              {isLogin ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
            </button>
          </div>
        </div>
        
        <div className="bg-slate-50 dark:bg-gray-700/30 p-4 border-t border-slate-200 dark:border-gray-700 text-center">
          <p className="text-[10px] text-slate-400 dark:text-gray-500 font-medium">
            Sviluppato per trader professionisti. I dati sono crittografati end-to-end.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;