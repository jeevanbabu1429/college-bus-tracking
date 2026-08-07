import type { Config } from "tailwindcss";

/**
 * Tailwind powers the public marketing site only. The admin console is plain
 * CSS (app/globals.css), so two guards keep the two systems apart:
 *
 *   preflight: false  — no global element reset, so Tailwind cannot restyle
 *                       the admin console's buttons, tables or headings.
 *   important: '.mkt' — every utility is emitted as `.mkt .flex { … }`, so a
 *                       class name that exists in both worlds (`.table`,
 *                       `.hidden`, `.fixed`) only takes effect inside the
 *                       marketing wrapper.
 *
 * The reset the marketing pages actually need is hand-written and scoped to
 * `.mkt` in app/marketing.css.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  important: ".mkt",
  // `important` only scopes the utilities layer, so anything Tailwind emits
  // into the components layer would land unscoped. Preflight and the built-in
  // `container` are the only two, and neither is used here.
  corePlugins: { preflight: false, container: false },
  theme: {
    extend: {
      colors: {
        // Brand palette — mirrors the admin dashboard
        cream: {
          50: "#f7f2e7",
          100: "#f0e9d8",
          200: "#ebe4d5",
          300: "#ddd2bc",
          400: "#c4b69a",
          500: "#a8997a",
          600: "#8a7c60",
          700: "#6e6249",
          800: "#534b39",
          900: "#3a3528",
        },
        coral: {
          50: "#fff5f0",
          100: "#ffe6da",
          200: "#ffc9b3",
          300: "#ffa884",
          400: "#ff8a5b",
          500: "#ff6b3d",
          600: "#ed4f22",
          700: "#c43c18",
          800: "#9c3015",
          900: "#7e2a14",
        },
        lavender: {
          50: "#f6f4ff",
          100: "#ede9ff",
          200: "#ddd5ff",
          300: "#c4b8ff",
          400: "#a896ff",
          500: "#8b73ff",
          600: "#7357f0",
          700: "#5e42d4",
          800: "#4f37ab",
          900: "#423087",
        },
      },
      fontFamily: {
        sans: ["var(--font-display)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        "fluid-xs": "clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)",
        "fluid-sm": "clamp(0.875rem, 0.83rem + 0.22vw, 1rem)",
        "fluid-base": "clamp(1rem, 0.95rem + 0.25vw, 1.125rem)",
        "fluid-lg": "clamp(1.125rem, 1.05rem + 0.35vw, 1.375rem)",
        "fluid-xl": "clamp(1.375rem, 1.25rem + 0.6vw, 1.75rem)",
        "fluid-2xl": "clamp(1.75rem, 1.5rem + 1.2vw, 2.5rem)",
        "fluid-3xl": "clamp(2.25rem, 1.8rem + 2.2vw, 3.75rem)",
        "fluid-4xl": "clamp(2.75rem, 2rem + 3.5vw, 5rem)",
      },
      maxWidth: {
        "8xl": "88rem",
      },
      // The marketing markup asks for h-13 / h-18 / pt-18, which are not on
      // Tailwind's default scale.
      spacing: {
        13: "3.25rem",
        18: "4.5rem",
      },
      // Registered as real theme shadows (rather than hand-written classes) so
      // variants like `hover:shadow-lift` are generated.
      boxShadow: {
        soft: "0 1px 2px rgba(58, 53, 40, 0.04), 0 4px 16px rgba(58, 53, 40, 0.06)",
        card: "0 2px 4px rgba(58, 53, 40, 0.04), 0 12px 32px rgba(58, 53, 40, 0.08)",
        lift: "0 8px 24px rgba(58, 53, 40, 0.10), 0 24px 56px rgba(58, 53, 40, 0.12)",
        "glow-coral":
          "0 0 0 1px rgba(255, 138, 91, 0.2), 0 12px 40px rgba(255, 138, 91, 0.28)",
        "glow-lavender":
          "0 0 0 1px rgba(168, 150, 255, 0.2), 0 12px 40px rgba(139, 115, 255, 0.28)",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "fade-in-up": "fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in-down": "fadeInDown 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-in-right": "slideInRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "scale-in": "scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float 9s ease-in-out infinite",
        "pulse-ring": "pulseRing 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        marquee: "marquee 30s linear infinite",
        "spin-slow": "spin 8s linear infinite",
        "bounce-soft": "bounceSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(28px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          "0%": { opacity: "0", transform: "translateY(-24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(40px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.8)", opacity: "0.8" },
          "80%, 100%": { transform: "scale(2.4)", opacity: "0" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        bounceSoft: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
