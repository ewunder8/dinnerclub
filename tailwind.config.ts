/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Food Club design tokens — matches the prototype
      colors: {
        clay: {
          DEFAULT: "#C4622D",
          light: "#E8845A",
          dark: "#8F3D14",
        },
        forest: {
          DEFAULT: "#2D4A3E",
          light: "#3D6357",
        },
        cream: "#F7F0E6",
        "warm-white": "#FDFAF6",
        gold: "#D4A853",
        charcoal: "#1C1C1A",
        mid: "#6B6660",
      },
      fontFamily: {
        // Body font
        sans: ["DM Sans", "sans-serif"],
        // Display font for headings
        serif: ["Playfair Display", "serif"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
};
