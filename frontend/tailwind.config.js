/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#182135",
        paper: "#FAFAF7",
        amber: "#C97A1A",
        wire: "#DBD6C9",
      },
      fontFamily: {
        sans: ["'Inter'", "sans-serif"],
        display: ["'Space Grotesk'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
