import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',  // <--- THIS IS THE MAGIC FIX (Dot-Slash)
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})