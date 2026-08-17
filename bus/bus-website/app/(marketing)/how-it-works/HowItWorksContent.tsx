"use client";

import {
  ArrowRight,
  Ban,
  Gauge,
  Check,
  Clock,
  MapPinned,
} from 'lucide-react';
import { ButtonLink } from '@/components/marketing/ui/Button';
import Badge from '@/components/marketing/ui/Badge';
import Container from '@/components/marketing/ui/Container';
import SectionHeading from '@/components/marketing/ui/SectionHeading';
import AppShowcase from '@/components/marketing/AppShowcase';
import { useScrollReveal } from '@/lib/marketing/useScrollReveal';
import { setupSteps, brand } from '@/lib/marketing/content';

export default function HowItWorksContent() {
  const { ref } = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={ref}>
      <PageHero />
      <StepsSection />
      <StopSuspensionSection />
      <CapacitySection />
      <ImportSection />
      <AppShowcase
        className="bg-cream-200"
        eyebrow="On the phone"
        title={<>What riders and drivers actually see</>}
        subtitle="Once the fleet is set up, this is the app in everyone’s pocket — sign in, find the bus, and follow it live."
      />
      <CtaSection />
    </div>
  );
}

function PageHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-lavender-100 to-cream-200 py-16 lg:py-24">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -right-32 top-0 h-80 w-80 rounded-full bg-coral-200/40 blur-3xl" />
      <div className="container-x relative max-w-3xl text-center">
        <div className="animate-fade-in-down">
          <Badge icon={<MapPinned className="h-3.5 w-3.5" />}>How it works</Badge>
        </div>
        <h1 className="mt-5 animate-fade-in-up text-fluid-4xl font-extrabold leading-[1.05] tracking-tight text-cream-900 text-balance">
          From signup to the first live trip
        </h1>
        <p className="mx-auto mt-5 max-w-xl animate-fade-in-up text-fluid-lg text-cream-700 text-pretty [animation-delay:0.1s]">
          Six steps take a college from empty platform to buses moving on the map with riders getting
          notified. Here’s the whole flow.
        </p>
      </div>
    </section>
  );
}

function StepsSection() {
  return (
    <Container className="bg-cream-200">
      <SectionHeading
        eyebrow="The flow"
        title={<>Six steps from zero to live</>}
        subtitle="Each role picks up where the last one left off, and the whole chain runs in an afternoon."
      />
      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {setupSteps.map((step, i) => (
          <article
            key={step.num}
            className={`reveal reveal-delay-${(i % 3) + 1} group relative rounded-2xl border border-cream-300 bg-cream-50 p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-card`}
          >
            <span className="absolute right-5 top-5 text-5xl font-extrabold text-cream-200 transition-colors group-hover:text-coral-200">
              {step.num}
            </span>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-coral-100 text-coral-600 ring-1 ring-coral-200">
              <step.icon className="h-6 w-6" />
            </div>
            <h3 className="mt-5 font-bold text-cream-900">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-cream-700">{step.desc}</p>
          </article>
        ))}
      </div>

      {/* Connecting line for desktop */}
      <div className="mt-8 hidden lg:block">
        <div className="mx-auto h-px max-w-5xl bg-gradient-to-r from-transparent via-cream-400 to-transparent" />
      </div>
    </Container>
  );
}

