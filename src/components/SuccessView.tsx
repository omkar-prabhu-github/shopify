import React from 'react';
import { CheckCircle, Copy, Download, ShieldCheck } from 'lucide-react';
import JsonView from '@uiw/react-json-view';

interface SuccessViewProps {
  data: any;
  onAudit?: () => void;
}

export const SuccessView: React.FC<SuccessViewProps> = ({ data, onAudit }) => {
  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    alert('Copied to clipboard!');
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'store_data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto bg-white rounded-[32px] p-8 mt-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-slate-100 pb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Extraction Successful</h2>
              <p className="text-slate-500">Your store data has been successfully processed.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-medium transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span>Copy to Clipboard</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors shadow-lg shadow-blue-600/20"
            >
              <Download className="w-4 h-4" />
              <span>Download JSON</span>
            </button>
            {onAudit && (
              <button
                onClick={onAudit}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-medium transition-colors shadow-lg shadow-emerald-600/20"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Audit Store</span>
              </button>
            )}
          </div>
        </div>

        <div className="bg-gray-900 text-green-400 p-6 rounded-2xl overflow-auto max-h-[70vh] w-full custom-scroll">
           <JsonView 
              value={data} 
              displayDataTypes={false}
              collapsed={2}
              style={{
                 '--w-rjv-background-color': 'transparent',
                 '--w-rjv-color': '#4ade80',
                 '--w-rjv-key-string': '#93c5fd',
                 '--w-rjv-info-color': '#6b7280',
              } as React.CSSProperties}
           />
        </div>
      </div>
    </div>
  );
};
