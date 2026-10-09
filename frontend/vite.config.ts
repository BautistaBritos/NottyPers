import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 🌟 La forma moderna y rápida de borrar los console.log en producción
  esbuild: {
    drop: ['console', 'debugger'],
  },
})