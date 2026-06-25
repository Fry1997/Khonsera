import * as React from 'react';

/**
 * The charcoal data cell from physical signage — a platform / gate / seat
 * number pressed into a dark plate. Use it for the single most operationally
 * important number on a card so it reads like wayfinding, not body copy. Use
 * `tone="soft"` for a quieter gold cell.
 *
 * @example
 * <WayfindBadge>4</WayfindBadge>           // platform 4
 * <WayfindBadge>12C</WayfindBadge>         // seat
 * <WayfindBadge tone="soft">B</WayfindBadge>
 */
export interface WayfindBadgeProps {
  /** The number or short code. */
  children: React.ReactNode;
  /** dark = charcoal plate (default) · soft = quiet gold cell. */
  tone?: 'dark' | 'soft';
  style?: React.CSSProperties;
}

export declare function WayfindBadge(props: WayfindBadgeProps): JSX.Element;
