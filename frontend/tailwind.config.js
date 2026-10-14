/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        court: {
          bg: "#080886",
          line: "#FFFFFF",
        },
        kitchen: "#1515A9",
        ball: "#637EFF",
        beginner: "#90D8FF",
        average: "#6FA2FF",
        advance: "#4779EA",
      },
      fontFamily: {
        display: ["'Anton'", "'Barlow Condensed'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
