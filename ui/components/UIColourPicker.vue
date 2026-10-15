<template>
    <!-- Component must be wrapped in a block so props such as className can be passed in from the Layout Manager -->
    <div class="nrdb-ui-colour-picker" :class="{ '--disabled': !state.enabled }">
        <!-- row: label / value field / swatch -->
        <div v-if="hasRow" class="nrdb-ui-colour-picker-row">
            <span v-if="showLabel" class="nrdb-ui-colour-picker-label">{{ label }}</span>
            <input
                v-if="cfg.showValue"
                ref="valueField"
                type="text"
                class="nrdb-ui-colour-picker-value"
                :value="displayValue"
                :disabled="!state.enabled"
                spellcheck="false"
                @focus="onValueFocus"
                @keyup.enter="onValueEnter"
                @keydown.esc="onValueEsc"
                @blur="onValueBlur"
            >
            <button
                v-if="cfg.showSwatch"
                ref="swatchEl"
                type="button"
                class="nrdb-ui-colour-picker-swatch"
                :style="{ 'background-color': swatchCssColour }"
                :disabled="!state.enabled"
                :title="label || undefined"
                @click="togglePopup"
            />
            <!-- popup picker, opened from the swatch -->
            <div v-if="popupOpen" class="nrdb-ui-colour-picker-popup">
                <PickerPanel
                    :state="hsv"
                    :round="!cfg.square"
                    :show-hue="cfg.showHue"
                    :show-lightness="cfg.showLightness"
                    :show-alpha="cfg.showAlpha"
                    :alpha-allowed="alphaAllowed"
                    :disabled="!state.enabled"
                    @update="onPanelUpdate"
                    @release="onPanelRelease"
                />
            </div>
        </div>

        <!-- always-on (inline) picker, only offered for groups wide enough to fit it -->
        <div v-if="cfg.showPicker" class="nrdb-ui-colour-picker-inline">
            <PickerPanel
                :state="hsv"
                :round="!cfg.square"
                :show-hue="cfg.showHue"
                :show-lightness="cfg.showLightness"
                :show-alpha="cfg.showAlpha"
                :alpha-allowed="alphaAllowed"
                :disabled="!state.enabled"
                @update="onPanelUpdate"
                @release="onPanelRelease"
            />
        </div>
    </div>
</template>

<script>
import tinycolor from 'tinycolor2'
import { mapState } from 'vuex' // eslint-disable-line import/order

import PickerPanel from './PickerPanel.vue'

const clamp = (v, min, max) => Math.min(Math.max(v, min), max)
const round = (v) => Math.round(v * 100) / 100

