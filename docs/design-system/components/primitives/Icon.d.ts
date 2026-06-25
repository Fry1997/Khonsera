import * as React from 'react';

/**
 * Khonsera's stroke icon. A curated Lucide subset rendered at the brand's one
 * line weight (1.75). Inherits `currentColor`. Reference glyphs by `name` —
 * never inline a one-off SVG in product code.
 *
 * @example
 * <Icon name="train" size={18} />
 * <span style={{ color: 'var(--gold-2)' }}><Icon name="sparkle" /></span>
 */
export interface IconProps {
  /** Glyph name. See ICON_NAMES for the full set (train, plane, walk, key, ticket, scan, navigation, …). */
  name: string;
  /** Pixel size (square). Default 16. */
  size?: number;
  /** Stroke width. Default 1.75 — the brand weight; rarely change. */
  sw?: number;
  style?: React.CSSProperties;
}

export declare function Icon(props: IconProps): JSX.Element;
export declare const ICON_NAMES: string[];
