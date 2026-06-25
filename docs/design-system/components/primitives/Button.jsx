import React from 'react';

/* Button — one family, crisp 4px stock, Satoshi 500. Gold = the single primary
 * action; ink = charcoal weight; ghost = quiet; terra = rare celebratory salt.
 * Press translates 1px (the stock pushing into the desk). */
export function Button({
  variant = 'gold', size = 'md', full = false, disabled = false,
  iconLeft, iconRight, children, className = '', ...rest
}) {
  const cls = [
    'btn', `btn-${variant}`,
    size === 'sm' && 'btn-sm',
    size === 'lg' && 'btn-lg',
    full && 'btn-full',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={disabled} {...rest}>
      {iconLeft}{children}{iconRight}
    </button>
  );
}
