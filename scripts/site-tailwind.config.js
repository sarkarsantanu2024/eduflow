/**
 * Tailwind config for the STATIC MARKETING PAGE ONLY (public/site.html).
 *
 * The app itself uses tailwind.config.ts at the repo root; this file exists
 * solely so the marketing page can ship a pre-built stylesheet instead of the
 * play CDN (cdn.tailwindcss.com), which downloaded a full compiler and
 * generated utilities in the browser on every single visit.
 *
 * Regenerate after editing site.html:
 *     npm run build:site-css
 *
 * It must stay a faithful copy of the `tailwind.config` block that used to sit
 * inline in site.html — every shade reads from a CSS variable, so flipping
 * `:root.dark` re-themes every existing bg-/text-/border- utility with no
 * markup change. Adding a shade here without adding its --var to the <style>
 * block in site.html produces a utility that resolves to nothing.
 */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/site.html"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: v("brand-50"), 100: v("brand-100"), 200: v("brand-200"),
          300: v("brand-300"), 400: v("brand-400"), 500: v("brand-500"),
          600: v("brand-600"), 700: v("brand-700"), 800: v("brand-800"),
          900: v("brand-900"),
        },
        ink: {
          50: v("ink-50"), 100: v("ink-100"), 200: v("ink-200"),
          300: v("ink-300"), 400: v("ink-400"), 500: v("ink-500"),
          600: v("ink-600"), 700: v("ink-700"), 800: v("ink-800"),
          900: v("ink-900"),
        },
        // 300 was used by the Free card's hover border but never defined in the
        // old inline config, so that hover state silently did nothing.
        emerald: {
          50: v("em-50"), 200: v("em-200"), 300: v("em-300"),
          600: v("em-600"), 700: v("em-700"), 800: v("em-800"),
        },
        rose: { 500: v("rose-500"), 600: v("rose-600") },
        surface: v("surface"),
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        display: ['"Plus Jakarta Sans"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,23,42,.04), 0 8px 24px -12px rgba(15,23,42,.12)",
        lift: "0 12px 32px -12px rgba(234,88,12,.35)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: { rise: "rise .5s ease-out both" },
    },
  },
  plugins: [],
};
