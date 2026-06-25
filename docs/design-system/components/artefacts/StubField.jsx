import React from 'react';
import { WayfindBadge } from './WayfindBadge.jsx';

/* StubField — a boarding-pass read-out: a small mono eyebrow above a tabular
 * value. The atom every credential stub is built from. Set `badge` to render
 * the value as a charcoal WayfindBadge (platform / gate / seat). */
export function StubField({ label, value, badge = false, align = 'left', style }) {
  return (
    <div style={{ textAlign: align, minWidth: 0, ...style }}>
      <div className="eyb" style={{ fontSize: 8.5, color: 'var(--ink-faint)', letterSpacing: '0.18em', marginBottom: 5, whiteSpace: 'nowrap' }}>{label}</div>
      {badge
        ? <WayfindBadge>{value || '—'}</WayfindBadge>
        : <div className="mono engr" style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.01em', color: value ? 'var(--ink)' : 'var(--ink-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || '—'}</div>}
    </div>
  );
}
