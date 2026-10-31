/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        valle: {
          blue: '#004d99',
          'blue-dark': '#003366',
          'blue-light': '#e8f1fb',
          yellow: '#fdd835',
          'yellow-border': '#ffcc00',
        },
        pitch: {
          light: '#2d8a4e',
          dark: '#247441',
          line: '#ffffff',
        }
      },
    },
  },
  plugins: [],
}
