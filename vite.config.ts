import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json' with { type: 'json' };

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    crx({ manifest }),
  ],
  build: {
    rollupOptions: {
      input: {
        sidepanel: 'sidepanel.html',
        editor: 'editor.html',
      },
    },
    // Note: @crxjs/vite-plugin internally uses rolldownOptions for content-script handling,
    // which generates a harmless Vite warning about both rollupOptions and rolldownOptions
    // being set. This is a CRX plugin implementation detail and does not affect the build.
  },
});
