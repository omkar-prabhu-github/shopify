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

  const color = val >= 80 ? 'var(--p-color-bg-fill-success)' :
                val >= 60 ? 'var(--p-color-bg-fill-caution)' :
                'var(--p-color-bg-fill-critical)';
  const offset = circ - (val / 100) * circ;

  return (
    <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
      <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--p-color-bg-fill-secondary)" strokeWidth="10" />
        <circle cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke 0.7s, stroke-dashoffset 0.05s' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 38, fontWeight: 700, color: 'var(--p-color-text)', fontVariantNumeric: 'tabular-nums' }}>{val}</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--p-color-text-subdued)', textTransform: 'uppercase', letterSpacing: 1.5 }}>of 100</span>
      </div>
    </div>
  );
};
