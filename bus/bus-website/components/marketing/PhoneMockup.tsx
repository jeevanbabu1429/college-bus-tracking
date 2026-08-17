import { BusFront, MapPin, BellRing, Navigation } from 'lucide-react';

/**
 * A decorative "live map" phone mockup for the hero. Pure CSS/SVG — no real map tiles.
 */
export default function PhoneMockup({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      {/* Glow */}
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-coral-300/40 via-lavender-300/30 to-transparent blur-2xl" />

      {/* Phone frame */}
      <div className="relative mx-auto w-[280px] rounded-[2.25rem] border-[7px] border-cream-900 bg-cream-900 shadow-lift sm:w-[300px]">
        {/* Notch */}
        <div className="absolute left-1/2 top-0 z-20 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-cream-900" />

        {/* Screen */}
        <div className="relative h-[560px] overflow-hidden rounded-[1.75rem] bg-cream-50">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-3 text-[10px] font-semibold text-cream-800">
            <span>9:41</span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-coral-400" />
              BusBee
            </span>
          </div>

          {/* Map area */}
          <div className="relative mx-3 mt-2 h-[380px] overflow-hidden rounded-2xl bg-cream-100">
            {/* Map grid */}
            <div className="absolute inset-0 bg-dots opacity-60" />

            {/* Roads */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 280 380" fill="none">
              <path d="M-10 120 Q 80 100 150 150 T 300 200" stroke="#c4b69a" strokeWidth="10" strokeLinecap="round" fill="none" />
              <path d="M60 -10 Q 80 120 140 200 T 200 400" stroke="#c4b69a" strokeWidth="8" strokeLinecap="round" fill="none" />
              <path d="M-10 260 Q 100 240 180 300 T 300 340" stroke="#c4b69a" strokeWidth="7" strokeLinecap="round" fill="none" />
              {/* Route line */}
              <path d="M30 80 Q 90 110 130 160 Q 170 210 150 280 Q 130 330 210 350"
                stroke="#ff8a5b" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="2 6" fill="none" />
            </svg>

            {/* Stops */}
            {[
              { top: '18%', left: '12%' },
              { top: '42%', left: '44%' },
              { top: '68%', left: '52%' },
              { top: '88%', left: '72%' },
            ].map((s, i) => (
              <div
                key={i}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ top: s.top, left: s.left }}
              >
                <div className="grid h-5 w-5 place-items-center rounded-full bg-cream-900 text-[8px] font-bold text-cream-50 ring-2 ring-cream-50">
                  {i + 1}
                </div>
              </div>
            ))}

            {/* Moving bus marker */}
            <div className="absolute" style={{ top: '42%', left: '44%' }}>
              <div className="relative">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-coral-400" />
                <div className="relative grid h-9 w-9 place-items-center rounded-full bg-coral-400 text-cream-50 shadow-glow-coral ring-4 ring-cream-50">
                  <BusFront className="h-4 w-4" strokeWidth={2.5} />
                </div>
              </div>
            </div>

            {/* You-are-here */}
            <div className="absolute bottom-[8%] left-[72%] -translate-x-1/2 -translate-y-1/2">
              <div className="grid h-6 w-6 place-items-center rounded-full bg-lavender-500 text-cream-50 ring-4 ring-cream-50">
                <Navigation className="h-3 w-3" strokeWidth={3} />
              </div>
            </div>
          </div>

          {/* Bottom card */}
          <div className="mx-3 mt-3 rounded-2xl bg-cream-50 p-3 shadow-soft ring-1 ring-cream-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-coral-100">
                  <BusFront className="h-4 w-4 text-coral-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-cream-900">Bus 42 · Route A</p>
                  <p className="flex items-center gap-1 text-[10px] text-cream-600">
                    <MapPin className="h-2.5 w-2.5" /> Approaching Stop 2
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                LIVE
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-lavender-50 px-2.5 py-2">
              <BellRing className="h-3.5 w-3.5 text-lavender-600" />
              <p className="text-[10px] font-medium text-lavender-700">Arriving soon — one stop away</p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating stat card */}
      <div className="absolute -left-6 top-20 hidden animate-float rounded-2xl bg-cream-50 p-3 shadow-lift ring-1 ring-cream-200 sm:block">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-cream-500">Update rate</p>
        <p className="text-xl font-extrabold text-coral-600">5s</p>
        <p className="text-[9px] text-cream-600">while moving</p>
      </div>

      {/* Floating notification card */}
      <div className="absolute -right-4 bottom-28 hidden animate-float-slow rounded-2xl bg-cream-50 p-3 shadow-lift ring-1 ring-cream-200 sm:block">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-lavender-100">
            <BellRing className="h-3.5 w-3.5 text-lavender-600" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-cream-900">Push sent</p>
            <p className="text-[9px] text-cream-600">Trip started · Bus 42</p>
          </div>
        </div>
      </div>
    </div>
  );
}
