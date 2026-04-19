/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          400: "#ff8a75",
          500: "#ff7a59",
          600: "#e06b4e",
        },
        violet: {
          500: "#8a2be2",
          600: "#7a22cc",
        },
      },
    },
  },
  plugins: [],
};
