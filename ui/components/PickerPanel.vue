<template>
    <!--
        The picker surface of the colour picker, matching the look and feel of
        the original node-red-dashboard (v1) colour picker: a circular hue /
        saturation wheel plus vertical hue, lightness and transparency columns
        (or a square saturation/brightness grid and hue column in "square" mode).
    -->
    <div class="nrdb-cp-panel" :class="{ '--disabled': disabled }">
        <div class="nrdb-cp-grid-wrapper">
            <div class="nrdb-cp-row">
                <div
                    ref="grid"
                    class="nrdb-cp-grid"
                    :class="{ '--round': round, '--square': !round }"
                    :style="gridStyle"
                    @pointerdown="onGridPointerDown"
                >
                    <div class="nrdb-cp-picker" :style="pickerPosStyle">
                        <div :style="{ 'background-color': pickerDotColour }" />
                    </div>
                </div>
                <div
                    v-if="showHue"
                    ref="hue"
                    class="nrdb-cp-column"
                    @pointerdown.stop="onColumnPointerDown('hue', $event)"
                >
                    <div class="nrdb-cp-column-bg" :style="hueBackground" />
                    <div class="nrdb-cp-slider" :style="{ top: `${(1 - state.h / 360) * 100}%` }" />
                </div>
                <div
                    v-if="showLightness"
                    ref="lightness"
                    class="nrdb-cp-column"
                    @pointerdown.stop="onColumnPointerDown('lightness', $event)"
                >
                    <div class="nrdb-cp-column-bg" :style="lightnessBackground" />
                    <div class="nrdb-cp-slider" :style="{ top: `${(1 - lightness / 100) * 100}%` }" />
                </div>
                <div
                    v-if="showAlpha && alphaAllowed"
                    ref="alpha"
                    class="nrdb-cp-column"
                    @pointerdown.stop="onColumnPointerDown('alpha', $event)"
                >
                    <div class="nrdb-cp-column-bg" :style="alphaBackground" />
                    <div class="nrdb-cp-slider" :style="{ top: `${(1 - state.a) * 100}%` }" />
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import wheelRound from '../wheels/wheel-round.png'
import wheelSquare from '../wheels/wheel-square.png'

/**
 * The picker surface: the wheel (or square grid) plus vertical hue, lightness
 * and transparency columns.
 *
 * `state` is `{ h, s, b, a }` where h = 0-360, s = 0-100 (%),
 * b = 0-100 (lightness in round mode, brightness/value in square mode)
 * and a = 0-1 (alpha). This component keeps no colour state of its own and
 * only emits `update` events with the changed parts, and a `release` event at
 * the end of each pointer drag.
 */
const clamp = (v, min, max) => Math.min(Math.max(v, min), max)
const RAD2DEG = 57.29577951308233

