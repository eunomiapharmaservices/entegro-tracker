/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        eunomia: {
          green: "#1F5C4A",
          greenLight: "#2E8B6F",
          orange: "#E07A3E",
          orangeLight: "#F0A46A",
          cream: "#FAF8F4",
          ink: "#1A2420",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};
