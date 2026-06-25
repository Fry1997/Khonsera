import React from 'react';

/* StatePill — the mono, uppercase status capsule. Covers the two pill jobs in
 * the system: feasibility ("comfortable / tight / risky") and lifecycle
 * ("booked / planned / live / done"). A leading dot is on by default; `solid`
 * inverts to a filled capsule for the loudest states. */
const STATES = {
  comfortable: { c: 'var(--sage)',  soft: 'var(--sage-soft)',  label: 'Comfortable', solidFg: '#f6f7ef' },
  tight:       { c: 'var(--amber)', soft: 'var(--amber-soft)', label: 'Tight',       solidFg: '#fdf8e9' },
  risky:       { c: 'var(--rust)',  soft: 'var(--rust-soft)',  label: 'Risky',       solidFg: '#fdeae6' },
  live:        { c: 'var(--gold-2)',soft: 'var(--gold-tint)',  label: 'Live',        solidFg: '#fff' },
  booked:      { c: 'var(--sage)',  soft: 'var(--sage-soft)',  label: 'Booked',      solidFg: '#f6f7ef' },
  planned:     { c: 'var(--slate-2)',soft: 'var(--slate-soft)',label: 'Planned',     solidFg: '#fff' },
  done:        { c: 'var(--ink-faint)', soft: 'var(--ink-soft)', label: 'Done',      solidFg: '#fff' },
  offline:     { c: 'var(--ink-dim)', soft: 'var(--ink-soft)', label: 'Saved offline', solidFg: '#fff' },
};

export function StatePill({ state = 'comfortable', children, dot = true, solid = false, style }) {
  const s = STATES[state] || STATES.comfortable;
  const base = solid
    ? { background: s.c, color: s.solidFg }
    : { background: s.soft, color: s.c };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px',
      borderRadius: 4, fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap', ...base, ...style,
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor', flex: 'none' }} />}
      {children || s.label}
    </span>
  );
}
