/* global module */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        aiims: {
          50: '#f0f7ff',
          100: '#e0effe',
          600: '#005596',
          700: '#00447a',
          900: '#0f172a',
        },
        surface: {
          light: '#f8fafc',
          dark: '#020617',
        },
      },
      borderRadius: {
        portal: '12px',
      },
    },
  },
}
