import React from 'react';
import { Icon } from '../primitives/Icon.jsx';

/* Chip — a soft-extruded mini tile holding a single glyph. The object-identity
 * marker: charcoal = emphasis (places, credentials), soft = neutral, and the
 * tinted tones (gold/sage/rust/slate/plum) carry status or domain colour. */
const TONES = {
  soft:  { bg: 'var(--widget-2)',  fg: 'var(--ink-2)',   lift: true },
  char:  { bg: 'var(--char)',      fg: 'var(--cream)',   lift: false },
  gold:  { bg: 'var(--gold-tint)', fg: 'var(--gold-2)',  lift: true },
  slate: { bg: 'var(--slate-soft)',fg: 'var(--slate-2)', lift: true },
  sage:  { bg: 'var(--sage-soft)', fg: 'var(--sage)',    lift: true },
  rust:  { bg: 'var(--rust-soft)', fg: 'var(--rust)',    lift: true },
  plum:  { bg: 'var(--plum-soft)', fg: 'var(--plum)',    lift: true },
};

export function Chip({ icon, tone = 'soft', size = 36, style }) {
  const t = TONES[tone] || TONES.soft;
  return (
    <span style={{
      display: 'inline-grid', placeItems: 'center', width: size, height: size,
      borderRadius: Math.round(size * 0.32), background: t.bg, color: t.fg, flex: 'none',
      boxShadow: t.lift ? 'var(--lift-sm)' : 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 5px rgba(28,22,14,0.3)',
      ...style,
    }}>
      <Icon name={icon} size={Math.round(size * 0.5)} />
    </span>
  );
}
