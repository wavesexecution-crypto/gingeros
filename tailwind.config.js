/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#F7F8FA",
        panel: "#FFFFFF",
        panel2: "#EEF1F4",
        line: "#DCE3EA",
        body: "#667085",
        muted: "#6F7682",
        navy: "#071A3D",
        navy2: "#0B234D",
        accent: "#00C8D7",
        accentHover: "#00A0AD",
        accent2: "#69C39A",
        danger: "#FF6B61",
        info: "#7FA7D9",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
