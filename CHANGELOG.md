# Changelog

## Unreleased

### Added
- **Edit Layout** (first version): hold the mouse 2 s on an empty part of the bar or on a page button, or right-click > *Edit Layout*. The shortcuts stop working and can be dragged: drop one on another to take its place, or on **1 2 3 4** to move it to that page. **+** adds a spacer at the end of the page, **OK** leaves the mode.
- Edit Layout: holding a shortcut to drag it no longer leaves the mode (a long press only enters it), and dragging on a vertical bar follows the mouse (it went the opposite way, and the shortcut below the pressed one was highlighted). Page buttons still change page while editing.
- Page selector: no grey square any more, the number is centred, and only the white frame marks the page shown.
- Settings changes (e.g. *Hide page selector*) no longer come back a few seconds later: each bar file write is stamped, and an older copy of the file put back by a folder sync (pCloud…) is ignored and overwritten with the current version.

### Changed
- **Pages replace categories.** Each bar has 4 pages; the solo buttons (colour dots, S, E, R) are replaced by a page selector **1 2 3 4** with a white frame on the page shown. The bar opens on page 1, and new shortcuts go to the page shown. In Settings, rows are grouped by page and "…" > *Move to Page N* works on several rows at once. *View solo buttons* becomes *Hide page selector* (off by default). Existing shortcuts are on page 1; categories and their colour chips are gone.
- Every node inserted on a selected attribute (Oscillator, Noise, Number Range, Blends, Value nodes…) is now named `Layer_Attribute_Node`, with Position and Rotation shortened to `Pos` and `Rot` (e.g. `Rectangle_Pos_Oscillator`). Color Arrays keep `Color Array_Layer`.

### Fixed
- Docked horizontal bars: the horizontal scroll bar now appears when the panel is narrower than the buttons (the scroll view no longer takes the width of its content as its minimum, and the bar follows panel resizes even when Cavalry does not report them).
- Value Array, Value2 Array, Value3 Array, Color Array linked to an attribute: the current value is now really copied into the first entry. Each possible entry path is written then read back (a wrong path did not always raise an error, so the copy could silently fail); an entry is added if the array is empty.
- Value 2 Array / Value 2 linked to a Position that is not 0,0: no more "Attribute not found: array.0.value / array.0.color" errors in the console. A Position has three components and a Value 2 two, so the read-back check failed and other paths were tried; values are now compared on the components they share, and only paths that exist on the node are written.
- Value Blend, Value 2 Blend, Value 3 Blend linked to an attribute: its current value is copied into "First", so nothing jumps.
- Windows: after a message or a file dialog opened from a secondary window (Add, Expression, Rig, Bar, Config), that window comes back in front of Settings instead of being hidden behind it. The Add window also opens in front of Settings like the other windows.

### Rigs
- Recalling a rig now lists, in the console, the inputs that come from layers outside the rig. Rigs remember the scene they were saved from, so the message asks you to check those links when the rig is recalled in another scene (where such a layer id can point to an unrelated layer). Exported bars do not include that scene path.

## v0.9.0 — 2026-10-20 (beta)

First public beta.

### Bars
- One `C-Bar.js` manages any number of bars (horizontal or vertical), stored as JSON in `C-Bar_assets/bars/`.
- Generated `C-Bar_<Name>.js` files are refreshed automatically when any bar opens.
- Settings: new, duplicate, rename, delete (to the Trash), switch orientation, export / import a bar, config import / export.
- "+" and ⚙ follow the shortcuts; solo category buttons are pinned to the end of the bar.
- Horizontal / vertical scrolling when the window is too small.

### Shortcuts
- Nodes, scripts, expressions, rigs, Shelf layout actions, spacers.
- Categories with colour chips in Settings and solo filters on the bar.
- Multi-selection in Settings (reorder, delete, set category).
- Custom icons: `C-Bar_assets/icons/<Button name>.png`.

### Smart creation
- Value nodes linked to the selected attribute, keeping its current value; named `Layer_Attribute_Node`.
- Alt + click attribute picker organised by Attribute Editor tabs.
- Behaviours and path behaviours added to Deformers; filters to Filters; colour utilities to the Fill.
- Color Array from the Fill or from the active palette (Shift + click).
- Duplicator / Extrude, Custom Shape, Sub-Mesh nodes use the selected layers as inputs.
- Embed in Horizontal / Vertical / Grid Layout, like the Shelf.

### Expressions & rigs
- Expression buttons applied to the selected attributes.
- Rigs saved with options (children, connections, expressions, keyframes, labels) and recalled in the active composition.
