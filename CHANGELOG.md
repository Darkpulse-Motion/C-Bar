# Changelog

## Unreleased

### Added
- A node that outputs single numbers (Value, Oscillator, Value Array…) created with a 2D / 3D attribute selected opens a small menu: **Both (X, Y)** / **All (X, Y, Z)** (as before) or one dimension (e.g. *Scale Y*). Cavalry does not tell a script which field is being edited, so it is asked. A node linked to one dimension is named with the axis, e.g. `Rectangle_PosY_Oscillator`.

## v0.9.3 — 2026-10-20 (beta)

### Fixed
- Cavalry crashed on any click in Organize Layout: the list of bar buttons used to recognise empty parts of the bar still pointed to the buttons of the normal layout, which are destroyed when the mode starts. The list is now rebuilt with the layout.

## v0.9.2 — 2026-10-20 (beta)

First public release. From this version on, *Settings › Update* installs new releases; coming from v0.9.1, replace `C-Bar.js` by hand once.

### Fixed
- Organize Layout no longer starts by itself after a click, an Alt + click or the + menu: the press on a button also reached the bar, but not its release. The long press now only starts on an empty part of the bar, and any button click cancels it.
- String nodes (String, String Array, String Generator, Sub-String…): linking one to a text attribute (e.g. the String of a Text Shape) now works and copies the current text into the node (into the first entry of a String Array; String Generator builds its own text). Alt + click on a String node only lists the layer's text attributes.
- String Array (and the other arrays) linked to an attribute: the text or value goes into the existing first entry; arrays no longer get an extra empty entry.
- macOS: Settings (and the other C-Bar windows) no longer stay in front of other applications: they are hidden while Cavalry is not the active application and come back when you return to Cavalry.

### Changed
- **Add Selected Layer** saves a snapshot of the node: values, expressions, keyframes and the links between its own attributes (e.g. an Oscillator whose Minimum is driven by its Maximum with `value*-1`). Links to other layers are not kept. Favourites saved before keep working with their settings.
- Settings: *New Bar*, *Import Bar*, *Export Bar* and *Update Bars* are grouped in one **Bar…** button (Update Bars below a separator).
- Settings: the update button reads **Update** and is drawn like the other buttons (same height, fill and border).

### Added
- **Update** button in Settings, next to *Config…*: it checks the latest GitHub Release, turns green when a newer version exists, and installs it after a confirmation showing the current and new version numbers. The previous `C-Bar.js` is kept in `C-Bar_assets/backup/` and the other bars are regenerated. The script now carries its version (`CBAR_VERSION`).
- With a Text Shape selected (and no attribute selected), String, String Array, String Generator, String From Asset and Get Name are linked to its String automatically.
- Settings: round **?** button with the credits and the version number; **Ok** opens the GitHub page.

## v0.9.1 — 2026-10-20 (beta, private test)

### Added
- **Organize Layout**: hold the mouse 1.5 s on an empty part of the bar or on a page button, or right-click > *Organize Layout* (first entry of the menu). The shortcuts stop working and can be dragged: the dragged shortcut stays highlighted, the gap where it will go opens with a dotted line, and dropping it on a page button (highlighted under the mouse) moves it to that page. **+** adds a spacer at the end of the page, the green **✓** leaves the mode (a long press only enters it).
- Organize Layout: right-click a shortcut for *Move Up / Down* (vertical bar) or *Move Left / Right* (horizontal bar), *Move to Page 1–4* and *Delete*.

### Changed
- **Pages replace categories.** Each bar has 4 pages; the solo buttons (colour dots, S, E, R) are replaced by a page selector **1 2 3 4** (light grey squares, green number on the page shown). The bar opens on page 1, and new shortcuts go to the page shown. Settings has its own page selector above the shortcuts list, which shows one page at a time; reordering only affects that page, and "…" > *Move to Page N* works on several rows at once. *View solo buttons* becomes *Hide page selector* (off by default). Existing shortcuts are on page 1; categories and their colour chips are gone.
- Every node inserted on a selected attribute (Oscillator, Noise, Number Range, Blends, Value nodes…) is now named `Layer_Attribute_Node`, with Position and Rotation shortened to `Pos` and `Rot` (e.g. `Rectangle_Pos_Oscillator`). Color Arrays keep `Color Array_Layer`.
- Page selector: the page shown has a green number (#4ffd7a) instead of a white frame.
- Organize Layout: the **+** button is a dotted frame with a small + (it adds a spacer) (the OK button is now a green ✓).
- Settings: the title above the shortcuts list (bar name and page) is gone; the page selector stays at the top right.
- Organize Layout: the OK button is replaced by a green check mark (✓, #4ffd7a) that fits the bar.
- The layout mode is now called **Organize Layout**: first entry of the right-click menu, tooltip on the empty parts of the bar, and a tip at the top of Settings explain how to enter it.

### Fixed
- Settings changes (e.g. *Hide page selector*) no longer come back a few seconds later: each bar file write is stamped, and an older copy of the file put back by a folder sync (pCloud…) is ignored and overwritten with the current version.
- Script tiles were drawn slightly off-centre (`cavalry.Path.addRect` takes two corners, not a width and height).
- Docked horizontal bars: the horizontal scroll bar now appears when the panel is narrower than the buttons (the scroll view no longer takes the width of its content as its minimum, and the bar follows panel resizes even when Cavalry does not report them).
- Value Array, Value2 Array, Value3 Array, Color Array linked to an attribute: the current value is now really copied into the first entry. Each possible entry path is written then read back (a wrong path did not always raise an error, so the copy could silently fail); an entry is added if the array is empty.
- Value 2 Array / Value 2 linked to a Position that is not 0,0: no more "Attribute not found: array.0.value / array.0.color" errors in the console. A Position has three components and a Value 2 two, so the read-back check failed and other paths were tried; values are now compared on the components they share, and only paths that exist on the node are written.
- Value Blend, Value 2 Blend, Value 3 Blend linked to an attribute: its current value is copied into "First", so nothing jumps.
- Windows: after a message or a file dialog opened from a secondary window (Add, Expression, Rig, Bar, Config), that window comes back in front of Settings instead of being hidden behind it. The Add window also opens in front of Settings like the other windows.
- The bar keeps Cavalry's default background after Organize Layout (leaving the mode painted the whole bar with another grey).
- Clicking *Hide page selector* in Settings no longer switches the bar to Organize Layout: a pending long press is cancelled whenever the bar is rebuilt or Settings opens.
- Right-click on an empty part of the bar or on a page button opens the bar menu again (with *Organize Layout* first): the long-press handler had taken the right-click away from the window.
- Settings: the Organize Layout tip takes the whole width of the panel (it was squeezed next to the page selector).

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
