import * as React from 'react';

/**
 * A soft-extruded mini tile holding one glyph — the object-identity marker on
 * every card. `char` (charcoal) for emphasis (places, credentials); `soft` for
 * neutral; the tinted tones carry status or domain colour. Size scales the glyph
 * and corner automatically.
 *
 * @example
 * <Chip icon="train" tone="char" size={38} />
 * <Chip icon="sparkle" tone="gold" />
 */
export interface ChipProps {
  /** Icon name (see Icon). */
  icon: string;
  /** soft (default) · char · gold · slate · sage · rust · plum. */
  tone?: 'soft' | 'char' | 'gold' | 'slate' | 'sage' | 'rust' | 'plum';
  /** Square size in px. Default 36. */
  size?: number;
  style?: React.CSSProperties;
}

export declare function Chip(props: ChipProps): JSX.Element;
