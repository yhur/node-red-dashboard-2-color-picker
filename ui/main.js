/**
 * Used only for development (via `vite` on localhost, or `npm run dev` for watch mode).
 *
 * This file lets you test your component in isolation from Node-RED, by stubbing
 * the Dashboard-provided globals (socket, data tracker, mixins, Vuex store).
 */
import { createApp } from 'vue'
import { createStore } from 'vuex'

import UIColourPicker from './components/UIColourPicker.vue'

// the Vuex store slices the widget uses, mirroring the Dashboard's shape
const store = createStore({
    modules: {
        data: {
            namespaced: true,
            state: { messages: {} },
            mutations: {
                bind (state, { widgetId, msg }) {
                    state.messages[widgetId] = msg
                }
            }
        },
        ui: {
            state: {}
        }
    }
})

// stub of the Dashboard's socket - logs every send so you can see what the widget emits
const socket = {
    on () {},
    off () {},
    emit (event, id, msg) {
        console.log(`[stub socket] ${event}:`, id, msg)
        store.commit('data/bind', { widgetId: id, msg })
    }
}

const app = createApp(UIColourPicker, {
    id: 'test-widget',
    props: {
        label: 'Default',
        width: 6,
        format: 'hex',
        showSwatch: true,
        showPicker: false,
        showValue: false,
        showHue: false,
        showLightness: true,
        showAlpha: false,
        square: 'false'
    },
    state: { enabled: true, visible: true }
})
app.use(store)
app.provide('$socket', socket)
app.provide('$dataTracker', () => {})

// stubs of the Dashboard's global mixin methods
app.config.globalProperties.getProperty = function (property) {
    return this.props[property]
}
app.config.globalProperties.setDynamicProperties = function (config) {
    for (const key in config) {
        this.props[key] = config[key]
    }
}

app.mount('#app')