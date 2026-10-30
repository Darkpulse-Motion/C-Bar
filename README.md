# C-Bar

**A customisable toolbar for [Cavalry](https://cavalry.scenegroup.co), in the spirit of KBar.**
Build your own bars of shortcuts — nodes, scripts, expressions, rigs and Shelf actions — that create and *wire* layers for you.

---

## Features

- **Multiple bars**, each horizontal or vertical, opened as clean Cavalry toolbars.
- **Shortcuts of any kind**: nodes, scripts, expressions, rigs, layouts, spacers.
- **Smart creation** — when a layer or an attribute is selected, the new node is connected, parented and named for you (see [Smart behaviours](#smart-behaviours)).
- **Alt + click** on a node: pick the attribute of the selected layer to drive, from a menu organised like the Attribute Editor tabs.
- **Expressions** as buttons, applied to the selected attribute(s).
- **Rigs**: save a layer (with its children, connections, expressions, keyframes, labels) and recall it in any scene.
- **4 pages** per bar: put each shortcut on page 1, 2, 3 or 4 and switch with the page selector at the end of the bar.
- **Settings panel**: reorder (multi-selection), rename, move to another page, add spacers, manage bars.
- **Share**: export / import a single bar (with its rigs, scripts and icons) or the whole configuration.
- **Shortcut as Button**: turn any Cavalry shortcut into a button (searchable list of Cavalry's shortcuts).
- **Icons**: pick one of the 200 icons of the built-in pack (search with previews) or your own PNG, and colour it.

## Installation

1. Download the latest release (or this repository) and copy the **`C_Bar`** folder into Cavalry's Scripts folder:
   - macOS: `~/Library/Application Support/Cavalry/Scripts/`
   - Windows: the `Scripts` folder of Cavalry in your user AppData (usually `%APPDATA%\Cavalry\Scripts\`)
2. In Cavalry, open **Scripts › C_Bar › C-Bar** — this is the **Default** bar.
3. Dock it wherever you like.

Other bars are created from the Settings panel (⚙). Each one gets its own `C-Bar_<Name>.js` file (a copy of `C-Bar.js` with only its first line changed), because Cavalry opens one window per script file.

### Updating

**Settings › Update** checks the latest release on GitHub: its text turns green when a newer version exists. Click it to see the current and new version numbers and confirm; the previous `C-Bar.js` is kept in `C-Bar_assets/backup/`, the other bars are regenerated, then reopen your bars.

To update by hand, replace `C-Bar.js` only. The next time any bar opens, the other `C-Bar_<Name>.js` files are regenerated automatically; reopen the bars that were already open.
Your bars, rigs and icons live in `C-Bar_assets/` and are never touched by an update.

## Using the bar

| Button | Action |
|---|---|
| Shortcut | Click: create / run it. Alt + click: see below. |
| **+** | Add a node or script, the selected layer (favourite: a snapshot with its values, expressions, keyframes and internal links), the selected layer as a rig, an expression, a Cavalry shortcut as a button, a spacer. |
| **⚙** | Settings panel. |
| **1 2 3 4** | Page selector: show that page (the number of the current one is green). The bar opens on page 1. New shortcuts go to the page shown. |

### Smart behaviours

With a layer (or an attribute) selected when you click a shortcut:

| Node | Result |
|---|---|
| Value, Value 2/3, Value Array…, Oscillator, Number Range… with an **attribute** selected | Output connected to the attribute, node parented to the layer, named `Layer_Attribute_Node` (Position → `Pos`, Rotation → `Rot`), e.g. `Rectangle_Pos_Oscillator`. Value nodes, Blends (into *First*), Oscillator (*Value Offset*), Noise (*Offset*) and Random (*Maximum*) get the current value of the attribute, so nothing jumps. A node that outputs single numbers on a 2D / 3D attribute asks which dimension: *Both* / *All*, or X, Y, Z. |
| **String nodes** (String, String Array, Sub-String…) with a text **attribute** selected (e.g. the String of a Text Shape) | Connected, parented, named `Layer_Attribute_Node`; the current text is copied into the node (String Generator builds its own text). Alt + click only lists the layer's text attributes. With a **Text Shape** selected, String, String Array, String Generator, String From Asset and Get Name go to its String without selecting that attribute. |
| **Behaviours** (Oscillator, Noise, Align…) and path behaviours (Subdivide, Clean Up, Resample Path…) | Added to the layer's Deformers, parented, named `Layer_Node`. |
| **Filters** (Alt + click) | Added to the layer's Filters, parented, named `Layer_Filter`. |
| **Colour utilities** (Color Blend, Contrasting Color…) | Connected to the layer's Fill, parented, named `Layer_Node`. |
| **Color Array** | Click: connected to the Fill (starting with its current colour). Shift + click: built from the active palette of the Color window; with a Color Array selected (or a layer coloured by one), its colours are replaced by the palette's instead. |
| **Duplicator**, Extrude | Selected layers added to Input Shapes and parented; named `Duplicator_Layer`. |
| **Custom Shape** | Selected layer as Input Shape; named `Custom_Layer`. |
| Sub-Mesh Bounding Box, Extract Sub-Meshes | Selected layer as Input Shape. |
| **Embed in Horizontal / Vertical / Grid Layout** | Same as the Shelf buttons: the selected layers are embedded in a new layout. |

**Alt + click** on a value node with a layer selected opens a menu of the layer's attributes (grouped by Attribute Editor tab, filtered by what the node can drive), including the entries of arrays (*Value 0*, *Value 1*…).

### Organize Layout

Hold the mouse **1.5 seconds** on an empty part of the bar (or on a page button), or right-click › **Organize Layout** (first entry of the menu). The bar turns blue-grey and its shortcuts stop working:

- **drag** a shortcut and drop it on another one to take its place;
- drop it on **1 2 3 4** to move it to that page;
- **right-click** a shortcut: *Move Up / Down* (vertical bar) or *Move Left / Right* (horizontal bar), *Move to Page 1–4*, *Set Icon…*, *Icon Colour*, *Delete*;
- the dotted **+** adds a spacer at the end of the page (spacers show a dotted frame);
- the green **✓** or right-click › *Done Organizing Layout* leaves the mode (a long press only enters it).

### Expressions

Add one with **+ › Add Expression…**. Click applies it to the selected attribute(s); Alt + click lets you pick the attribute of the selected layer.

### Shortcut as Button

**+ › Add Shortcut as Button…** lists Cavalry's shortcuts (search, double-click to add), or takes keys typed by hand (`alt+w`, `cmd+shift+d`…). A click on the button presses those keys in Cavalry — handy for commands that scripts cannot run, such as *Solo Selection in Viewport*. On macOS, allow Cavalry in *System Settings › Privacy & Security › Accessibility* (C-Bar tells you when it is needed).

### Rigs

Select a layer and use **+ › Add Selected Layers as Rig…**. Choose what to include (children, connected layers, expressions, keyframes, labels) and give it a name and description. The rig button recreates it in the active composition, just under the selected layer.

### Settings panel (⚙)

- **Shortcuts** of the bar selected below: drag to reorder (Shift / Cmd for several), double-click to rename, **…** to move to another page, edit an expression or a Shortcut as Button, or set the icon. The **1 2 3 4** selector above the list chooses the page shown.
- **Add…**, **Spacer**, **Reset / Clear Bar**, **Hide page selector** (off by default).
- **Bars**: click to edit, double-click to open, **…** for Open, Duplicate, Rename, Switch to Vertical / Horizontal, Export Bar, Delete.
- **?**: credits, version and a link to this page.
- **Bar…**: New Bar…, Import Bar…, Export Bar… (the bar selected in the list), Update Bars. **Config…**: Config Import, Config Export, Open Folder.

### Icons

- **Set Icon…** (Settings › **…**, or right-click in Organize Layout): a window with the 200 icons of the pack, a search field and previews; click one to use it. **Other PNG…** takes your own file (ideally 40 × 40 px).
- **Icon Colour**: White, Green, Yellow, Blue, Red or any hex colour. The original image is kept, so colours never degrade.
- **Remove Custom Icon**: back to the default icon.
- You can still put a PNG named exactly like the button in `C-Bar_assets/icons/` — e.g. `Value x -1.png`.

## Folder structure

```
C_Bar/
├── C-Bar.js                  ← the code (Default bar)
├── C-Bar_<Name>.js           ← generated, one per extra bar
└── C-Bar_assets/
    ├── bars/                 ← one JSON per bar (your shortcuts)
    ├── rigs/                 ← saved rigs
    ├── icons/                ← custom icons
    │   └── base/             ← icon pack (Tabler Icons)
    └── scripts/              ← scripts imported with a bar
```

## Known limitations

- A bar's orientation is fixed when its window opens: after *Switch to Vertical / Horizontal*, close and reopen the bar.
- Cavalry scripts cannot read the keyboard: no Esc shortcut in the dialogs.
- When docked, the size of the window is controlled by Cavalry.

## Compatibility

Developed and tested on **Cavalry 2.x, macOS**. Windows feedback is welcome — please open an [issue](../../issues).

## Releasing (maintainer)

1. Set `CBAR_VERSION` near the top of `C-Bar.js` and rename *Unreleased* in the CHANGELOG to that version.
2. Commit, then create a GitHub Release whose tag is `v` + that version (e.g. `v0.9.2`). *Update* only looks at the latest Release, not at `main`.

## Contributing

Bug reports and ideas are welcome in the **Issues** tab: describe what you did, what you expected, your Cavalry version and OS, and add a screenshot if you can.

## License

[MIT](LICENSE)

The icon pack in `C-Bar_assets/icons/base/` comes from [Tabler Icons](https://tabler.io/icons) (MIT, © Paweł Kuna — see `_LICENSE-tabler.txt`).

## Special thanks

Many thanks to my friends **[Antonin](https://www.instagram.com/antonin.work/)** and **[Julien](https://www.instagram.com/shoobaka/)** for their help in creating C-Bar.
