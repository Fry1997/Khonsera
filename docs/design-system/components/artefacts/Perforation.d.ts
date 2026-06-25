import * as React from 'react';

/**
 * The ticket-strip cut — a dashed rule flanked by two punched notches that read
 * as holes through the stock. Place it between a credential's header and its
 * read-out stub to make the card feel like a real perforated ticket. Set
 * `notchBg` to the colour of the surface the card sits on so the notches read
 * as genuine cut-outs; `dark` for charcoal tickets.
 *
 * @example
 * <Perforation notchBg="var(--screen)" />
 * <Perforation dark notchBg="var(--ground)" />
 */
export interface PerforationProps {
  /** Horizontal inset in px (align the notches to the card edge). Default 0. */
  margin?: number;
  /** Colour behind the punched notches — match the surface under the card. */
  notchBg?: string;
  /** Use on charcoal stock (lighter dashes, dark notch shadow). */
  dark?: boolean;
  style?: React.CSSProperties;
}

export declare function Perforation(props: PerforationProps): JSX.Element;
