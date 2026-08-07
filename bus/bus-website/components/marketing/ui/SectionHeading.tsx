import { HTMLProps, ReactNode } from 'react';

type SectionHeadingProps = {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: 'left' | 'center';
  className?: string;
} & Omit<HTMLProps<HTMLDivElement>, 'title'>;

export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  className = '',
}: SectionHeadingProps) {
  const alignClass = align === 'center' ? 'mx-auto text-center' : 'text-left';
  return (
    <div className={`max-w-2xl ${alignClass} ${className}`}>
      {eyebrow && (
        <p className="reveal mb-3 text-xs font-bold uppercase tracking-[0.18em] text-coral-600">
          {eyebrow}
        </p>
      )}
      <h2 className="reveal reveal-delay-1 text-fluid-2xl font-extrabold tracking-tight text-cream-900 text-balance">
        {title}
      </h2>
      {subtitle && (
        <p className="reveal reveal-delay-2 mt-4 text-fluid-base text-cream-700 text-pretty">
          {subtitle}
        </p>
      )}
    </div>
  );
}
