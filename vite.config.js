import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

// The playground is the whole Vite app here: the package itself ships raw
// source and is never built (see README, "How it is shipped"). `npm run build`
// exists so CI can prove every component still compiles.
export default defineConfig({
    root: 'playground',
    plugins: [vue()],
    resolve: {
        alias: {
            'board-kit': fileURLToPath(new URL('./src/index.js', import.meta.url)),
        },
    },
    build: {
        outDir: '../dist-playground',
        emptyOutDir: true,
    },
});
