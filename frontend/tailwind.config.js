/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#EC4899",
        secondary: "#FB7185",
      },
    },
  },
  plugins: [],
};