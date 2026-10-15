import { resolve } from 'path'

import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// Set to the name of this collection of components.
// This must match node-red-dashboard-2.widgets[libraryName] in package.json,
// as Dashboard 2 looks for the built library on window[libraryName].
const LIBRARY_NAME = 'ui-colour-picker'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        // inject any CSS into the built JS - Dashboard only loads the single .umd.js file
        cssInjectedByJsPlugin()
    ],
    build: {
        // generate a source map in development mode
        sourcemap: process.env.NODE_ENV === 'development',

        // build as a UMD library that the Dashboard loads from /resources
        lib: {
            entry: resolve(__dirname, 'ui/index.js'),
            name: LIBRARY_NAME,
            formats: ['umd'],
            fileName: (format) => `${LIBRARY_NAME}.${format}.js`
        },

        // write the .umd.js straight into the folder Node-RED serves
        outDir: './resources',
        emptyOutDir: false,

        rollupOptions: {
            // Vue/vuex are provided globally by @flowfuse/node-red-dashboard
            external: ['vue', 'vuex'],
            output: {
                globals: {
                    vue: 'Vue',
                    vuex: 'vuex'
                }
            }
        }
    }
})