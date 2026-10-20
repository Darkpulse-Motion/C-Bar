# Changelog

## Unreleased

### Fixed
- Docked horizontal bars: the horizontal scroll bar now appears when the panel is narrower than the buttons (the scroll view no longer takes the width of its content as its minimum, and the bar follows panel resizes even when Cavalry does not report them).
- Value Array, Value2 Array, Value3 Array, Color Array linked to an attribute: the current value is now really copied into the first entry. Each possible entry path is written then read back (a wrong path did not always raise an error, so the copy could silently fail); an entry is added if the array is empty.
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
