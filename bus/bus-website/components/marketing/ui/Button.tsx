import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-coral-400 text-cream-50 hover:bg-coral-500 shadow-glow-coral hover:shadow-lift active:scale-[0.97]",
  secondary:
    "bg-cream-900 text-cream-50 hover:bg-cream-800 shadow-soft hover:shadow-card active:scale-[0.97]",
  ghost: "text-cream-700 hover:text-cream-900 hover:bg-cream-300/60",
  outline:
    "border border-cream-400 text-cream-900 hover:border-coral-400 hover:text-coral-600 bg-cream-50/40 backdrop-blur",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm rounded-lg gap-1.5",
  md: "h-11 px-5 text-sm rounded-xl gap-2",
  lg: "h-13 px-7 text-base rounded-xl gap-2.5",
};

const base =
  "inline-flex items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-200 disabled:opacity-50 disabled:pointer-events-none";

function buttonClass(variant: Variant, size: Size, className: string): string {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

type ButtonLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

/**
 * Same look as Button, but renders a real link. Everything that navigates uses
 * this — the Bolt original faked navigation with onClick handlers, which loses
 * middle-click, "open in new tab", and crawlability.
 */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
