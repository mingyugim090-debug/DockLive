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
    },
  },
  plugins: [],
};
export default config;
