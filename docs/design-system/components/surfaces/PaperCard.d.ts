import * as React from 'react';

/**
 * The workhorse surface — a single sheet of heavy cotton stock that lifts off
 * the desk, with the dry paper tooth and letterpress-debossed text baked in.
 * Set `dark` for the same stock in charcoal (Live, premium tickets, dark
 * wayfinding plates). This is the base every Khonsera card composes from.
 *
 * @startingPoint section="Surfaces" subtitle="The paper / charcoal sheet — the surface everything is built on" viewport="700x150"
 * @example
 * <PaperCard padding={18}>
 *   <h3 className="h3">St Pancras</h3>
 * </PaperCard>
 * <PaperCard dark radius="hero">…charcoal plate…</PaperCard>
 */
export interface PaperCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render as charcoal stock (cream ink, screen-blend tooth). */
  dark?: boolean;
  /** Corner from the family: 'hero' 18 · 'tile' 14 (default) · 'inner' 11, or a px number. */
  radius?: 'hero' | 'tile' | 'inner' | number;
  /** Light-card lift depth: 'lift' (default) or 'sm'. Ignored when dark. */
  elevation?: 'lift' | 'sm';
  /** Inner padding in px. Default 16. */
  padding?: number;
  children?: React.ReactNode;
}

export declare function PaperCard(props: PaperCardProps): JSX.Element;
