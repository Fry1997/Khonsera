import * as React from 'react';

/**
 * The mono uppercase status capsule. Two jobs in one component: feasibility
 * ('comfortable' / 'tight' / 'risky' — the green/amber/rust the whole system
 * reads delay against) and lifecycle ('booked' / 'planned' / 'live' / 'done' /
 * 'offline'). Quiet by default; `solid` fills the capsule for the loudest
 * moments (a missed connection, a Live leg).
 *
 * @startingPoint section="Components" subtitle="Feasibility + lifecycle status pills" viewport="700x150"
 * @example
 * <StatePill state="comfortable" />
 * <StatePill state="risky" solid>Connection missed</StatePill>
 */
export interface StatePillProps {
  /** comfortable · tight · risky · live · booked · planned · done · offline. */
  state?: 'comfortable' | 'tight' | 'risky' | 'live' | 'booked' | 'planned' | 'done' | 'offline';
  /** Override the default label text. */
  children?: React.ReactNode;
  /** Show the leading status dot. Default true. */
  dot?: boolean;
  /** Invert to a filled capsule for the loudest states. */
  solid?: boolean;
  style?: React.CSSProperties;
}

export declare function StatePill(props: StatePillProps): JSX.Element;
