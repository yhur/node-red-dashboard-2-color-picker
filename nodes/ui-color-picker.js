const tinycolor = require('tinycolor2')

// dynamic properties that can be overridden at runtime using msg.ui_update
const DYNAMIC_PROPERTIES = [
    'label',
    'format',
    'showSwatch',
    'showPicker',
    'showValue',
    'showHue',
    'showLightness',
    'showAlpha',
    'square'
]

/**
 * Convert a payload (string or rgb/hsl/hsv object) into the picker's display format.
 *
 * Mirrors the conversion behaviour of the original node-red-dashboard (v1)
 * ui_colour_picker node: the value is parsed with tinycolor2 and output in the
 * configured format; values that cannot be parsed fall back to black.
 */
function formatPayload (payload, format, outformat) {
    if (payload === undefined || payload === null) { return payload }

    const colour = tinycolor(payload)
    if (!colour.isValid()) { return '#000000' }

    const alpha = Math.round(colour.getAlpha() * 100) / 100

    if (outformat === 'object') {
        // rgb/hsl/hsv can be output as objects; hex/hex8 remain strings (v1 behaviour).
        // Opaque colours are emitted in the compact { r, g, b } shape; alpha is only
        // carried when transparency < 1, as rgb/hsl/hsv without alpha cannot express it
        if (format === 'rgb') {
            const rgb = colour.setAlpha(alpha).toRgb()
            return alpha < 1 ? rgb : { r: rgb.r, g: rgb.g, b: rgb.b }
        }
        if (format === 'hsl') {
            const hsl = colour.setAlpha(alpha).toHsl()
            const t = { h: Math.round(hsl.h), s: hsl.s, l: hsl.l }
            return alpha < 1 ? { ...t, a: alpha } : t
        }
        if (format === 'hsv') {
            const hsv = colour.setAlpha(alpha).toHsv()
            const t = { h: Math.round(hsv.h), s: hsv.s, v: hsv.v }
            return alpha < 1 ? { ...t, a: alpha } : t
        }
    }

    switch (format) {
        case 'hex':
            // v1: "Transparency is supported for all except hex"
            return colour.setAlpha(1).toString('hex')
        case 'hex8':
            return colour.setAlpha(alpha).toString('hex8')
        case 'rgb': {
            const rgb = colour.setAlpha(alpha).toRgb()
            return alpha < 1 ? `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})` : `rgb(${rgb.r},${rgb.g},${rgb.b})`
        }
        case 'hsl': {
            const hsl = colour.setAlpha(alpha).toHsl()
            const s = `${Math.round(hsl.s * 100)}%`
            const l = `${Math.round(hsl.l * 100)}%`
            const h = Math.round(hsl.h)
            return alpha < 1 ? `hsla(${h},${s},${l},${alpha})` : `hsl(${h},${s},${l})`
        }
        case 'hsv': {
            const hsv = colour.setAlpha(alpha).toHsv()
            const s = `${Math.round(hsv.s * 100)}%`
            const v = `${Math.round(hsv.v * 100)}%`
            const h = Math.round(hsv.h)
            return alpha < 1 ? `hsva(${h},${s},${v},${alpha})` : `hsv(${h},${s},${v})`
        }
        default:
            return colour.setAlpha(alpha).toString(format)
    }
}

module.exports = function (RED) {
    function ColourPickerNode (config) {
        RED.nodes.createNode(this, config)
        const node = this

        // which group are we rendering this widget in
        const group = RED.nodes.getNode(config.group)
        const base = (group && typeof group.getBase === 'function') ? group.getBase() : null

        const evts = {
            // use the Dashboard's default onChange handler: it handles msg.topic,
            // the datastore, client syncing and msg forwarding for us
            onChange: true,
            beforeSend: function (msg) {
                // dynamic property overrides, e.g. msg.ui_update = { label: 'New Label' }
                const updates = msg.ui_update
                if (updates && base && base.stores && base.stores.state) {
                    DYNAMIC_PROPERTIES.forEach(key => {
                        if (typeof updates[key] !== 'undefined') {
                            base.stores.state.set(base, node, msg, key, updates[key])
                        }
                    })
                }

                // convert the payload into the configured colour format
                if (msg.payload !== undefined && msg.payload !== null) {
                    let format = config.format
                    if (base && base.stores && base.stores.state) {
                        try {
                            const dynFormat = base.stores.state.getProperty(node.id, 'format')
                            if (dynFormat) { format = dynFormat }
                        } catch (err) {
                            // older Dashboard versions may not expose getProperty; fall back to static config
                        }
                    }
                    msg.payload = formatPayload(msg.payload, format, config.outformat)
                }
                return msg
            }
        }

        if (group) {
            // register the widget with the Dashboard
            group.register(node, config, evts)
        } else {
            node.error('No group configured')
        }
    }

    RED.nodes.registerType('ui-colour-picker', ColourPickerNode)
}