import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, ArrowLeft, ShieldCheck, Wrench, CheckCircle2, XCircle } from 'lucide-react';
import type { AuditResult, AuditFinding } from '../lib/audit';

interface AuditViewProps {
  result: AuditResult;
  onBack: () => void;
}

/* ─── Animated circular gauge ─────────────────────────────────────────────────── */
const HealthGauge: React.FC<{ score: number }> = ({ score }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [dashOffset, setDashOffset] = useState(283);
  const requestRef = useRef<number>(0);

  const radius = 45;
  const circumference = 2 * Math.PI * radius;

  const getColor = (s: number) => {
    if (s >= 80) return { main: '#22c55e', glow: 'rgba(34,197,94,0.35)', label: 'Excellent' };
    if (s >= 60) return { main: '#eab308', glow: 'rgba(234,179,8,0.3)', label: 'Fair' };
    return { main: '#ef4444', glow: 'rgba(239,68,68,0.35)', label: 'Critical' };
  };

  useEffect(() => {
    const target = Math.min(100, Math.max(0, score));
    const targetOffset = circumference - (target / 100) * circumference;
    const duration = 1200;
    let start: number | null = null;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setAnimatedScore(Math.round(eased * target));
      setDashOffset(circumference - eased * (circumference - targetOffset));

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      }
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [score, circumference]);

  const colors = getColor(animatedScore);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-48 h-48">
        <div
          className="absolute inset-4 rounded-full blur-2xl opacity-60 transition-colors duration-700"
          style={{ background: colors.glow }}
        />
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e293b" strokeWidth="7" opacity="0.15" />
          <circle
            cx="50" cy="50" r={radius} fill="none"
            stroke={colors.main} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={dashOffset}
            style={{ transition: 'stroke 0.7s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold text-slate-900 tabular-nums">{animatedScore}</span>
          <span className="text-xs font-medium uppercase tracking-widest text-slate-400 mt-1">out of 100</span>
        </div>
      </div>
      <span
        className="px-4 py-1 rounded-full text-xs font-semibold uppercase tracking-wider text-white"
        style={{ backgroundColor: colors.main }}
      >
        {colors.label}
      </span>
    </div>
  );
};

/* ─── Model status badge ──────────────────────────────────────────────────────── */
const ModelStatusBadge: React.FC<{ modelId: string; status: 'success' | 'error'; findingsCount: number; error?: string }> = ({ modelId, status, findingsCount, error }) => {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${
      status === 'success' 
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
        : 'bg-red-50 text-red-600 border border-red-200'
    }`}>
      {status === 'success' 
        ? <CheckCircle2 className="w-3.5 h-3.5" />
        : <XCircle className="w-3.5 h-3.5" />
      }
      <span className="font-semibold">{modelId}</span>
      {status === 'success' 
        ? <span className="text-emerald-500">· {findingsCount} finding{findingsCount !== 1 ? 's' : ''}</span>
        : <span className="text-red-400 truncate max-w-[150px]" title={error}>· Failed</span>
      }
    </div>
  );
};

/* ─── Severity icon mapping ───────────────────────────────────────────────────── */
const severityConfig: Record<string, { icon: React.ReactNode; border: string; bg: string; text: string }> = {
  High: {
    icon: <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />,
    border: 'border-red-400/60',
    bg: 'bg-red-50',
    text: 'text-red-700',
  },
  Medium: {
    icon: <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />,
    border: 'border-amber-400/60',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
  },
  Low: {
    icon: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
    border: 'border-blue-400/60',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
  },
};

const categoryColors: Record<string, string> = {
  Contradiction: 'bg-purple-100 text-purple-700',
  Mismatch: 'bg-orange-100 text-orange-700',
  Compliance: 'bg-red-100 text-red-700',
};

/* ─── Model color mapping ─────────────────────────────────────────────────────── */
const modelColors: Record<string, string> = {
  Qwen: 'bg-slate-100 text-slate-600 border border-slate-200',
  Llama: 'bg-slate-100 text-slate-600 border border-slate-200',
  Mixtral: 'bg-slate-100 text-slate-600 border border-slate-200',
};

/* ─── Single audit card ───────────────────────────────────────────────────────── */
const AuditCard: React.FC<{ finding: AuditFinding; index: number }> = ({ finding, index }) => {
  const [showFix, setShowFix] = useState(false);
  const config = severityConfig[finding.severity] || severityConfig.Low;
  const catColor = categoryColors[finding.category] || 'bg-slate-100 text-slate-700';
  const modelColor = modelColors[finding.detected_by] || 'bg-slate-100 text-slate-600 border border-slate-200';

  return (
    <div
      className={`border-l-4 ${config.border} bg-white rounded-2xl shadow-[0_2px_12px_rgb(0,0,0,0.04)] overflow-hidden transition-all duration-300 hover:shadow-[0_4px_20px_rgb(0,0,0,0.08)]`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          {config.icon}
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-1">
              <h3 className="font-semibold text-slate-900 text-sm leading-tight">{finding.title}</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${catColor}`}>
                {finding.category}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${config.bg} ${config.text}`}>
                {finding.severity}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium ${modelColor}`}>
                Detected by: {finding.detected_by}
              </span>
            </div>
            {finding.productId && finding.productId !== 'Global' && (
              <p className="text-xs text-slate-400 font-mono truncate">ID: {finding.productId}</p>
            )}
            {finding.productId === 'Global' && (
              <p className="text-xs text-slate-400 font-medium">⚑ Store-wide issue</p>
            )}
          </div>
        </div>

        {/* Explanation */}
        <p className="text-sm text-slate-600 leading-relaxed ml-8">{finding.explanation}</p>

        {/* View Fix button */}
        {finding.fix_suggestion && (
          <div className="ml-8 mt-3">
            <button
              onClick={() => setShowFix(!showFix)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <Wrench className="w-3.5 h-3.5" />
              {showFix ? 'Hide Fix' : 'View Fix'}
              {showFix ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Fix suggestion panel */}
      {finding.fix_suggestion && (
        <div className={`overflow-hidden transition-all duration-300 ${showFix ? 'max-h-60' : 'max-h-0'}`}>
          <div className="px-5 pb-5">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800 leading-relaxed">
              <span className="font-semibold">Suggested fix:</span> {finding.fix_suggestion}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Main AuditView component ────────────────────────────────────────────────── */
export const AuditView: React.FC<AuditViewProps> = ({ result, onBack }) => {
  const highCount = result.findings.filter((f) => f.severity === 'High').length;
  const medCount = result.findings.filter((f) => f.severity === 'Medium').length;
  const lowCount = result.findings.filter((f) => f.severity === 'Low').length;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to data
        </button>

        {/* Score card */}
        <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-8">
          <div className="flex items-center gap-3 mb-6 justify-center">
            <ShieldCheck className="w-6 h-6 text-slate-400" />
            <h2 className="text-xl font-semibold text-slate-900">Store Health Report</h2>
          </div>

          <HealthGauge score={result.health_score} />

          {/* Summary */}
          <p className="text-center text-slate-500 mt-6 max-w-md mx-auto leading-relaxed">
            {result.summary}
          </p>

          {/* Model status badges */}
          <div className="flex items-center justify-center gap-3 mt-6 pt-6 border-t border-slate-100 flex-wrap">
            {result.modelResults.map((mr) => (
              <ModelStatusBadge
                key={mr.modelId}
                modelId={mr.modelId}
                status={mr.status}
                findingsCount={mr.findingsCount}
                error={mr.error}
              />
            ))}
          </div>

          {/* Stats bar */}
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-slate-600">{highCount} High</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-slate-600">{medCount} Medium</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-slate-600">{lowCount} Low</span>
            </div>
          </div>
        </div>

        {/* Findings list */}
        {result.findings.length > 0 ? (
          <div className="space-y-4 pb-12">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Consensus Findings ({result.findings.length})
            </h3>
            {result.findings.map((finding, i) => (
              <AuditCard key={i} finding={finding} index={i} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-[32px] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center">
            <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No Issues Found</h3>
            <p className="text-slate-500 text-sm">All models agree — your store data looks clean and consistent.</p>
          </div>
        )}
      </div>
    </div>
  );
};
