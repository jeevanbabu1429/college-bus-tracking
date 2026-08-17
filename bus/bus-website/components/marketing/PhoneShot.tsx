import type { ReactNode } from 'react';

/**
 * A device frame wrapping a real app screenshot. The screenshots already carry
 * their own status bar, so there's no notch overlay — just a clean phone shell.
 * `children` render inside the same relative box for floating accent cards.
 */
export default function PhoneShot({
  src,
  alt,
  width = 280,
  glow = false,
  className = '',
  children,
}: {
  src: string;
  alt: string;
  width?: number;
  glow?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`relative ${className}`}>
      {glow && (
        <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-coral-300/40 via-lavender-300/30 to-transparent blur-2xl" />
      )}

      <div
        className="relative mx-auto rounded-[2.25rem] border-[7px] border-cream-900 bg-cream-900 shadow-lift"
        style={{ width }}
      >
        <div className="overflow-hidden rounded-[1.75rem] bg-cream-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="block h-auto w-full" loading="lazy" />
        </div>
      </div>

      {children}
    </div>
  );
}
