"use client";

import { useEffect, useRef, type ReactNode } from "react";

type SheetProps = {
  titleId: string;
  descriptionId?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

const ACTIONABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function Sheet({ titleId, descriptionId, onClose, children, className = "cc-sheet" }: SheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const dialog = dialogRef.current;
    const title = document.getElementById(titleId);
    const focusTarget = title instanceof HTMLElement ? title : dialog?.querySelector<HTMLElement>(ACTIONABLE_SELECTOR);
    focusTarget?.focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      openerRef.current?.focus({ preventScroll: true });
    };
  }, [titleId]);

  return (
    <div className="cc-sheet-scrim" onClick={onClose}>
      <div
        ref={dialogRef}
        className={className}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="cc-sheet-grip" />
        {children}
      </div>
    </div>
  );
}
