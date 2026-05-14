import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "terra" | "ghost" | "destructive";

const variants: Record<Variant, string> = {
  primary: "btn-primary",
  terra: "btn-terra",
  ghost: "btn-ghost",
  destructive: "btn-destructive",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ className, variant = "primary", ...props }, ref) => (
  <button ref={ref} className={cn(variants[variant], className)} {...props} />
));
Button.displayName = "Button";
