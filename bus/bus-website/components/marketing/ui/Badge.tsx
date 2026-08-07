import { ReactNode } from 'react';

type BadgeProps = {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export default function Badge({ children, icon, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-coral-300/60 bg-coral-50/80 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-coral-700 backdrop-blur ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
