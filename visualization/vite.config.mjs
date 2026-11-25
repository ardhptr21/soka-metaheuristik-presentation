import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({
  root:fileURLToPath(new URL('.',import.meta.url)),
  base:'./',
  server:{host:'127.0.0.1'},
  build:{outDir:fileURLToPath(new URL('../deploy/visualization',import.meta.url)),emptyOutDir:true,chunkSizeWarningLimit:800}
});
