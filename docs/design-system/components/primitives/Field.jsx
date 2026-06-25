import React from 'react';

/* Field — the one text input. Crisp 4px stock, gold focus ring. An optional
 * mono label sits above; an optional leading glyph tucks inside the well. */
export function Field({ label, icon, hint, className = '', style, ...rest }) {
  return (
    <label style={{ display: 'block', ...style }}>
      {label && (
        <span className="eyebrow" style={{ display: 'block', marginBottom: 7 }}>{label}</span>
      )}
      <span style={{ position: 'relative', display: 'block' }}>
        {icon && (
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)', pointerEvents: 'none' }}>{icon}</span>
        )}
        <input className={['field', className].filter(Boolean).join(' ')}
          style={icon ? { paddingLeft: 38 } : undefined} {...rest} />
      </span>
      {hint && (
        <span className="small" style={{ display: 'block', marginTop: 6 }}>{hint}</span>
      )}
    </label>
  );
}
