/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary — Slate
        slate: {
          DEFAULT: "#2b3245",
          light:   "#3a4460",
          faint:   "#eef0f8",
        },
        // Accent — Citrus
        citrus: {
          DEFAULT: "#f5c842",
          dark:    "#c49a00",
          light:   "#fff8d6",
        },
        // Neutrals
        ink:     "#1a1f30",
        "ink-muted": "#4a5270",
        "ink-faint": "#8a90a8",
        snow:    "#f2f3f6",
        surface: "#ffffff",
      },
      fontFamily: {
        sans:    ["Syne", "sans-serif"],
        display: ["Syne", "sans-serif"],
        body:    ["Plus Jakarta Sans", "sans-serif"],
      },
      borderRadius: {
        xl:  "14px",
        "2xl": "18px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
};