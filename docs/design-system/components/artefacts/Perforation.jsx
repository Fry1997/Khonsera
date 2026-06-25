import React from 'react';

/* Perforation — the ticket-strip cut. A dashed rule flanked by two punched
 * notches that read as holes through the stock (they show the surface behind).
 * Place it between a credential's header and its stub. `notchBg` should match
 * the surface the card sits ON (so the notches read as cut-outs). */
export function Perforation({ margin = 0, notchBg = 'var(--screen)', dark = false, style }) {
  const dash = dark ? 'rgba(243,239,230,0.22)' : 'var(--line)';
  const notchShadow = dark ? 'inset 0 1px 2px rgba(0,0,0,0.5)' : 'var(--sink)';
  return (
    <div style={{ position: 'relative', height: 1, margin: `0 ${margin}px`, ...style }}>
      <div style={{ position: 'absolute', left: 14, right: 14, top: 0, borderTop: `1.5px dashed ${dash}` }} />
      <div style={{ position: 'absolute', top: -8, left: -8, width: 16, height: 16, borderRadius: 999, background: notchBg, boxShadow: notchShadow }} />
      <div style={{ position: 'absolute', top: -8, right: -8, width: 16, height: 16, borderRadius: 999, background: notchBg, boxShadow: notchShadow }} />
    </div>
  );
}
