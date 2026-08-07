import { ReactNode } from 'react';
import { AlertTriangle, FileText, Lock } from 'lucide-react';
import Badge from '@/components/marketing/ui/Badge';
import { brand } from '@/lib/marketing/content';

type LegalLayoutProps = {
  badgeIcon: 'lock' | 'file';
  badge: string;
  title: string;
  updated: string;
  children: ReactNode;
};

export default function LegalLayout({ badgeIcon, badge, title, updated, children }: LegalLayoutProps) {
  const Icon = badgeIcon === 'lock' ? Lock : FileText;
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-lavender-100 to-cream-200 py-14 lg:py-20">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
        <div className="container-x relative max-w-3xl">
          <Badge icon={<Icon className="h-3.5 w-3.5" />}>{badge}</Badge>
          <h1 className="mt-5 text-fluid-3xl font-extrabold tracking-tight text-cream-900 text-balance">
            {title}
          </h1>
          <p className="mt-3 text-sm text-cream-600">Last updated: {updated}</p>
        </div>
      </section>

      <div className="container-x max-w-3xl py-12 lg:py-16">
        {/* Not legal advice banner */}
        <div className="mb-10 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            <strong>This is a template, not legal advice.</strong> It’s structured for Google Play
            Store review, but you should have a qualified lawyer review and finalize it before
            relying on it. Replace every{' '}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold">[bracketed]</code>{' '}
            placeholder with your real details.
          </p>
        </div>
        <div className="space-y-8">{children}</div>

        <div className="mt-12 border-t border-cream-300 pt-6 text-sm text-cream-600">
          <p>
            Questions about this policy? Contact us at{' '}
            <a href={`mailto:${brand.supportEmail}`} className="font-semibold text-coral-600 hover:underline">
              {brand.supportEmail}
            </a>
            .
          </p>
        </div>
      </div>
    </>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="anchor-offset scroll-mt-24">
      <h2 className="text-xl font-extrabold text-cream-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-cream-700">{children}</div>
    </section>
  );
}
