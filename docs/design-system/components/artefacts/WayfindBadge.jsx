import React from 'react';

/* WayfindBadge — the crisp charcoal data cell from physical signage: the
 * platform, gate or seat number, pressed into a dark plate (or a quiet gold
 * cell with `tone="soft"`). The single most operationally important number on
 * a card always reads as one of these. */
export function WayfindBadge({ children, tone = 'dark', style }) {
  const dark = tone !== 'soft';
  return (
    <span className={`mono ${dark ? 'engr-d' : 'engr'}`} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 26, height: 24, padding: '0 8px', borderRadius: 7,
      fontSize: 12.5, fontWeight: 600, letterSpacing: '0.01em',
      background: dark ? 'var(--char)' : 'var(--gold-tint)',
      color: dark ? 'var(--cream)' : 'var(--gold-2)',
      boxShadow: dark
        ? 'inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(28,22,14,0.28)'
        : 'inset 0 0 0 1px rgba(176,158,124,0.3)',
      ...style,
    }}>{children}</span>
  );
}
