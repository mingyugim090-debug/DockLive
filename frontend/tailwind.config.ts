import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        bg: "var(--bg)",
        card: "var(--card)",
        card2: "var(--card2)",
        text: "var(--text)",
        text2: "var(--text2)",
        text3: "var(--text3)",
        primary: "rgb(var(--primary-rgb) / <alpha-value>)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite linear",
        "fade-in-up": "fade-in-up 0.45s ease forwards",
        "pulse-dot": "pulse-dot 1.5s ease-in-out infinite",
      },
      boxShadow: {
        panel: "0 18px 52px rgba(0,0,0,0.28)",
        primary: "0 14px 34px rgba(92,106,255,0.26)",
        "sm-dark": "0 2px 8px rgba(0,0,0,0.18)",
      },
      borderRadius: {
        DEFAULT: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
