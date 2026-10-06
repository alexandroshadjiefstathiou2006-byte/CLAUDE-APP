import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["'Inter Tight'", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: { DEFAULT: "#0B0B0F", 2: "#2A2A33", 3: "#5B5B6B", 4: "#8C8C9C" },
        line: "#ECECF1",
        canvas: "#FAFAFB",
        brand: { DEFAULT: "#5B4BFF", 50: "#F2F0FF", 100: "#E6E2FF", 600: "#4A3AF0", 700: "#3B2DD1" },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,16,24,.04), 0 4px 16px rgba(16,16,24,.04)",
        lift: "0 2px 6px rgba(16,16,24,.06), 0 12px 32px rgba(16,16,24,.08)",
      },
      borderRadius: { xl2: "1.25rem" },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
        fadein: { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { shimmer: "shimmer 1.4s linear infinite", fadein: "fadein .25s ease-out" },
    },
  },
  plugins: [],
} satisfies Config;
