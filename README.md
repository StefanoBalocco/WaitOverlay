# WaitOverlay

A flexible loading overlay for the browser. Started as a refactor of [jquery-loading-overlay](https://gasparesganga.com/labs/jquery-loading-overlay/).

---

## Features

- **Whole-page or element-specific**: Show overlays on `<body>` or any DOM element.
- **Multiple content types**: SVG spinner, raster images, custom HTML, text, and progress bar.
- **Responsive sizing**: Auto-resize elements based on container dimensions.
- **CSS animations**: Built-in rotate, fade-in, and pulse animations.
- **Reference counting**: Each container tracks how many `Show` calls are active so the overlay stays visible until everyone hides it.
- **Lightweight**: Minimal overhead, single file.

---

## Usage

```html
<script type="module">
import WaitOverlay from 'https://cdn.jsdelivr.net/gh/StefanoBalocco/WaitOverlay/WaitOverlay.min.js';

const overlay = WaitOverlay.GetInstance();
overlay.Show( { text: { enabled: true, value: "Loading..." } } );
// Later...
overlay.Hide();
</script>
```

## API

### `WaitOverlay.GetInstance()`

Returns the singleton instance. Creates it on first call.

```javascript
const overlay = WaitOverlay.GetInstance();
```

---

### Instance Methods

#### `Show( options?, container? )`

Shows an overlay for the requested container (defaults to `document.body`). The method merges the supplied `options` with the global defaults; when an overlay is already active for the container, the existing settings continue to apply until the overlay is hidden.

```javascript
const overlay = WaitOverlay.GetInstance();
overlay.Show( { text: { enabled: true, value: "Loading..." } } );
const el = document.getElementById( "my-form" );
overlay.Show( { text: { enabled: true, value: "Saving..." } }, el );
```

- **`options`** (`Partial<Settings>`, optional): Overrides for the overlay that is being shown. Additional options are ignored while the overlay is already visible.
- **`container`** (`Element`, optional): Target element. Defaults to `document.body`.

#### `Hide( force?, container? )`

Decrements the reference count for the target container. The overlay is removed when the counter reaches zero or when `force` is `true`. The first argument is the force flag so that calls like `overlay.Hide( false, el )` work intuitively.

```javascript
const overlay = WaitOverlay.GetInstance();
overlay.Hide();
const el = document.getElementById( "my-form" );
overlay.Hide( false, el );
overlay.Hide( true );
```

- **`force`** (`boolean`, optional): When `true`, hides the overlay immediately even if other `Show` calls are still active.
- **`container`** (`Element`, optional): Target element. Defaults to `document.body`.

#### `Resize( container? )`

Recomputes sizes and positions for the overlay associated with `container`.

```javascript
const overlay = WaitOverlay.GetInstance();
overlay.Resize();
```

- **`container`** (`Element`, optional): Target element. Defaults to `document.body`.

#### `Text( value, container? )`

Updates the textual label, or hides it.

```javascript
const overlay = WaitOverlay.GetInstance();
overlay.Text( "Almost done..." );
overlay.Text( false );
```

- **`value`** (`string | false`): Text to display or `false` to hide.
- **`container`** (`Element`, optional): Target element. Defaults to `document.body`.

> **Note**: No-op if the overlay was not configured with `text`.

#### `Progress( value, container? )`

Adjusts the progress bar value or hides it.

```javascript
const overlay = WaitOverlay.GetInstance();
overlay.Progress( 50 );
overlay.Progress( false );
```

- **`value`** (`number | false`): Value between `progressMin` and `progressMax`, or `false` to hide.
- **`container`** (`Element`, optional): Target element. Defaults to `document.body`.

> **Note**: No-op if the overlay was not configured with `progress: true`.

#### `Destroy( container? )`

Clears intervals, removes the overlay from the DOM, and forgets the cached state for the container.

```javascript
const overlay = WaitOverlay.GetInstance();
overlay.Destroy();
```

- **`container`** (`Element`, optional): Target element. Defaults to `document.body`.

#### `Configure( settings )`

Sets global default overrides that are merged before building overlays in future `Show` calls.

```javascript
const overlay = WaitOverlay.GetInstance();
overlay.Configure( {
    background: "rgba(0, 0, 0, 0.7)",
    image: { color: { fill: "#ffffff" } },
    text: { color: "#ffffff" }
} );
```

- **`settings`** (`Partial<Settings>`): Any subset of the settings object (see [Settings](#settings) below).

---

## Settings

All settings are optional. Defaults are shown below.

### Background

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `background` | `string` | `"rgba(255, 255, 255, 0.8)"` | CSS background value for the overlay. |
| `backgroundClass` | `string` | `""` | CSS class for the overlay background. If set, `background` is ignored. |

### Image

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `image.enabled` | `boolean` | `true` | Whether the image is shown. |
| `image.value` | `string` | *(SVG spinner)* | Inline SVG, SVG URL, data URI, or raster image URL. |
| `image.class` | `string` | `""` | CSS class for the image element. |
| `image.autoResize` | `boolean` | `true` | Auto-resize image with container. |
| `image.resizeFactor` | `number` | `1` | Resize multiplier relative to computed size. |
| `image.color.fill` | `string` | `"#202020"` | Fill color for SVG. |
| `image.color.stroke` | `string \| undefined` | `undefined` | Stroke color for SVG. |
| `image.order` | `number` | `1` | Flexbox order. |
| `image.animation.name` | `string` | `"rotate_right"` | Animation name. |
| `image.animation.time` | `string` | `"2000ms"` | Animation duration (CSS time value). |

### Custom

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `custom.enabled` | `boolean` | `false` | Whether custom HTML is shown. |
| `custom.value` | `string` | `""` | Custom HTML string to inject. |
| `custom.autoResize` | `boolean` | `true` | Auto-resize with container. |
| `custom.resizeFactor` | `number` | `1` | Resize multiplier. |
| `custom.order` | `number` | `3` | Flexbox order. |
| `custom.animation.name` | `string` | `""` | Animation name. |
| `custom.animation.time` | `string` | `""` | Animation duration (CSS time value). |

### Text

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `text.enabled` | `boolean` | `false` | Whether the text is shown. |
| `text.value` | `string` | `""` | Text to display. |
| `text.class` | `string` | `""` | CSS class for the text element. |
| `text.autoResize` | `boolean` | `true` | Auto-resize with container. |
| `text.resizeFactor` | `number` | `0.5` | Resize multiplier. |
| `text.color` | `string` | `"#202020"` | Text color. |
| `text.order` | `number` | `4` | Flexbox order. |
| `text.animation.name` | `string` | `""` | Animation name. |
| `text.animation.time` | `string` | `""` | Animation duration (CSS time value). |

### Progress

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `progress.enabled` | `boolean` | `false` | Whether the progress bar is shown. |
| `progress.class` | `string` | `""` | CSS class for the progress bar. |
| `progress.autoResize` | `boolean` | `true` | Auto-resize with container. |
| `progress.resizeFactor` | `number` | `0.25` | Resize multiplier. |
| `progress.min` | `number` | `0` | Minimum value for progress calculation. |
| `progress.max` | `number` | `100` | Maximum value for progress calculation. |
| `progress.speed` | `number` | `200` | Transition speed in ms for progress bar width changes. |
| `progress.position` | `"" \| "top" \| "bottom"` | `""` | Fixed position for progress bar. |
| `progress.margin` | `string` | `""` | Margin for progress bar (when `position` is set). |
| `progress.color` | `string` | `"#a0a0a0"` | Progress bar color. |
| `progress.order` | `number` | `5` | Flexbox order. |

### Sizing

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `size.value` | `number` | `50` | Base size value. |
| `size.units` | `Units` | `""` | Size units. Empty string = percentage of container's smallest dimension. Supported: `"vmin"`, `"vmax"`, `"em"`, `"rem"`, `"pt"`, `"pc"`, `"in"`, `"cm"`, `"mm"`, `"vh"`, `"vw"`, `"px"`. |
| `maxSize` | `number` | `120` | Maximum computed size in pixels (only for percentage-based sizing). |
| `minSize` | `number` | `20` | Minimum computed size in pixels (only for percentage-based sizing). |

### Misc

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `direction` | `string` | `"column"` | Flexbox direction: `"column"` or `"row"`. |
| `fade` | `[number, number]` | `[400, 200]` | Fade animation as `[fadeInMs, fadeOutMs]`. Use `[0, 0]` to disable. |
| `resize` | `boolean` | `true` | Whether automatic resize is enabled. |
| `zIndex` | `number \| undefined` | `2147483647` | CSS z-index for the overlay. |

### Animations

The `*Animation` settings accept a string with a time and/or animation name, in any order:

- `"2000ms rotate_right"` — 2 seconds, rotate clockwise
- `"rotate_left"` — default time (2s), rotate counter-clockwise
- `"500ms"` — 500ms, default animation (rotate_right)
- `"pulse 1s"` — 1 second, pulse animation

Available animations: `rotate_right`, `rotate_left`, `fadein`, `pulse`.

---

## Example

```html
<!DOCTYPE html>
<html>
<head></head>
<body>
    <div id="content" style="width: 400px; height: 300px; border: 1px solid #ccc;">
        <p>Some content here</p>
    </div>

    <script type="module">
        import WaitOverlay from './waitOverlay.min.js';

        const overlay = WaitOverlay.GetInstance();

        // Show whole-page overlay with text
        overlay.Show( { text: { enabled: true, value: "Loading page..." } } );

        // Hide after 3 seconds
        setTimeout( () => overlay.Hide(), 3000 );

        // Show overlay on a specific element with progress
        const el = document.getElementById( "content" );
        overlay.Show( {
            text: { enabled: true, value: "Processing..." },
            progress: { enabled: true, color: "#3498db" }
        }, el );

        // Update progress
        setTimeout( () => overlay.Progress( 25, el ), 500 );
        setTimeout( () => overlay.Progress( 50, el ), 1000 );
        setTimeout( () => overlay.Progress( 75, el ), 1500 );
        setTimeout( () => {
            overlay.Progress( 100, el );
            overlay.Text( "Done!", el );
        }, 2000 );
        setTimeout( () => overlay.Hide( false, el ), 2500 );
    </script>
</body>
</html>
```

---

## Contributing

Contributions are welcome! Please submit issues or pull requests on the GitHub repository.

---

## License

WaitOverlay is released under the BSD-3-Clause License.
