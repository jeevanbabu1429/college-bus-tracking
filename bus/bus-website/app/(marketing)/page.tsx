"use client";

import { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  Zap,
  BellRing,
  MapPinned,
  Clock,
  BusFront,
  Map,
} from 'lucide-react';
import { ButtonLink } from '@/components/marketing/ui/Button';
import Badge from '@/components/marketing/ui/Badge';
import Container from '@/components/marketing/ui/Container';
import SectionHeading from '@/components/marketing/ui/SectionHeading';
import PhoneMockup from '@/components/marketing/PhoneMockup';
import { useScrollReveal } from '@/lib/marketing/useScrollReveal';
import {
  features,
  nonFeatures,
  notifications,
  roles,
  faqs,
  brand,
} from '@/lib/marketing/content';

const accentMap: Record<string, { bg: string; text: string; ring: string }> = {
  coral: { bg: 'bg-coral-100', text: 'text-coral-600', ring: 'ring-coral-200' },
  lavender: { bg: 'bg-lavender-100', text: 'text-lavender-600', ring: 'ring-lavender-200' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', ring: 'ring-emerald-200' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600', ring: 'ring-amber-200' },
};

export default function Home() {
  const { ref } = useScrollReveal<HTMLDivElement>();

  return (
    <div ref={ref}>
      <Hero />
      <TrustBar />
      <FeaturesSection />
      <TrackingSection />
      <NotificationsSection />
      <RolesPreview />
      <NonFeaturesSection />
      <PricingSection />
      <FaqSection />
      <FinalCta />
    </div>
  );
}

/* ---------------- Hero ---------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-lavender-100 via-cream-200 to-cream-200">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-coral-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 top-40 h-80 w-80 rounded-full bg-lavender-200/40 blur-3xl" />

      <div className="container-x relative grid items-center gap-12 py-16 lg:grid-cols-2 lg:gap-8 lg:py-24">
        <div className="max-w-xl">
          <div className="animate-fade-in-down">
            <Badge icon={<Sparkles className="h-3.5 w-3.5" />}>Live college bus tracking</Badge>
          </div>
          <h1 className="mt-5 animate-fade-in-up text-fluid-4xl font-extrabold leading-[1.05] tracking-tight text-cream-900 text-balance">
            Know where every bus is —{' '}
            <span className="bg-gradient-to-r from-coral-500 to-coral-600 bg-clip-text text-transparent">
              without the radio chatter
            </span>
          </h1>
          <p className="mt-5 max-w-lg animate-fade-in-up text-fluid-lg leading-relaxed text-cream-700 text-pretty [animation-delay:0.1s]">
            {brand.name} gives admins, dispatchers, drivers, and passengers one shared view of the
            fleet. Live tracking, route & stop management, smart stop-suspension fallback, and the
            right push notification at exactly the right moment.
          </p>
          <div className="mt-7 flex animate-fade-in-up flex-wrap items-center gap-3 [animation-delay:0.2s]">
            <ButtonLink size="lg" href="/#get-started">
              Get started
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink variant="outline" size="lg" href="/how-it-works">
              See how it works
            </ButtonLink>
          </div>
          <div className="mt-8 flex animate-fade-in-up flex-wrap items-center gap-x-6 gap-y-2 text-sm text-cream-700 [animation-delay:0.3s]">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" /> One-time {brand.price} activation
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" /> No parent login needed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-500" /> Location only during active trips
            </span>
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="animate-scale-in [animation-delay:0.15s]">
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Trust bar ---------------- */

function TrustBar() {
  const stats = [
    { value: '5s', label: 'Live update interval' },
    { value: '4', label: 'Roles, one app' },
    { value: '6', label: 'Push notification triggers' },
    { value: '₹90', label: 'One-time activation' },
  ];
  return (
    <div className="border-y border-cream-300/70 bg-cream-100/60 backdrop-blur">
      <div className="container-x grid grid-cols-2 gap-6 py-8 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className={`reveal reveal-delay-${i + 1} text-center`}>
            <p className="text-fluid-2xl font-extrabold text-coral-600">{s.value}</p>
            <p className="mt-1 text-sm text-cream-600">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Features ---------------- */

function FeaturesSection() {
  return (
    <Container id="features" className="bg-cream-200">
      <SectionHeading
        eyebrow="Everything included"
        title={<>One app for the whole transport operation</>}
        subtitle="From OTP login to bulk import, every piece a college transport team needs — and nothing it doesn't."
      />
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => {
          const a = accentMap[f.accent];
          return (
            <article
              key={f.title}
              className={`reveal reveal-delay-${(i % 3) + 1} group relative overflow-hidden rounded-2xl border border-cream-300 bg-cream-50 p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-card`}
            >
              <div className={`grid h-12 w-12 place-items-center rounded-xl ${a.bg} ${a.text} ring-1 ${a.ring}`}>
                <f.icon className="h-6 w-6" strokeWidth={2} />
              </div>
              <h3 className="mt-5 text-lg font-bold text-cream-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-cream-700">{f.desc}</p>
              <div className={`absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 ${a.bg.replace('100', '400')} transition-transform duration-300 group-hover:scale-x-100`} />
            </article>
          );
        })}
      </div>
    </Container>
  );
}

