import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Ancient Astral Tech palette
        astral: {
          indigo: "#0a0d2e",
          deep: "#050616",
          cyan: "#7feaff",
          gold: "#d4a437",
          ochre: "#b8842a",
          bronze: "#8c5a1a",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        twinkle: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
        drift: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(212, 164, 55, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(212, 164, 55, 0.6)" },
        },
      },
      animation: {
        twinkle: "twinkle 3s ease-in-out infinite",
        drift: "drift 6s ease-in-out infinite",
        glow: "glow 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;