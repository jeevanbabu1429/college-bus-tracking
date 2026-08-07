import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  FileText,
  Lock,
  ChevronRight,
  LogIn,
} from "lucide-react";
import Logo from "./Logo";
import { brand } from "@/lib/marketing/content";

const pages = [
  { label: "Home", href: "/" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Roles", href: "/roles" },
];

const legal = [
  { label: "Privacy Policy", href: "/privacy", icon: Lock },
  { label: "Terms of Service", href: "/terms", icon: FileText },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-10 border-t border-cream-300/70 bg-cream-100">
      <div className="container-x py-14 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Brand + blurb */}
          <div className="lg:col-span-4">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-cream-700">
              Live college bus tracking built for admins, dispatchers, drivers, and
              passengers. Know exactly where every bus is — without the radio
              chatter.
            </p>
            <div className="mt-5 flex flex-col gap-2.5 text-sm text-cream-700">
              <a
                href={`mailto:${brand.supportEmail}`}
                className="inline-flex items-center gap-2.5 transition-colors hover:text-coral-600"
              >
                <Mail className="h-4 w-4 text-coral-500" />
                {brand.supportEmail}
              </a>
              <a
                href={`tel:${brand.supportTel}`}
                className="inline-flex items-center gap-2.5 transition-colors hover:text-coral-600"
              >
                <Phone className="h-4 w-4 text-coral-500" />
                {brand.supportPhone}
              </a>
              <span className="inline-flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-coral-500" />
                India
              </span>
            </div>
          </div>

          {/* Pages */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cream-500">
              Pages
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {pages.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex items-center gap-1 text-cream-700 transition-colors hover:text-coral-600"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-cream-700 transition-colors hover:text-coral-600"
                >
                  <LogIn className="h-3.5 w-3.5 text-cream-500" />
                  Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="lg:col-span-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-cream-500">
              Legal
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {legal.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="inline-flex items-center gap-2 text-cream-700 transition-colors hover:text-coral-600"
                  >
                    <l.icon className="h-3.5 w-3.5 text-cream-500" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA card */}
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-cream-300 bg-cream-50 p-5 shadow-soft">
              <div className="flex items-center gap-2 text-coral-600">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-sm font-bold">Ready to track your fleet?</span>
              </div>
              <p className="mt-2 text-sm text-cream-700">
                One-time activation. No per-seat fees. Built for college transport
                teams.
              </p>
              <Link
                href="/#get-started"
                className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-coral-600 transition-colors hover:text-coral-700"
              >
                Get started
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-cream-300/70 pt-6 text-xs text-cream-600 sm:flex-row">
          <p>&copy; {year} {brand.name}. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Driver-location data collected only during active trips.
          </p>
        </div>
      </div>
    </footer>
  );
}