function StopSuspensionSection() {
  return (
    <Container className="bg-cream-100/50">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="reveal">
          <Badge icon={<Ban className="h-3.5 w-3.5" />}>Stop suspension</Badge>
          <h2 className="mt-4 text-fluid-3xl font-extrabold tracking-tight text-cream-900 text-balance">
            Suspend a stop, and riders get redirected automatically
          </h2>
          <p className="mt-4 text-fluid-base leading-relaxed text-cream-700 text-pretty">
            When a stop can’t be served — construction, flooding, a road closure — the dispatcher or
            admin suspends it for the day. Instead of phoning every affected rider, the app
            automatically points them to the nearest active stop on the route and sends a push.
          </p>
          <ul className="mt-7 space-y-3">
            {[
              'One tap to suspend a stop',
              'Nearest active stop calculated automatically',
              'Affected riders notified by push instantly',
              'Route continues for everyone else unchanged',
            ].map((line) => (
              <li key={line} className="flex items-center gap-3 text-sm text-cream-800">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        {/* Visual */}
        <div className="reveal reveal-delay-2">
          <div className="relative overflow-hidden rounded-3xl border border-cream-300 bg-cream-50 p-7 shadow-card">
            <div className="absolute inset-0 bg-dots opacity-40" />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-wide text-cream-500">Route A — stops</p>
              <div className="mt-4 space-y-3">
                {[
                  { name: 'Stop 1 · Main Gate', status: 'active' },
                  { name: 'Stop 2 · Library', status: 'suspended' },
                  { name: 'Stop 3 · Hostel Block', status: 'active' },
                  { name: 'Stop 4 · Sports Complex', status: 'active' },
                ].map((s) => (
                  <div
                    key={s.name}
                    className={`flex items-center justify-between rounded-xl border p-3.5 ${
                      s.status === 'suspended'
                        ? 'border-coral-300 bg-coral-50'
                        : 'border-cream-300 bg-cream-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <MapPinCol active={s.status === 'active'} />
                      <span className="text-sm font-semibold text-cream-900">{s.name}</span>
                    </div>
                    {s.status === 'suspended' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-coral-200 px-2.5 py-0.5 text-xs font-bold text-coral-700">
                        <Ban className="h-3 w-3" /> Suspended
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                        <Check className="h-3 w-3" /> Active
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl bg-lavender-50 p-4 ring-1 ring-lavender-200">
                <p className="text-xs font-semibold text-lavender-700">
                  Riders at Stop 2 redirected to:
                </p>
                <p className="mt-1 text-sm font-bold text-cream-900">
                  Stop 1 · Main Gate (nearest active)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}

function MapPinCol({ active }: { active: boolean }) {
  return (
    <span
      className={`grid h-7 w-7 place-items-center rounded-lg ${
        active ? 'bg-emerald-100 text-emerald-600' : 'bg-coral-100 text-coral-600'
      }`}
    >
      {active ? <MapPinned className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
    </span>
  );
}

function CapacitySection() {
  return (
    <Container className="bg-cream-200">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        {/* Visual first on this one */}
        <div className="reveal order-2 lg:order-1">
          <div className="relative overflow-hidden rounded-3xl border border-cream-300 bg-cream-50 p-7 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-cream-900">Bus 42</p>
                <p className="text-xs text-cream-600">Capacity 40 · Route A</p>
              </div>
              <Gauge className="h-7 w-7 text-coral-500" />
            </div>
            <div className="mt-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-cream-700">Assigned riders</span>
                <span className="font-bold text-cream-900">38 / 40</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-cream-200">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-coral-400" style={{ width: '95%' }} />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-cream-100 p-3">
                <p className="text-xl font-extrabold text-emerald-600">38</p>
                <p className="text-xs text-cream-600">Assigned</p>
              </div>
              <div className="rounded-xl bg-cream-100 p-3">
                <p className="text-xl font-extrabold text-cream-900">40</p>
                <p className="text-xs text-cream-600">Capacity</p>
              </div>
              <div className="rounded-xl bg-cream-100 p-3">
                <p className="text-xl font-extrabold text-coral-600">2</p>
                <p className="text-xs text-cream-600">Seats left</p>
              </div>
            </div>
            <div className="mt-5 rounded-xl bg-emerald-50 p-3 text-center ring-1 ring-emerald-200">
              <p className="text-xs font-semibold text-emerald-700">
                Over-assignment blocked — can’t exceed 40
              </p>
            </div>
          </div>
        </div>

        <div className="reveal reveal-delay-2 order-1 lg:order-2">
          <Badge icon={<Gauge className="h-3.5 w-3.5" />}>Capacity enforcement</Badge>
          <h2 className="mt-4 text-fluid-3xl font-extrabold tracking-tight text-cream-900 text-balance">
            No bus leaves over-filled
          </h2>
          <p className="mt-4 text-fluid-base leading-relaxed text-cream-700 text-pretty">
            Each bus has a set capacity. The app prevents more riders from being assigned to a bus
            than it can carry, so drivers never face an overcrowded stop and nobody is left standing.
          </p>
          <ul className="mt-7 space-y-3">
            {[
              'Per-bus capacity set by the admin',
              'Assignment blocked once capacity is reached',
              'Combined with one-driver-per-bus for clean runs',
            ].map((line) => (
              <li key={line} className="flex items-center gap-3 text-sm text-cream-800">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Container>
  );
}

function ImportSection() {
  return (
    <Container className="bg-cream-100/50">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="reveal">
          <Badge icon={<Clock className="h-3.5 w-3.5" />}>Bulk import</Badge>
          <h2 className="mt-4 text-fluid-3xl font-extrabold tracking-tight text-cream-900 text-balance">
            Set up a whole semester in one spreadsheet
          </h2>
          <p className="mt-4 text-fluid-base leading-relaxed text-cream-700 text-pretty">
            Instead of adding buses, routes, stops, and driver assignments one by one, the admin
            uploads a single XLSX file. The whole fleet is configured in one import — ideal for
            semester turnover.
          </p>
          <ul className="mt-7 space-y-3">
            {[
              'Routes and stops in one sheet',
              'Bus and driver assignments together',
              'Capacities and pickup windows included',
              'Re-import anytime to update',
            ].map((line) => (
              <li key={line} className="flex items-center gap-3 text-sm text-cream-800">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-coral-100 text-coral-600">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        {/* Spreadsheet visual */}
        <div className="reveal reveal-delay-2">
          <div className="overflow-hidden rounded-2xl border border-cream-300 bg-cream-50 shadow-card">
            <div className="flex items-center gap-2 border-b border-cream-300 bg-cream-100 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-coral-300" />
              <span className="h-3 w-3 rounded-full bg-amber-300" />
              <span className="h-3 w-3 rounded-full bg-emerald-300" />
              <span className="ml-2 text-xs font-semibold text-cream-600">fleet_setup.xlsx</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-cream-100 text-cream-600">
                  <tr>
                    {['Bus', 'Route', 'Driver', 'Capacity', 'Stops'].map((h) => (
                      <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200 text-cream-800">
                  {[
                    ['42', 'A', 'Ravi K.', '40', '4'],
                    ['43', 'A', 'Meena S.', '40', '4'],
                    ['44', 'B', 'Arul D.', '32', '5'],
                    ['45', 'C', 'Priya M.', '32', '3'],
                  ].map((row, i) => (
                    <tr key={i} className="transition-colors hover:bg-coral-50/50">
                      {row.map((cell, j) => (
                        <td key={j} className="px-4 py-2.5">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-cream-300 bg-emerald-50 px-4 py-3">
              <span className="text-xs font-semibold text-emerald-700">4 buses imported successfully</span>
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}

function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-cream-900 py-20 lg:py-24">
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-10" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-coral-500/20 blur-3xl" />
      <div className="container-x relative text-center">
        <h2 className="reveal mx-auto max-w-2xl text-fluid-3xl font-extrabold tracking-tight text-cream-50 text-balance">
          Ready to set up your fleet?
        </h2>
        <p className="reveal reveal-delay-1 mx-auto mt-4 max-w-xl text-fluid-base text-cream-300 text-pretty">
          One-time {brand.price} activation. Your whole transport team on one shared live map.
        </p>
        <div className="reveal reveal-delay-2 mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink size="lg" href="/roles">
            Explore roles
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
          <ButtonLink variant="outline" size="lg" href="/">
            Back to home
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
