import * as React from 'react';

/**
 * A letterpress-pressed recess sunk into a sheet — the opposite of a PaperCard's
 * lift. Use for read-outs, credential rows, and protected buffers: anything that
 * should read as stamped INTO the stock. Pair the sink with a PaperCard lift to
 * tell a clear level story (raised vs pressed).
 *
 * @example
 * <Well><StubField label="Arrive" value="08:54" /></Well>
 */
export interface WellProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Corner radius in px. Default 13. */
  radius?: number;
  /** CSS padding shorthand. Default '12px 14px'. */
  padding?: string | number;
  children?: React.ReactNode;
}

export declare function Well(props: WellProps): JSX.Element;
