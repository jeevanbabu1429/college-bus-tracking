"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogIn, Menu, X, ChevronRight } from "lucide-react";
import Logo from "./Logo";
import { ButtonLink } from "./ui/Button";

const links = [
  { label: "Home", href: "/" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Roles", href: "/roles" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock the page behind the mobile drawer.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-cream-300/70 bg-cream-200/85 backdrop-blur-xl shadow-soft"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="container-x flex h-16 items-center justify-between gap-4 lg:h-18">
        <Link
          href="/"
          className="flex items-center transition-opacity hover:opacity-80"
          aria-label="BusBee home"
        >
          <Logo />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`relative rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                isActive(link.href)
                  ? "text-coral-600"
                  : "text-cream-800 hover:text-coral-600"
              }`}
            >
              {link.label}
              {isActive(link.href) && (
                <span className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-coral-400" />
              )}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ButtonLink href="/how-it-works" variant="outline" size="sm">
            See how it works
          </ButtonLink>
          {/* Hands off to the existing admin console. */}
          <ButtonLink href="/login" size="sm">
            <LogIn className="h-4 w-4" />
            Login
          </ButtonLink>
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-lg text-cream-800 transition-colors hover:bg-cream-300/60 lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className={`lg:hidden overflow-hidden border-t border-cream-300/70 bg-cream-200/95 backdrop-blur-xl transition-[max-height,opacity] duration-300 ${
          open ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="container-x flex flex-col gap-1 py-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`flex items-center justify-between rounded-xl px-4 py-3 text-base font-semibold transition-colors ${
                isActive(link.href)
                  ? "bg-coral-50 text-coral-600"
                  : "text-cream-800 hover:bg-cream-300/50"
              }`}
            >
              {link.label}
              <ChevronRight className="h-4 w-4 opacity-50" />
            </Link>
          ))}
          <div className="mt-3 flex flex-col gap-2 px-1">
            <ButtonLink
              href="/how-it-works"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              See how it works
            </ButtonLink>
            <ButtonLink href="/login" onClick={() => setOpen(false)}>
              <LogIn className="h-4 w-4" />
              Login
            </ButtonLink>
          </div>
        </nav>
      </div>
    </header>
  );
}
