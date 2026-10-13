import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The HEIC converter is one ~3 MB chunk, loaded only when someone adds a HEIC photo.
    chunkSizeWarningLimit: 3100,
  },
})
