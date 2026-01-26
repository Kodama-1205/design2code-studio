"use client";

import Link from "next/link";
import { clsx } from "clsx";

type Variant = "primary" | "secondary" | "ghost";

export default function Button(props: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: Variant;
}) {
  const { children, href, onClick, type = "button", disabled, variant = "secondary" } = props;

  const className = clsx(
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition border",
    "focus:outline-none focus:ring-2 focus:ring-[rgba(170,90,255,0.45)]",
    disabled && "opacity-50 cursor-not-allowed",
    variant === "primary" &&
      "border-transparent bg-gradient-to-r from-[rgb(var(--primary))] to-[rgb(var(--primary2))] text-white shadow-soft hover:opacity-95",
    variant === "secondary" &&
      "border-[rgb(var(--border))] bg-[rgb(var(--surface2))] hover:border-[rgba(170,90,255,0.55)]",
    variant === "ghost" &&
      "border-transparent bg-transparent hover:bg-[rgba(255,255,255,0.04)]"
  );

  if (href) {
    return (
      <Link className={className} href={href} aria-disabled={disabled}>
        {children}
      </Link>
    );
  }

  return (
    <button className={className} onClick={onClick} type={type} disabled={disabled}>
      {children}
    </button>
  );
}
