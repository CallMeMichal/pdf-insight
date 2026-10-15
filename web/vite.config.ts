import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Demo działa pod https://callmemichal.github.io/pdf-insight/, więc wszystkie zasoby
// (w tym worker pdf.js) muszą być serwowane spod tej ścieżki.
export default defineConfig({
  base: '/pdf-insight/',
  plugins: [react()],
});
