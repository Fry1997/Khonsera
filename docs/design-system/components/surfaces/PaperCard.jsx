import React from 'react';

/* PaperCard — the workhorse surface. A single sheet of heavy cotton stock that
 * LIFTS off the desk (or the same stock in charcoal, `dark`). Carries the dry
 * paper tooth + letterpress deboss via .pg / .pg-d. Radius follows the corner
 * family: hero 18 · tile 14 (default) · inner 11. */
const RADIUS = { hero: 18, tile: 14, inner: 11 };

export function PaperCard({
  dark = false, radius = 'tile', elevation = 'lift', padding = 16,
  className = '', style, children, ...rest
}) {
  const r = typeof radius === 'number' ? radius : (RADIUS[radius] || 14);
  const base = dark
    ? { background: 'var(--char)', color: 'var(--cream)' }
    : { background: 'var(--widget)', boxShadow: `var(--${elevation === 'sm' ? 'lift-sm' : 'lift'})`, border: '1px solid var(--line)' };
  return (
    <div className={[dark ? 'pg-d' : 'pg', className].filter(Boolean).join(' ')}
      style={{ position: 'relative', borderRadius: r, padding, ...base, ...style }} {...rest}>
      {children}
    </div>
  );
}
