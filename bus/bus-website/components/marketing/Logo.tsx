import { BusFront } from 'lucide-react';

type LogoProps = {
  className?: string;
  showWordmark?: boolean;
  variant?: 'default' | 'light';
};

export default function Logo({ className = '', showWordmark = true, variant = 'default' }: LogoProps) {
  const wordColor = variant === 'light' ? 'text-cream-50' : 'text-cream-900';
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-coral-400 shadow-glow-coral">
        <BusFront className="h-5 w-5 text-cream-50" strokeWidth={2.4} />
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-lavender-400 ring-2 ring-cream-200" />
      </span>
      {showWordmark && (
        <span className={`text-lg font-extrabold tracking-tight ${wordColor}`}>
          Bus<span className="text-coral-500">Track</span>
        </span>
      )}
    </span>
  );
}
