import * as React from 'react';

/**
 * A round icon action — the header affordance (compass, bell, close). Soft
 * extruded chip by default; `gold` for a quiet accent, `ink` for charcoal.
 *
 * @example
 * <IconButton icon={<Icon name="bell" size={16} />} />
 * <IconButton icon={<Icon name="compass" size={16} />} tone="ink" />
 */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The glyph, e.g. <Icon name="bell" />. */
  icon: React.ReactNode;
  /** soft = raised page chip (default) · gold = accent · ink = charcoal. */
  tone?: 'soft' | 'gold' | 'ink';
  /** Diameter in px. Default 36 (44 for primary touch targets). */
  size?: number;
}

export declare function IconButton(props: IconButtonProps): JSX.Element;
