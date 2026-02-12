// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        aiims: {
          50: '#f0f7ff',
          100: '#e0effe',
          600: '#005596', // AIIMS Institutional Blue
          700: '#00447a',
          900: '#0f172a',
        },
        surface: {
          light: '#f8fafc',
          dark: '#020617',
        }
      },
      borderRadius: {
        'portal': '12px',
      }
    },
  },
}