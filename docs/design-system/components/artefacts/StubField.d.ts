import * as React from 'react';

/**
 * A boarding-pass read-out: a small uppercase mono eyebrow above a tabular
 * value. The atom every credential stub is built from — lay several in a grid
 * for a ticket footer (Depart · Arrive · Platform · Seat). Set `badge` to render
 * the value as a charcoal WayfindBadge for platform / gate / seat numbers.
 *
 * @example
 * <StubField label="Depart" value="11:32" />
 * <StubField label="Platform" value="4" badge />
 */
export interface StubFieldProps {
  /** Uppercase mono label. */
  label: string;
  /** The value (string or number). Falls back to an em-dash when empty. */
  value?: React.ReactNode;
  /** Render the value as a charcoal WayfindBadge (for platform / gate / seat). */
  badge?: boolean;
  /** Text alignment. Default 'left'. */
  align?: 'left' | 'center' | 'right';
  style?: React.CSSProperties;
}

export declare function StubField(props: StubFieldProps): JSX.Element;
