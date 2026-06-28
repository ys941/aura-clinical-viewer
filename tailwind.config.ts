import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core surfaces — deep navy primary
        navy: {
          950: "#060a16",
          900: "#0a1023",
          850: "#0d1530",
          800: "#111b3d",
          700: "#18244f",
          600: "#22315f",
        },
        // Medical blue
        medical: {
          50: "#eef6ff",
          100: "#d8eaff",
          200: "#b4d6ff",
          300: "#82baff",
          400: "#4f97ff",
          500: "#2b76f5",
          600: "#1a5ae0",
          700: "#1747b8",
          800: "#173c91",
          900: "#173672",
        },
        // Teal accent
        teal: {
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
        },
        // Clinical severity
        critical: "#ff4d5e",
        warn: "#ffb020",
        good: "#1fcf8e",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(45,212,191,0.25), 0 8px 40px -8px rgba(20,184,166,0.35)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 10px 40px -20px rgba(0,0,0,0.8)",
      },
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(45,212,191,0.5)" },
          "70%": { boxShadow: "0 0 0 10px rgba(45,212,191,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(45,212,191,0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2s infinite",
        shimmer: "shimmer 2s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
