import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";
import tailwindcssAnimate from "tailwindcss-animate";
import ftPreset from "ft-design-system/tailwind-preset";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}", "./node_modules/ft-design-system/**/*.{js,jsx}"],
  presets: [ftPreset],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // Compat: map remaining shadcn utility class names to FT tokens
      colors: {
        border: 'var(--border-primary)',
        ring: 'var(--focus)',
        destructive: {
          DEFAULT: 'var(--critical)',
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: 'var(--neutral-light)',
          foreground: 'var(--neutral-dark)',
        },
      },
      ringOffsetColor: {
        background: 'var(--bg-primary)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateX(-10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
      },
    },
  },
  plugins: [typography, tailwindcssAnimate],
} satisfies Config;
