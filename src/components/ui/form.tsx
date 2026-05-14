"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="uc">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="small">{hint}</p> : null}
      {error ? <p className="text-xs text-rust">{error}</p> : null}
    </div>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("input-base", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn("input-base min-h-[80px]", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn("input-base", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-rust-2 bg-rust-2/40 px-3 py-2 text-sm text-rust">
      {message}
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  variant?: "primary" | "terra";
}) {
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      className={cn(variant === "terra" ? "btn-terra" : "btn-primary", className)}
      {...props}
    >
      {pending ? "…" : children}
    </button>
  );
}
