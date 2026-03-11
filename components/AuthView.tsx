import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { LogoFull, GoogleIcon } from './icons';

const AuthView: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleGoogleLogin = async () => {
    if (!acceptedTerms) return;
    
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
    <div className="min-h-screen relative flex flex-col items-center justify-center bg-[#0B1120] px-4 overflow-hidden">
      
      {/* Equity Line Background Graphic */}
      <div className="absolute inset-0 pointer-events-none z-0 flex items-end justify-center opacity-30">
        <svg className="w-full h-[60vh] min-w-[1000px]" preserveAspectRatio="none" viewBox="0 0 1000 400" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 400L50 380L100 390L150 350L200 360L250 280L300 290L350 200L400 210L450 150L500 160L550 100L600 110L650 50L700 60L750 20L800 30L850 10L900 15L950 0L1000 5V400H0Z" fill="url(#paint0_linear)" />
          <path d="M0 400L50 380L100 390L150 350L200 360L250 280L300 290L350 200L400 210L450 150L500 160L550 100L600 110L650 50L700 60L750 20L800 30L850 10L900 15L950 0L1000 5" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          <defs>
            <linearGradient id="paint0_linear" x1="500" y1="0" x2="500" y2="400" gradientUnits="userSpaceOnUse">
              <stop stopColor="#22C55E" stopOpacity="0.4"/>
              <stop offset="1" stopColor="#22C55E" stopOpacity="0"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Header / Logo */}
      <div className="z-10 flex flex-col items-center mb-8">
        <div className="bg-white p-3 rounded-full shadow-lg mb-4">
          <LogoFull className="h-8" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-1">Option DAX</h1>
        <p className="text-slate-400 text-sm">Trading Options Analytics</p>
      </div>

      {/* Login Card */}
      <div className="z-10 max-w-md w-full bg-[#1E293B] rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
        <div className="p-8">
          <h2 className="text-xl font-bold text-white mb-1">
            Accedi alla Piattaforma
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Accesso riservato ai frequentanti del corso
          </p>

          <div className="space-y-6">
            <button
              onClick={handleGoogleLogin}
              disabled={loading || !acceptedTerms}
              className={`w-full flex items-center justify-center gap-3 py-3 rounded-lg font-semibold transition-all duration-200 
                ${acceptedTerms 
                  ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-lg shadow-blue-500/30 transform active:scale-[0.98]' 
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
            >
              <GoogleIcon className="w-5 h-5" />
              <span>Accedi con Google</span>
            </button>

            <div className="bg-[#0F172A] border border-slate-700 rounded-xl p-4 flex items-start gap-3 cursor-pointer" onClick={() => setAcceptedTerms(!acceptedTerms)}>
              <div className="pt-0.5">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${acceptedTerms ? 'bg-blue-500 border-blue-500' : 'border-slate-500 bg-transparent'}`}>
                  {acceptedTerms && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed select-none">
                Dichiaro di aver frequentato il corso <strong>Option DAX</strong> e accetto che questa piattaforma è riservata esclusivamente ai partecipanti al corso. Mi impegno a non diffondere l'accesso o i contenuti all'esterno.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
              {error}
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="z-10 mt-8 text-center space-y-1">
        <p className="text-xs text-slate-500">
          © 2026 Option DAX Trading System
        </p>
        <p className="text-xs text-slate-500">
          Software by Opzionetika
        </p>
        <p className="text-xs text-slate-500">
          Tutti i diritti riservati di Vito Tarantini
        </p>
      </div>
    </div>
  );
};

export default AuthView;