import React from 'react';

/* Well — a letterpress-pressed recess SUNK into a sheet. The home for read-outs,
 * credentials and protected buffers: anything that should read as stamped into
 * the stock rather than raised off it. */
export function Well({ radius = 13, padding = '12px 14px', className = '', style, children, ...rest }) {
  return (
    <div className={className}
      style={{
        position: 'relative', borderRadius: radius, padding,
        background: 'var(--well)', border: '1px solid var(--line-soft)',
        boxShadow: 'var(--sink)', ...style,
      }} {...rest}>
      {children}
    </div>
  );
}
