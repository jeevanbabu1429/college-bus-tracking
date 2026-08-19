"use client";

import { ArrowRight, Check, Minus, ShieldAlert, UserCog, Map, Users } from 'lucide-react';
import { ButtonLink } from '@/components/marketing/ui/Button';
import Badge from '@/components/marketing/ui/Badge';
import Container from '@/components/marketing/ui/Container';
import SectionHeading from '@/components/marketing/ui/SectionHeading';
import { useScrollReveal } from '@/lib/marketing/useScrollReveal';
import { roles, roleCapabilities } from '@/lib/marketing/content';

const accentMap: Record<string, { bg: string; text: string; ring: string; border: string }> = {
  coral: { bg: 'bg-coral-100', text: 'text-coral-600', ring: 'ring-coral-200', border: 'border-coral-300' },
  lavender: { bg: 'bg-lavender-100', text: 'text-lavender-600', ring: 'ring-lavender-200', border: 'border-lavender-300' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', ring: 'ring-emerald-200', border: 'border-emerald-300' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600', ring: 'ring-amber-200', border: 'border-amber-300' },
};

export default function RolesContent() {
  const { ref } = useScrollReveal<HTMLDivElement>();
  return (
    <div ref={ref}>
      <PageHero />
      <RoleCards />
      <CapabilityTable />
      <LoginSection />
      <CtaSection />
    </div>
  );
}

function PageHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-lavender-100 to-cream-200 py-16 lg:py-24">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full bg-coral-200/40 blur-3xl" />
      <div className="container-x relative max-w-3xl text-center">
        <div className="animate-fade-in-down">
          <Badge icon={<Users className="h-3.5 w-3.5" />}>Roles & access</Badge>
        </div>
        <h1 className="mt-5 animate-fade-in-up text-fluid-4xl font-extrabold leading-[1.05] tracking-tight text-cream-900 text-balance">
          Roles built around your team
        </h1>
        <p className="mx-auto mt-5 max-w-xl animate-fade-in-up text-fluid-lg text-cream-700 text-pretty [animation-delay:0.1s]">
          Your Admin creates the roles your college needs and decides exactly what each one can
          access. Dispatchers run the day, Drivers run the route — here’s who can do what.
        </p>
      </div>
    </section>
  );
}

