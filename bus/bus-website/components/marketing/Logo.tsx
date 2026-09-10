type LogoProps = {
  className?: string;
  showWordmark?: boolean;
  variant?: 'default' | 'light';
};

/**
 * The Busszo lockup: the artwork mark in a white tile, plus the wordmark set in
 * the site's display face.
 *
 * The mark is cropped from the full app icon so its baked-in "Busszo" lettering
 * is not in the image — at 36px that text is an unreadable smudge, and it would
 * fight the HTML wordmark sitting right next to it. The uncropped square lives
 * at public/brand/busszo-logo.png (and app/icon.png) for favicons and OG cards,
 * where it is rendered large enough to read.
 *
 * The house style here is a plain <img> rather than next/image (see PhoneShot) —
 * these are small, fixed-size assets and the site is deployed standalone.
 */
export default function Logo({
  className = '',
  showWordmark = true,
  variant = 'default',
}: LogoProps) {
  const light = variant === 'light';

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-[3px] shadow-soft ${
          light ? 'ring-1 ring-white/25' : 'ring-1 ring-cream-300/70'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/busszo-mark.png"
          alt=""
          width={512}
          height={431}
          className="h-full w-full object-contain"
        />
      </span>
      {showWordmark && (
        <span
          className={`text-xl font-extrabold tracking-tight ${
            light ? 'text-cream-50' : 'text-busszo-ink'
          }`}
        >
          Buss
          <span className={light ? 'text-busszo-yellow' : 'text-busszo-gold'}>
            zo
          </span>
        </span>
      )}
    </span>
  );
}
