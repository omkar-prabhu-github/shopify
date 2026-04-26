import React, { useState, useEffect } from 'react';

export const HealthGauge: React.FC<{ score: number }> = ({ score }) => {
  const [val, setVal] = useState(0);
  const radius = 52, circ = 2 * Math.PI * radius;

  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const animate = (now: number) => {
      const p = Math.min((now - start) / 1400, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * score));
      if (p < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const color = val >= 80 ? '#22c55e' : val >= 60 ? '#eab308' : '#ef4444';
  const offset = circ - (val / 100) * circ;

  return (
    <div style={{ position: 'relative', width: 160, height: 160, margin: '0 auto' }}>
      <div style={{
        position: 'absolute', inset: 16, borderRadius: '50%', filter: 'blur(20px)', opacity: 0.4,
        background: color, transition: 'background 0.7s',
      }} />
      <svg width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle cx="80" cy="80" r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke 0.7s, stroke-dashoffset 0.05s' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 42, fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{val}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.5 }}>of 100</span>
      </div>
    </div>
  );
};
