# node-red-dashboard-2-color-picker

A **color picker** widget for [Node-RED Dashboard 2.0](https://github.com/FlowFuse/node-red-dashboard) (`@flowfuse/node-red-dashboard`), ported from the original `node-red-dashboard` (v1) `ui_colour_picker`, which is not available in Dashboard 2.0.

It keeps the look and feel of the v1 picker: a circular hue/saturation wheel with vertical hue, lightness and transparency columns (or the square saturation/brightness grid when the `square` option is set), a colour swatch that opens the picker, and an optional value field.

## Installing

Requirements:

- Node-RED 3.0.0+
- `@flowfuse/node-red-dashboard` 0.8.0+ (Dashboard 2.0)

Run this in your Node-RED user directory (`~/.node-red`) then restart Node-RED:

```bash
npm install node-red-dashboard-2-color-picker
```

Or install it straight from a local folder while testing:

```bash
npm install <path to this folder>
```

The node appears in the Dashboard 2.0 palette section alongside the built-in widgets, and is placed into a `ui-group` as usual. To use, simply wire an optional input into it and use the color picker in the UI; the picked colour will be sent to the output nodes.

## Node Usage

### Inputs

- `payload` (*string* | *object*): if set, will pre-fill the picker with the specified colour. Can accept any valid colour format, e.g. `'#ff0000'`, `'red'`, `'rgb(255,0,0)'`, `{ r: 255, g: 0, b: 0 }`. Values that cannot be parsed fall back to `#000000`.
- `enabled` (*boolean*): if set to `false`, the widget is greyed out and cannot be changed.
- `ui_update` (*object*): dynamic properties - see [Dynamic Properties](#dynamic-properties).

### Outputs

1. Standard output - `msg.payload` contains the current colour value.

- **Payload as a string**: the color is a string in the chosen **Format** (e.g. `hex` → `#ff0000`).
- **Payload as an object** (for `rgb`/`hsl`/`hsv` Formats): opaque colours are emitted in the compact shape - `rgb`: `{ payload: { r: 255, g: 35, b: 0 } }`, `hsl`: `{ h, s, l }`, `hsv`: `{ h, s, v }`; when transparency < 1 an `a` property is included. The node accepts the same shapes on input. For `hex`/`hex8` formats the payload remains a string (v1 behaviour).
- The lightness/brightness column starts at the bottom like v1's empty state; the first interaction on the wheel defaults it to mid (50), as in v1.

- The **Topic** field uses a typedInput, so can be set to `msg`, `flow`, or `global` variables, or a static string.

## Config Options

The following options match the v1 color picker:

| Option | Description |
| --- | --- |
| Label | the label shown next to the widget |
| Format | how the colour is rendered/sent - `hex`, `hex8`, `hsl`, `hsv` or `rgb` |
| Payload | whether to send the current value as a string or an object |
| Square | use a square saturation/brightness grid instead of the round wheel (the round wheel is the v1 default look) |
| Show hue slider | adds a hue column (used by the square mode to pick the hue) |
| Show lightness slider | adds the vertical lightness/brightness column |
| Show transparency slider | adds a transparency slider (not available for `hex` format) |
| Always show swatch/value field/picker | for groups with width ≥ 4; at smaller widths the widget falls back to a swatch that opens the picker |
| Send | emit **one value when released/closed**, or **multiple values during editing** |
| Pass through | if `msg` arrives on input, pass through to output |

## Dynamic Properties

Any of the following widget options can be set at runtime by sending a `msg.ui_update` object:

- `label` (*string*)
- `format` (*string*): `hex`/`hex8`/`hsl`/`hsv`/`rgb`
- `showSwatch`, `showPicker`, `showValue`, `showHue`, `showLightness`, `showAlpha` (*boolean*)
- `square` (*boolean*)

The CSS class can be changed at runtime via `msg.class` (handled by Dashboard 2.0 itself).

## Building this widget

The front-end (.vue components) are bundled into `resources/ui-color-picker.umd.js` with Vite. After editing anything under `ui/`, run:

```bash
npm install
npm run build
```

For frontend debugging, `npm run dev` rebuilds on change with source maps enabled; `index.html` provides a minimal dev environment (with a stubbed SocketIO connection) reachable via `npm exec vite` on `http://localhost:5173`.

## Credits

Ported from the original `ui_colour_picker` node in `node-red-dashboard` (Apache-2.0, OpenJS Foundation) and the picker visuals from `angularjs-color-picker` (Apache-2.0) used by that dashboard.