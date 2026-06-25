import * as React from 'react';

/**
 * The one button family. Crisp 4px card-stock geometry, Satoshi 500. Use `gold`
 * for the single primary action per view, `ink` for charcoal weight (Live /
 * dark contexts), `ghost` for quiet secondaries, `terra` only for rare
 * celebratory moments. Gold is punctuation — never two golds in one view.
 *
 * @startingPoint section="Components" subtitle="The Khonsera button family — gold / ink / ghost / terra" viewport="700x150"
 * @example
 * <Button variant="gold" iconLeft={<Icon name="navigation" size={14} />}>Navigate</Button>
 * <Button variant="ghost" size="sm">Skip</Button>
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** gold = primary · ink = charcoal · ghost = quiet · terra = rare celebratory salt. */
  variant?: 'gold' | 'ink' | 'ghost' | 'terra';
  /** sm · md · lg. Default md. */
  size?: 'sm' | 'md' | 'lg';
  /** Stretch to fill the container width. */
  full?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
}

export declare function Button(props: ButtonProps): JSX.Element;
