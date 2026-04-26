import React from 'react';
import { Loader2 } from 'lucide-react';

export const ExtractingView: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] max-w-sm w-full flex flex-col items-center text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl opacity-50 animate-pulse"></div>
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin relative z-10" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Extracting Data</h2>
        <p className="text-slate-500 text-sm">Please wait while we securely connect to your store and pull catalog data...</p>
      </div>
    </div>
  );
};