function RoleCards() {
  return (
    <Container className="bg-cream-200">
      <div className="grid gap-6 lg:grid-cols-2">
        {roles.map((r, i) => {
          const a = accentMap[r.accent];
          return (
            <article
              key={r.key}
              className={`reveal reveal-delay-${(i % 2) + 1} group relative overflow-hidden rounded-3xl border ${a.border} bg-cream-50 p-7 shadow-soft transition-all duration-300 hover:shadow-card`}
            >
              <div className="flex items-start gap-5">
                <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${a.bg} ${a.text} ring-1 ${a.ring}`}>
                  <r.icon className="h-7 w-7" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-extrabold text-cream-900">{r.name}</h3>
                    <span className={`rounded-full ${a.bg} ${a.text} px-2.5 py-0.5 text-xs font-semibold`}>
                      {r.tagline}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-cream-700">{r.blurb}</p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-cream-100 px-3 py-1.5 text-xs font-medium text-cream-700">
                    <span className="font-bold text-cream-900">Login:</span> {r.login}
                  </div>
                </div>
              </div>
              <ul className="mt-5 grid gap-2.5 border-t border-cream-200 pt-5">
                {r.responsibilities.map((resp) => (
                  <li key={resp} className="flex items-start gap-2.5 text-sm text-cream-800">
                    <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${a.bg} ${a.text}`}>
                      <Check className="h-3 w-3" />
                    </span>
                    {resp}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </Container>
  );
}

function CapabilityTable() {
  const cols = [
    { key: 'admin', label: 'Admin', icon: UserCog },
    { key: 'dispatcher', label: 'Dispatcher', icon: Map },
    { key: 'driver', label: 'Driver', icon: Users },
  ] as const;

  return (
    <Container id="capabilities" className="bg-cream-100/50">
      <SectionHeading
        eyebrow="Capability comparison"
        title={<>Who can do what, side by side</>}
        subtitle="A green check means the role can do it. A dash means it can't. No hidden permissions."
      />

      <div className="reveal mt-12 overflow-hidden rounded-3xl border border-cream-300 bg-cream-50 shadow-card">
        {/* Desktop table */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-cream-300 bg-cream-100">
                <th className="px-6 py-4 font-bold text-cream-900">Capability</th>
                {cols.map((c) => (
                  <th key={c.key} className="px-4 py-4 text-center font-bold text-cream-900">
                    <div className="flex flex-col items-center gap-1.5">
                      <c.icon className="h-5 w-5 text-coral-500" />
                      {c.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-200">
              {roleCapabilities.map((cap, i) => (
                <tr key={cap.label} className={`transition-colors hover:bg-coral-50/40 ${i % 2 === 1 ? 'bg-cream-100/40' : ''}`}>
                  <td className="px-6 py-3.5 font-medium text-cream-800">{cap.label}</td>
                  {cols.map((c) => (
                    <td key={c.key} className="px-4 py-3.5 text-center">
                      {cap[c.key] ? (
                        <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </span>
                      ) : (
                        <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-cream-200 text-cream-400">
                          <Minus className="h-4 w-4" />
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-cream-200 lg:hidden">
          {roleCapabilities.map((cap) => (
            <div key={cap.label} className="px-5 py-4">
              <p className="font-semibold text-cream-900">{cap.label}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {cols.map((c) => (
                  <div
                    key={c.key}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                      cap[c.key] ? 'bg-emerald-50 text-emerald-700' : 'bg-cream-100 text-cream-500'
                    }`}
                  >
                    {cap[c.key] ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    ) : (
                      <Minus className="h-3.5 w-3.5" />
                    )}
                    <span className="font-medium">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}

function LoginSection() {
  return (
    <Container className="bg-cream-200">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="reveal rounded-3xl border border-cream-300 bg-cream-50 p-7 shadow-soft">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-100 text-amber-600 ring-1 ring-amber-200">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="mt-5 text-xl font-bold text-cream-900">Console login (Admin)</h3>
          <p className="mt-2 text-sm leading-relaxed text-cream-700">
            Your Admin signs in through a secure web console. This is the management layer — creating
            roles, deciding what each one can access, setting up the fleet, and building routes. Roles
            and their access are dynamic, so you shape the team around how your college actually runs.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-cream-800">
            {['Admin — full control of the college', 'Dynamic roles — created and scoped by the Admin'].map((line) => (
              <li key={line} className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-emerald-500" /> {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="reveal reveal-delay-2 rounded-3xl border border-cream-300 bg-cream-50 p-7 shadow-soft">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-coral-100 text-coral-600 ring-1 ring-coral-200">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="mt-5 text-xl font-bold text-cream-900">App login (phone OTP)</h3>
          <p className="mt-2 text-sm leading-relaxed text-cream-700">
            Dispatchers and Drivers sign in to the mobile app with their phone number and a one-time
            password. No password to remember, no shared accounts — every user is a real, verified
            person with the right role.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-cream-800">
            {['Dispatcher — runs the day from the app', 'Driver — the only role that shares location'].map((line) => (
              <li key={line} className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-emerald-500" /> {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Container>
  );
}

function CtaSection() {
  return (
    <section className="relative overflow-hidden bg-cream-900 py-20 lg:py-24">
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-10" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-lavender-500/20 blur-3xl" />
      <div className="container-x relative text-center">
        <h2 className="reveal mx-auto max-w-2xl text-fluid-3xl font-extrabold tracking-tight text-cream-50 text-balance">
          The right access for every member of your team
        </h2>
        <p className="reveal reveal-delay-1 mx-auto mt-4 max-w-xl text-fluid-base text-cream-300 text-pretty">
          Pricing based on your student count. Dynamic roles and access, all included.
        </p>
        <div className="reveal reveal-delay-2 mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink size="lg" href="/how-it-works">
            See how it works
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
