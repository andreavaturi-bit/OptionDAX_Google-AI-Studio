import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { LogoFull, GoogleIcon } from './icons';

const AuthView: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-700 overflow-hidden">
        <div className="p-8">
          <div className="flex justify-center mb-8">
            <LogoFull className="h-10" />
          </div>
          
          <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">
            Bentornato nel Mercato
          </h2>
          <p className="text-slate-500 dark:text-gray-400 text-center text-sm mb-8">
            Accedi per gestire le tue opzioni
          </p>

          <div className="space-y-4 mb-6">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-600 text-slate-700 dark:text-white font-semibold py-3 rounded-lg transition-all transform active:scale-[0.98] disabled:opacity-50"
            >
              <GoogleIcon className="w-5 h-5" />
              <span>Continua con Google</span>
            </button>
          </div>

          {error && (
            <div className="p-3 bg-loss/10 border border-loss/20 rounded-lg text-loss text-sm text-center">
              {error}
            </div>
          )}
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