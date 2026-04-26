import React, { useState } from 'react';

export interface ActionItem { 
  title: string; 
  principle: string; 
  what: string; 
  why: string; 
  how: string; 
  impact: string; 
}

export const ActionItemCard: React.FC<{ item: ActionItem; bg: string; border: string; accent: string }> = ({ item, bg, border, accent }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: `1px solid ${border}`,
      borderLeft: `4px solid ${accent}`, overflow: 'hidden',
      animation: 'fadeSlideIn 0.4s both',
    }}>
      <div style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{item.title}</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: bg, color: accent, textTransform: 'uppercase' }}>{item.impact}</span>
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#f1f5f9', color: '#475569' }}>Principle {item.principle}</span>
            </div>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.5, margin: 0 }}>{item.what}</p>
            <button onClick={() => setOpen(!open)} style={{
              marginTop: 8, fontSize: 12, fontWeight: 600, color: '#2563eb',
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}>
              {open ? '▲ Hide details' : '▼ View details'}
            </button>
          </div>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 18px 14px' }}>
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 14px', fontSize: 13, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div><strong>Why:</strong> {item.why}</div>
            <div><strong>How:</strong> {item.how}</div>
          </div>
        </div>
      )}
    </div>
  );
};