export default {
    name: 'PickerPanel',
    props: {
        state: { type: Object, required: true },
        round: { type: Boolean, default: true },
        showHue: { type: Boolean, default: false },
        showLightness: { type: Boolean, default: true },
        showAlpha: { type: Boolean, default: false },
        alphaAllowed: { type: Boolean, default: true },
        disabled: { type: Boolean, default: false }
    },
    emits: ['update', 'release'],
    computed: {
        // b of this.state, shown as 0 (bottom of the column) until first set,
        // matching the v1 picker's empty state
        lightness () {
            const b = this.state.b
            return (b === null || b === undefined) ? 0 : b
        },
        // the colour at the picker's cursor position
        colour () {
            const { h, s, a } = this.state
            const b = this.lightness
            const rgb = this.round
                ? hslToRgb(h, s / 100, b / 100)
                : hsvToRgb({ h, s: s / 100, v: b / 100 })
            return { ...rgb, a: (this.alphaAllowed && a !== undefined) ? a : 1 }
        },
        pickerDotColour () {
            const { r, g, b, a } = this.colour
            return `rgba(${r}, ${g}, ${b}, ${a})`
        },
        gridStyle () {
            const { h, a } = this.state
            const b = this.lightness
            const opacity = this.alphaAllowed ? a : 1
            if (this.round) {
                // the wheel image sits over a base carrying the lightness of the
                // current colour - exactly as the v1 picker rendered it
                return {
                    'background-color': `hsl(${h}, 0%, ${b}%)`,
                    'background-image': `url(${wheelRound})`,
                    'background-size': '100% 100%',
                    'background-repeat': 'no-repeat',
                    opacity
                }
            }
            // square mode: the current hue at full brightness, under a
            // white/black fade image (saturation left-to-right)
            const rgb = hsvToRgb({ h, s: 1, v: 1 })
            return {
                'background-color': `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
                'background-image': `url(${wheelSquare})`,
                'background-size': '100% 100%',
                'background-repeat': 'no-repeat',
                opacity
            }
        },
        pickerPosStyle () {
            if (this.round) {
                const angle = this.state.h * Math.PI / 180
                const px = Math.cos(angle) * this.state.s
                const py = -Math.sin(angle) * this.state.s
                const x = (px + 100) / 2
                const y = (py + 100) / 2
                return { left: `${x}%`, top: `${y}%` }
            }
            return { left: `${this.state.s}%`, top: `${100 - this.lightness}%` }
        },
        hueBackground () {
            const stops = [0, 60, 120, 180, 240, 300, 359]
            const colours = stops.map((h, i) => {
                const rgb = hsvToRgb({ h, s: 1, v: 1 })
                return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b}) ${(i / (stops.length - 1)) * 100}%`
            })
            return { 'background-image': `linear-gradient(to bottom, ${colours.join(', ')})` }
        },
        lightnessBackground () {
            const { h, s } = this.state
            if (this.round) {
                // lightness ramp in HSL space
                return {
                    'background-image': `linear-gradient(to bottom, hsl(${h}, ${s}%, 100%) 0%, hsl(${h}, ${s}%, 50%) 50%, hsl(${h}, ${s}%, 0%) 100%)`
                }
            }
            // brightness (value) ramp in HSV space, using the current saturation
            const stops = [1, 0.5, 0].map((v) => {
                const rgb = hsvToRgb({ h, s: s / 100, v })
                return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
            })
            return { 'background-image': `linear-gradient(to bottom, ${stops[0]} 0%, ${stops[1]} 50%, ${stops[2]} 100%)` }
        },
        alphaBackground () {
            const { r, g, b } = this.colour
            return { 'background-image': `linear-gradient(to bottom, rgba(${r}, ${g}, ${b}, 1) 0%, rgba(${r}, ${g}, ${b}, 0) 100%)` }
        }
    },
    methods: {
        /**
         * Shared drag handling: pointer down + move call `calculate`, release
         * notifies the parent (used for v1's "one value when released" mode).
         */
        startDrag (calculate, event) {
            if (this.disabled) { return }
            calculate(event)
            const move = (ev) => calculate(ev)
            const up = () => {
                window.removeEventListener('pointermove', move)
                window.removeEventListener('pointerup', up)
                window.removeEventListener('pointercancel', up)
                this.$emit('release')
            }
            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', up)
            window.addEventListener('pointercancel', up)
        },
        /* round wheel: hue = angle, saturation = radius */
        wheelCalc (event) {
            const rect = this.$refs.grid.getBoundingClientRect()
            const dx = ((event.clientX - rect.left) * 2 / rect.width) - 1
            const dy = 1 - ((event.clientY - rect.top) * 2 / rect.height)
            let hue = Math.round(Math.atan2(dy, dx) * RAD2DEG)
            if (hue < 0) { hue += 360 }
            const sat = clamp(Math.sqrt(dx * dx + dy * dy), 0, 1) * 100
            this.$emit('update', { h: hue, s: sat })
        },
        /* square grid: saturation = x, brightness = y */
        squareCalc (event) {
            const rect = this.$refs.grid.getBoundingClientRect()
            const s = clamp((event.clientX - rect.left) / rect.width, 0, 1) * 100
            const b = (1 - clamp((event.clientY - rect.top) / rect.height, 0, 1)) * 100
            this.$emit('update', { s, b })
        },
        onGridPointerDown (e) {
            e.preventDefault()
            if (this.disabled) { return }
            this.startDrag(this.round ? this.wheelCalc : this.squareCalc, e)
        },
        onColumnPointerDown (type, e) {
            e.preventDefault()
            const el = this.$refs[type]
            const max = type === 'hue' ? 360 : 100
            const calculate = (event) => {
                const rect = el.getBoundingClientRect()
                const v = clamp(Math.round((1 - (event.clientY - rect.top) / rect.height) * max), 0, max)
                if (type === 'hue') {
                    // hue is 0-360
                    if (v === this.state.h) { return }
                    this.$emit('update', { h: v === 360 ? 359 : v })
                } else if (type === 'lightness') {
                    if (v === this.state.b) { return }
                    this.$emit('update', { b: v })
                } else {
                    if (v / 100 === this.state.a) { return }
                    this.$emit('update', { a: v / 100 })
                }
            }
            this.startDrag(calculate, e)
        }
    }
}

