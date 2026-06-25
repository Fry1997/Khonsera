import React from 'react';

/* IconButton — a round header action. The default is a soft-extruded chip on
 * the page; `gold` for a quiet accent, `ink` for charcoal weight. */
export function IconButton({ icon, tone = 'soft', size = 36, className = '', ...rest }) {
  const cls = ['icon-button', tone === 'gold' && 'gold', tone === 'ink' && 'ink', className]
    .filter(Boolean).join(' ');
  const lift = tone === 'soft'
    ? { background: 'var(--widget)', boxShadow: 'var(--lift-sm)', color: 'var(--ink-dim)' }
    : {};
  return (
    <button className={cls} style={{ width: size, height: size, ...lift }} {...rest}>
      {icon}
    </button>
  );
}