export default {
    name: 'UIColourPicker',
    components: { PickerPanel },
    inject: ['$socket', '$dataTracker'],
    props: {
        /* do not remove entries from this - Dashboard's Layout Manager's will pass this data to your component */
        id: { type: String, required: true },
        props: { type: Object, default: () => ({}) },
        state: { type: Object, default: () => ({ enabled: false, visible: false }) }
    },
    data () {
        return {
            // the current colour, in the same space the v1 picker used:
            // h = 0-360, s = 0-100, b = 0-100 (lightness or brightness, by mode),
            // a = 0-1. A null b means "not picked yet" (v1's empty state), which is
            // displayed as black and defaults to mid-lightness on first interaction
            hsv: { h: 0, s: 0, b: null, a: 1 },
            popupOpen: false,
            // text being typed into the value field, before it is committed
            draftValue: null,
            // whether the current colour has changed but not yet been sent
            dirty: false
        }
    },
    computed: {
        ...mapState('data', ['messages']),
        label () {
            return this.getProperty('label')
        },
        format () {
            return this.getProperty('format') || 'hex'
        },
        // resolve the configured options (with dynamic property support)
        cfg () {
            const bool = (key, def) => {
                let v = this.getProperty(key)
                if (typeof v === 'undefined' || v === null || v === '') { v = def }
                if (v === 'true') { return true }
                if (v === 'false') { return false }
                return !!v
            }
            // width "auto" (0/null) follows the group's width, as in v1 - this matters
            // because narrow groups collapse the widget to just the swatch
            const group = this.$store.state.ui?.groups?.[this.props.group]
            const width = +(this.props.width || group?.width || 0)
            let showSwatch = bool('showSwatch', true)
            let showPicker = bool('showPicker', false)
            let showValue = bool('showValue', false)
            // v1 behaviour: narrow groups (or a widget with nothing to show) fall back to the swatch
            if ((width < 4) || (!showPicker && !showValue)) {
                showPicker = false
                showValue = false
                showSwatch = true
            }
            const swatchOnly = width < 2 || !showValue
            return {
                width,
                swatchOnly,
                showSwatch,
                showPicker,
                showValue: showValue && !swatchOnly,
                showHue: bool('showHue', false),
                showLightness: bool('showLightness', true),
                showAlpha: bool('showAlpha', false),
                square: bool('square', false),
                dynOutput: bool('dynOutput', false)
            }
        },
        // transparency isn't supported for hex (v1 behaviour)
        alphaAllowed () {
            return this.format !== 'hex'
        },
        showLabel () {
            return this.label !== undefined && this.label !== null && this.label !== '' && !(this.cfg.showPicker && this.cfg.swatchOnly)
        },
        hasRow () {
            return this.cfg.showSwatch || this.cfg.showValue || this.showLabel
        },
        // the current colour as a tinycolor instance (black until a value exists)
        colour () {
            const { h, s, b, a } = this.hsv
            if (b === null || b === undefined) { return tinycolor('#000000') }
            const tc = this.cfg.square
                ? tinycolor({ h, s: s / 100, v: b / 100 })
                : tinycolor({ h, s: s / 100, l: b / 100 })
            return tc.setAlpha(this.alphaAllowed ? clamp(round(a), 0, 1) : 1)
        },
        /**
         * The current value, as a string in the configured format - this is the msg.payload sent to Node-RED.
         * An empty string until a colour has been picked or received (v1's empty state).
         */
        colourString () {
            if (this.hsv.b === null) { return '' }
            const alpha = this.colour.getAlpha()
            const format = this.format
            switch (format) {
                case 'hex':
                    return this.colour.setAlpha(1).toString('hex')
                case 'hex8':
                    return this.colour.toString('hex8')
                case 'rgb': {
                    const rgb = this.colour.toRgb()
                    return alpha < 1 ? `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})` : `rgb(${rgb.r},${rgb.g},${rgb.b})`
                }
                case 'hsl': {
                    const hsl = this.colour.toHsl()
                    const h = Math.round(hsl.h)
                    const s = `${Math.round(hsl.s * 100)}%`
                    const l = `${Math.round(hsl.l * 100)}%`
                    return alpha < 1 ? `hsla(${h},${s},${l},${alpha})` : `hsl(${h},${s},${l})`
                }
                case 'hsv': {
                    const hsv = this.colour.toHsv()
                    const h = Math.round(hsv.h)
                    const s = `${Math.round(hsv.s * 100)}%`
                    const v = `${Math.round(hsv.v * 100)}%`
                    return alpha < 1 ? `hsva(${h},${s},${v},${alpha})` : `hsv(${h},${s},${v})`
                }
                default:
                    return this.colour.toString(format)
            }
        },
        // the text to display in the value field; keep any draft typing while the field is in use
        displayValue () {
            return this.draftValue || this.colourString
        },
        swatchCssColour () {
            const rgb = this.colour.toRgb()
            return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rgb.a})`
        },
        payloadFromStore () {
            return this.messages?.[this.id]?.payload
        },
        currentKey () {
            // identity of this colour, used to avoid clobbering in-progress edits
            return this.colour.toString('hex8')
        }
    },
    created () {
        // setup our event handlers, and inform Node-RED that this widget has loaded.
        // no custom onInput/onLoad - the default behaviour binds received and loaded
        // msgs into the Vuex data store, which the payloadFromStore watcher picks up
        this.$dataTracker(this.id, null, null, this.onDynamicProperties)
    },
    unmounted () {
        this.removeOutsideListener()
    },
    watch: {
        payloadFromStore (payload) {
            if (payload === undefined || payload === null) { return }
            const tc = tinycolor(payload)
            if (!tc.isValid()) { return }
            // if the store only holds the value we just sent, don't clobber in-progress edits
            if (tc.toString('hex8') === this.currentKey) { return }
            this.applyColour(tc)
            this.dirty = false
        }
    },
    methods: {
        /*
            (optional) custom onDynamicProperties function to handle dynamic properties
            sent from Node-RED via msg.ui_update
        */
        onDynamicProperties (msg) {
            const updates = msg?.ui_update
            if (!updates) { return }
            const config = {}
            for (const key of ['label', 'format', 'showSwatch', 'showPicker', 'showValue', 'showHue', 'showLightness', 'showAlpha', 'square']) {
                if (typeof updates[key] !== 'undefined') {
                    config[key] = updates[key]
                }
            }
            if (Object.keys(config).length > 0) {
                this.setDynamicProperties(config)
            }
        },
        /**
         * Send the current value to Node-RED, and sync it into our local store,
         * so that we can tell apart our own sends from incoming messages
         */
        send () {
            const payload = this.colourString
            this.$socket.emit('widget-change', this.id, { payload })
            this.$store.commit('data/bind', {
                widgetId: this.id,
                msg: { payload }
            })
            this.dirty = false
        },
        /* picker surface updates - v1 uses { h, s: 0-100, b (l or v): 0-100, a: 0-1 } */
        onPanelUpdate (partial) {
            // v1: lightness is undefined until first set, and wheel clicks default it to mid
            let b
            if (partial.b !== undefined) {
                b = clamp(round(+partial.b), 0, 100)
            } else if (this.hsv.b === null || this.hsv.b === undefined) {
                b = 50
            } else {
                b = this.hsv.b
            }
            const next = {
                h: partial.h !== undefined ? clamp(+partial.h, 0, 360) : this.hsv.h,
                s: partial.s !== undefined ? clamp(round(+partial.s), 0, 100) : this.hsv.s,
                b,
                a: partial.a !== undefined ? clamp(+partial.a, 0, 1) : this.hsv.a
            }
            // don't dirty ourselves on no-op updates
            if (next.h === this.hsv.h && next.s === this.hsv.s && next.b === this.hsv.b && next.a === this.hsv.a) { return }
            this.hsv = next
            this.dirty = true
            // v1's "multiple values during editing" option
            if (this.cfg.dynOutput) { this.send() }
        },
        /**
         * when the picker is "released" (mouse up at the end of a drag), v1 sends
         * a single value - unless we're configured to send while editing
         */
        onPanelRelease () {
            if (!this.cfg.dynOutput && this.dirty) { this.send() }
        },
        /* the popup picker - not used when the picker is already shown inline */
        togglePopup () {
            if (this.cfg.showPicker) { return }
            if (this.popupOpen) {
                this.closePopup()
            } else {
                this.openPopup()
            }
        },
        openPopup () {
            this.popupOpen = true
            document.addEventListener('pointerdown', this.onPointerDownOutside, true)
        },
        closePopup () {
            this.removeOutsideListener()
            const wasOpen = this.popupOpen
            this.popupOpen = false
            // v1: one value when the picker is closed
            if (wasOpen && !this.cfg.dynOutput && this.dirty) { this.send() }
        },
        removeOutsideListener () {
            document.removeEventListener('pointerdown', this.onPointerDownOutside, true)
        },
        /**
         * the popup lives inside this widget, so any click outside of the
         * widget as a whole closes it
         */
        onPointerDownOutside (e) {
            if (this.$el && this.$el.contains(e.target)) { return }
            this.closePopup()
        },
        /* the value text field */
        onValueFocus () {
            this.draftValue = this.colourString
        },
        onValueEnter (e) {
            const tc = tinycolor(e.target.value)
            if (tc.isValid()) {
                this.applyColour(tc)
                // v1: committing a value sent it
                if (!this.cfg.dynOutput) { this.send() }
            } else {
                this.draftValue = null
            }
            if (this.$refs.valueField) { this.$refs.valueField.blur() }
        },
        onValueEsc () {
            this.draftValue = null
            if (this.$refs.valueField) { this.$refs.valueField.blur() }
        },
        onValueBlur () {
            // typing is never applied on blur - only enter, drag and release events send changes
            this.draftValue = null
        },
        /* helpers */
        applyColour (tc) {
            const hsl = this.cfg.square ? tc.toHsv() : tc.toHsl()
            this.hsv = {
                h: hsl.h,
                s: round(hsl.s * 100),
                b: round((this.cfg.square ? hsl.v : hsl.l) * 100),
                a: (tc.getAlpha() === undefined || tc.getAlpha() === null) ? 1 : round(tc.getAlpha())
            }
            this.dirty = true
        }
    }
}
</script>

<style scoped>
.nrdb-ui-colour-picker {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.nrdb-ui-colour-picker.--disabled {
    opacity: 0.5;
    pointer-events: none;
}

.nrdb-ui-colour-picker-row {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    gap: 8px;
}

.nrdb-ui-colour-picker-label {
    padding-left: 12px;
    font-size: 0.875rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.nrdb-ui-colour-picker-value {
    flex-grow: 1;
    min-width: 0;
    height: 24px;
    padding: 0 6px;
    border: 1px solid rgba(0, 0, 0, 0.25);
    border-radius: 3px;
    background: transparent;
    font-size: smaller;
    text-align: center;
}

.nrdb-ui-colour-picker-swatch {
    position: relative;
    flex-shrink: 0;
    margin-right: 8px;
    /* checkerboard under the colour so transparency is visible */
    background-image: linear-gradient(45deg, #ccc 25%, transparent 25%),
        linear-gradient(-45deg, #ccc 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #ccc 75%),
        linear-gradient(-45deg, transparent 75%, #ccc 75%);
    background-size: 8px 8px;
    background-position: 0 0, 0 4px, 4px -4px, -4px 0;
    background-color: #ffffff;
    border: 1px solid #ccc;
    border-radius: 6px;
    width: 26px;
    min-width: 26px;
    height: 26px;
    min-height: 26px;
    cursor: pointer;
    padding: 0;
}

.nrdb-ui-colour-picker-inline {
    padding-right: 1px;
    box-sizing: content-box;
}

.nrdb-ui-colour-picker-popup {
    position: absolute;
    top: calc(100% + 4px);
    right: 3px;
    z-index: 99999;
    background: white;
    border: 1px solid #ffffff;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
    padding: 1px;
    box-sizing: content-box;
}
</style>