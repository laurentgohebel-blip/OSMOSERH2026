import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Azure Static Web Apps attend "build" comme output_location par defaut
    outDir: 'build',
  },
});
