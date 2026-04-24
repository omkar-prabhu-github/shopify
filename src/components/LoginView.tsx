import React, { useState } from 'react';
import { ShieldCheck, Key, ExternalLink } from 'lucide-react';

interface LoginViewProps {
  onExtract: (domain: string, token: string) => void;
  error?: string;
}

export const LoginView: React.FC<LoginViewProps> = ({ onExtract, error }) => {
  const [mode, setMode] = useState<'oauth' | 'manual'>('oauth');
  const [domain, setDomain] = useState('');
  const [token, setToken] = useState('');
  const [oauthDomain, setOauthDomain] = useState('');

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (domain && token) {
      onExtract(domain, token);
    }
  };

  const handleOAuthInstall = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oauthDomain) return;

    // Normalize: ensure it ends with .myshopify.com
    let shop = oauthDomain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!shop.includes('.')) {
      shop = `${shop}.myshopify.com`;
    }

    // Redirect to our backend OAuth install route
    window.location.href = `http://localhost:3000/api/auth?shop=${shop}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] max-w-md w-full">
        <div className="mb-8 text-center">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-2">AgentLens</h1>
          <p className="text-slate-500">Connect your Shopify store to begin.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl text-sm border border-red-100">
            {error}
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 rounded-2xl p-1 mb-6">
          <button
            type="button"
            onClick={() => setMode('oauth')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              mode === 'oauth'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            OAuth Install
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              mode === 'manual'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Key className="w-4 h-4" />
            Manual Token
          </button>
        </div>

        {/* OAuth Mode */}
        {mode === 'oauth' && (
          <form onSubmit={handleOAuthInstall} className="space-y-5">
            <div>
              <label htmlFor="oauth-domain" className="block text-sm font-medium text-slate-700 mb-2">
                Store Name
              </label>
              <div className="relative">
                <input
                  id="oauth-domain"
                  type="text"
                  required
                  value={oauthDomain}
                  onChange={(e) => setOauthDomain(e.target.value)}
                  placeholder="e.g. mystore"
                  className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none text-slate-900 placeholder:text-slate-400 pr-40"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">
                  .myshopify.com
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                You'll be redirected to Shopify to authorize access.
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-full font-medium transition-all shadow-lg shadow-green-600/20 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              Install with Shopify
              <ExternalLink className="w-4 h-4 opacity-60" />
            </button>
          </form>
        )}

        {/* Manual Mode */}
        {mode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-5">
            <div>
              <label htmlFor="domain" className="block text-sm font-medium text-slate-700 mb-2">
                Store Domain
              </label>
              <input
                id="domain"
                type="text"
                required
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. mystore.myshopify.com"
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div>
              <label htmlFor="token" className="block text-sm font-medium text-slate-700 mb-2">
                Admin API Access Token
              </label>
              <input
                id="token"
                type="password"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="shpat_..."
                className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors shadow-lg shadow-blue-600/20"
            >
              Extract Store Data
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