/* ---------------- Live tracking deep-dive ---------------- */

function TrackingSection() {
  return (
    <Container id="tracking" className="bg-cream-100/50">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="reveal">
          <Badge icon={<MapPinned className="h-3.5 w-3.5" />}>Live tracking</Badge>
          <h2 className="mt-4 text-fluid-3xl font-extrabold tracking-tight text-cream-900 text-balance">
            Near-real-time location, shared only when it matters
          </h2>
          <p className="mt-4 text-fluid-base leading-relaxed text-cream-700 text-pretty">
            While a bus is moving, it reports its position about every 5 seconds. While it’s idle,
            about every 10 minutes. And location is only collected during an active trip — between
            the driver starting and ending the run.
          </p>
          <ul className="mt-7 space-y-4">
            {[
              { icon: Zap, title: '5-second updates while moving', desc: 'Passengers and dispatch see the bus move almost live on the map.' },
              { icon: Clock, title: '10-minute updates while idle', desc: 'Saves battery when the bus is parked, without losing it entirely.' },
              { icon: ShieldCheck, title: 'Active-trip-only collection', desc: 'No background tracking. When the trip ends, location sharing ends.' },
              { icon: Map, title: 'All-fleet live map for admins', desc: 'See every bus in one view — not one vehicle at a time.' },
            ].map((item) => (
              <li key={item.title} className="flex gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-coral-100 text-coral-600">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-cream-900">{item.title}</p>
                  <p className="text-sm text-cream-700">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Visual: update-rate diagram */}
        <div className="reveal reveal-delay-2">
          <div className="relative overflow-hidden rounded-3xl border border-cream-300 bg-cream-50 p-8 shadow-card">
            <div className="absolute inset-0 bg-dots opacity-40" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-coral-400 text-cream-50">
                    <BusFront className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-cream-900">Bus 42</p>
                    <p className="text-xs text-cream-600">Route A · 3 stops to go</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  LIVE
                </span>
              </div>

              {/* Timeline */}
              <div className="mt-8 space-y-3">
                {[
                  { t: '0s', label: 'Position reported', active: true },
                  { t: '5s', label: 'Position reported', active: true },
                  { t: '10s', label: 'Position reported', active: true },
                  { t: '15s', label: 'Position reported', active: true },
                ].map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-10 text-right text-xs font-semibold text-cream-500">{p.t}</span>
                    <div className="relative h-2 flex-1 rounded-full bg-cream-200">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-coral-400"
                        style={{ width: `${100 - i * 8}%` }}
                      />
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-coral-600">
                      <MapPinned className="h-3 w-3" /> {p.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-coral-50 p-4 text-center ring-1 ring-coral-200">
                  <p className="text-2xl font-extrabold text-coral-600">~5s</p>
                  <p className="text-xs text-cream-700">while moving</p>
                </div>
                <div className="rounded-2xl bg-lavender-50 p-4 text-center ring-1 ring-lavender-200">
                  <p className="text-2xl font-extrabold text-lavender-600">~10m</p>
                  <p className="text-xs text-cream-700">while idle</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}

/* ---------------- Notifications ---------------- */

function NotificationsSection() {
  return (
    <Container id="notifications" className="bg-cream-200">
      <SectionHeading
        eyebrow="Push notifications"
        title={<>The right nudge at the right stop</>}
        subtitle="Six push-notification triggers keep everyone informed — including the one-stop-before 'arriving soon' alert that gets riders to the stop on time."
      />
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {notifications.map((n, i) => (
          <article
            key={n.trigger}
            className={`reveal reveal-delay-${(i % 3) + 1} relative overflow-hidden rounded-2xl border border-cream-300 bg-gradient-to-br from-cream-50 to-cream-100 p-6 shadow-soft transition-all duration-300 hover:shadow-card`}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-lavender-100 text-lavender-600 ring-1 ring-lavender-200">
                <n.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-cream-900">{n.trigger}</h3>
                <p className="text-xs font-medium text-coral-600">{n.audience}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-cream-700">{n.desc}</p>
            <BellRing className="absolute -right-3 -top-3 h-20 w-20 text-lavender-100" />
          </article>
        ))}
      </div>
    </Container>
  );
}

/* ---------------- Roles preview ---------------- */

function RolesPreview() {
  return (
    <Container id="roles-preview" className="bg-cream-100/50">
      <SectionHeading
        eyebrow="Four roles, one app"
        title={<>Everyone sees what they need to</>}
        subtitle="Super Admins, Admins, Dispatchers, and Drivers — each with a scoped login and the right powers for the job."
      />
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((r, i) => {
          const a = accentMap[r.accent];
          return (
            <article
              key={r.key}
              className={`reveal reveal-delay-${i + 1} group rounded-2xl border border-cream-300 bg-cream-50 p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-card`}
            >
              <div className={`grid h-12 w-12 place-items-center rounded-xl ${a.bg} ${a.text} ring-1 ${a.ring}`}>
                <r.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-bold text-cream-900">{r.name}</h3>
              <p className="text-xs font-medium text-coral-600">{r.tagline}</p>
              <p className="mt-3 text-sm leading-relaxed text-cream-700">{r.blurb}</p>
              <div className="mt-4 rounded-lg bg-cream-100 px-3 py-2 text-xs text-cream-600">
                <span className="font-semibold text-cream-800">Login: </span>
                {r.login}
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-10 text-center">
        <ButtonLink variant="outline" href="/roles">
          Compare all capabilities
          <ArrowRight className="h-4 w-4" />
        </ButtonLink>
      </div>
    </Container>
  );
}

/* ---------------- Non-features ---------------- */

function NonFeaturesSection() {
  return (
    <Container id="scope" className="bg-cream-200">
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          eyebrow="What it is not"
          title={<>Honest about the scope</>}
          subtitle="We'd rather tell you up front what BusTrack doesn't do, so you're not surprised later."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {nonFeatures.map((nf, i) => (
            <div
              key={nf.title}
              className={`reveal reveal-delay-${(i % 2) + 1} flex gap-4 rounded-2xl border border-cream-300 bg-cream-50 p-5`}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cream-200 text-cream-500">
                <X className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-cream-900">{nf.title}</p>
                <p className="mt-1 text-sm text-cream-700">{nf.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}

/* ---------------- Pricing ---------------- */

function PricingSection() {
  return (
    <Container id="get-started" className="bg-cream-100/50">
      <SectionHeading
        eyebrow="Pricing"
        title={<>One activation. No per-seat fees.</>}
        subtitle="A single one-time activation gets your college the full feature set. No recurring charges for the capabilities listed here."
      />
      <div className="mx-auto mt-12 max-w-md">
        <div className="reveal relative overflow-hidden rounded-3xl border border-coral-300 bg-cream-50 p-8 text-center shadow-glow-coral">
          <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-coral-100 blur-2xl" />
          <div className="relative">
            <Badge icon={<Sparkles className="h-3.5 w-3.5" />}>One-time activation</Badge>
            <p className="mt-6 text-5xl font-extrabold text-cream-900">
              {brand.price}
            </p>
            <p className="mt-1 text-sm text-cream-600">{brand.priceNote}</p>
            <ul className="mt-7 space-y-3 text-left text-sm">
              {[
                'All features in the list above',
                'All four roles included',
                'No per-bus or per-seat recurring fee',
                'No parent login required',
              ].map((line) => (
                <li key={line} className="flex items-center gap-2.5">
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span className="text-cream-700">{line}</span>
                </li>
              ))}
            </ul>
            <ButtonLink className="mt-7 w-full" size="lg" href="/how-it-works">
              Get started
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <p className="mt-3 text-xs text-cream-500">
              Have questions? Email {brand.supportEmail}
            </p>
          </div>
        </div>
      </div>
    </Container>
  );
}

/* ---------------- FAQ ---------------- */

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Container id="faq" className="bg-cream-200">
      <SectionHeading
        eyebrow="FAQ"
        title={<>Questions, answered</>}
        subtitle="The things people ask before they set up BusTrack for their college."
      />
      <div className="mx-auto mt-12 max-w-3xl space-y-3">
        {faqs.map((faq, i) => {
          const isOpen = open === i;
          return (
            <div
              key={faq.q}
              className={`reveal reveal-delay-${Math.min(i + 1, 4)} overflow-hidden rounded-2xl border bg-cream-50 transition-colors ${
                isOpen ? 'border-coral-300 shadow-soft' : 'border-cream-300'
              }`}
            >
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="font-semibold text-cream-900">{faq.q}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-coral-500 transition-transform duration-300 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <div
                className={`grid transition-all duration-300 ${
                  isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-4 text-sm leading-relaxed text-cream-700">{faq.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Container>
  );
}

/* ---------------- Final CTA ---------------- */

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-cream-900 py-20 lg:py-28">
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-10" />
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-coral-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-lavender-500/20 blur-3xl" />
      <div className="container-x relative text-center">
        <h2 className="reveal mx-auto max-w-2xl text-fluid-3xl font-extrabold tracking-tight text-cream-50 text-balance">
          Bring live bus tracking to your campus
        </h2>
        <p className="reveal reveal-delay-1 mx-auto mt-4 max-w-xl text-fluid-base text-cream-300 text-pretty">
          One-time {brand.price} activation. Set up your fleet in an afternoon and stop answering
          “where is the bus?” calls.
        </p>
        <div className="reveal reveal-delay-2 mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink size="lg" href="/how-it-works">
            See how it works
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
          <ButtonLink variant="outline" size="lg" href="/roles">
            Explore roles
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