/**
 * Colour conversions - the v1 picker's round mode works in HSL space, while
 * the square mode works in HSV space.
 */
function hslToRgb (h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s
    const hp = h / 60
    const x = c * (1 - Math.abs((hp % 2) - 1))
    let r; let g; let b
    if (hp < 1) { r = c; g = x; b = 0 } else if (hp < 2) { r = x; g = c; b = 0 } else if (hp < 3) { r = 0; g = c; b = x } else if (hp < 4) { r = 0; g = x; b = c } else if (hp < 5) { r = x; g = 0; b = c } else { r = c; g = 0; b = x }
    const m = l - (c / 2)
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) }
}

function hsvToRgb ({ h, s, v }) {
    const i = Math.floor(h / 60) % 6
    const f = (h / 60) - Math.floor(h / 60)
    const p = v * (1 - s)
    const q = v * (1 - f * s)
    const t = v * (1 - (1 - f) * s)
    let r; let g; let b
    switch (i) {
        case 0: r = v; g = t; b = p; break
        case 1: r = q; g = v; b = p; break
        case 2: r = p; g = v; b = t; break
        case 3: r = p; g = q; b = v; break
        case 4: r = t; g = p; b = v; break
        default: r = v; g = p; b = q
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}
</script>

<!--
    Styling deliberately kept close to the v1 colour picker's default theme,
    but scoped under .nrdb-cp- classes (unscoped: shared between the popup and
    inline panels).
-->
<style>
.nrdb-cp-panel.--disabled {
    opacity: 0.5;
    pointer-events: none;
}

.nrdb-cp-row {
    display: flex;
}

/* the checkerboard behind everything makes transparency visible */
.nrdb-cp-grid,
.nrdb-cp-column {
    background-image: linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%);
    background-size: 10px 10px;
    background-position: 0 0, 0 5px, 5px -5px, -5px 0;
    background-color: white;
}

.nrdb-cp-grid {
    position: relative;
    width: 150px;
    height: 150px;
    cursor: crosshair;
    touch-action: none;
    user-select: none;
}

.nrdb-cp-grid.--round {
    border-radius: 50%;
}

.nrdb-cp-picker {
    position: absolute;
    width: 12px;
    height: 12px;
    border: solid 1px black;
    border-radius: 10px;
    margin-top: -6px;
    margin-left: -6px;
    background: none;
    box-sizing: content-box;
    pointer-events: none;
}

.nrdb-cp-picker > div {
    position: absolute;
    top: 0;
    left: 0;
    width: 8px;
    height: 8px;
    border-radius: 8px;
    border: solid 2px white;
    box-sizing: content-box;
}

.nrdb-cp-column {
    position: relative;
    width: 20px;
    cursor: row-resize;
    touch-action: none;
    background-repeat: repeat;
}

.nrdb-cp-column-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.nrdb-cp-slider {
    position: absolute;
    left: 0;
    width: 18px;
    height: 2px;
    background: white;
    border: solid 1px black;
    box-sizing: content-box;
    margin-top: -1px;
    pointer-events: none;
}
</style>