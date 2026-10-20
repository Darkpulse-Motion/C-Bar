# C-Bar

**A customisable toolbar for [Cavalry](https://cavalry.scenegroup.co), in the spirit of KBar.**
Build your own bars of shortcuts — nodes, scripts, expressions, rigs and Shelf actions — that create and *wire* layers for you.

> 🇫🇷 Une version française du guide rapide est disponible [en bas de page](#guide-rapide-fr).

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
- **Custom icons**: drop `<Button name>.png` in `C-Bar_assets/icons/`.

## Installation

1. Download the latest release (or this repository) and copy the **`C_Bar`** folder into Cavalry's Scripts folder:
   - macOS: `~/Library/Application Support/Cavalry/Scripts/`
   - Windows: the `Scripts` folder of Cavalry in your user AppData (usually `%APPDATA%\Cavalry\Scripts\`)
2. In Cavalry, open **Scripts › C_Bar › C-Bar** — this is the **Default** bar.
3. Dock it wherever you like.

Other bars are created from the Settings panel (⚙). Each one gets its own `C-Bar_<Name>.js` file (a copy of `C-Bar.js` with only its first line changed), because Cavalry opens one window per script file.

### Updating

Replace `C-Bar.js` only. The next time any bar opens, the other `C-Bar_<Name>.js` files are regenerated automatically; reopen the bars that were already open.
Your bars, rigs and icons live in `C-Bar_assets/` and are never touched by an update.

## Using the bar

| Button | Action |
|---|---|
| Shortcut | Click: create / run it. Alt + click: see below. |
| **+** | Add a node or script, the selected layer (favourite), the selected layer as a rig, an expression, a spacer. |
| **⚙** | Settings panel. |
| **1 2 3 4** | Page selector: show that page (the current one has a white frame). The bar opens on page 1. New shortcuts go to the page shown. |

### Smart behaviours

With a layer (or an attribute) selected when you click a shortcut:

| Node | Result |
|---|---|
| Value, Value 2/3, Value Array…, Oscillator, Number Range… with an **attribute** selected | Output connected to the attribute, node parented to the layer, named `Layer_Attribute_Node` (Position → `Pos`, Rotation → `Rot`), e.g. `Rectangle_Pos_Oscillator`. Value nodes and Blends (into *First*) get the current value of the attribute, so nothing jumps. |
| **Behaviours** (Oscillator, Noise, Align…) and path behaviours (Subdivide, Clean Up, Resample Path…) | Added to the layer's Deformers, parented, named `Layer_Node`. |
| **Filters** (Alt + click) | Added to the layer's Filters, parented, named `Layer_Filter`. |
| **Colour utilities** (Color Blend, Contrasting Color…) | Connected to the layer's Fill, parented, named `Layer_Node`. |
| **Color Array** | Click: connected to the Fill (starting with its current colour). Shift + click: built from the active palette of the Color window. |
| **Duplicator**, Extrude | Selected layers added to Input Shapes and parented; named `Duplicator_Layer`. |
| **Custom Shape** | Selected layer as Input Shape; named `Custom_Layer`. |
| Sub-Mesh Bounding Box, Extract Sub-Meshes | Selected layer as Input Shape. |
| **Embed in Horizontal / Vertical / Grid Layout** | Same as the Shelf buttons: the selected layers are embedded in a new layout. |

**Alt + click** on a value node with a layer selected opens a menu of the layer's attributes (grouped by Attribute Editor tab, filtered by what the node can drive).

### Edit Layout

Hold the mouse **2 seconds** on an empty part of the bar (or on a page button), or right-click › **Edit Layout**. The bar turns blue-grey and its shortcuts stop working:

- **drag** a shortcut and drop it on another one to take its place;
- drop it on **1 2 3 4** to move it to that page;
- **+** adds a spacer at the end of the page (spacers show a dotted frame);
- **OK** or right-click › *Done Editing Layout* leaves the mode (a long press only enters it).

### Expressions

Add one with **+ › Add Expression…**. Click applies it to the selected attribute(s); Alt + click lets you pick the attribute of the selected layer.

### Rigs

Select a layer and use **+ › Add Selected Layers as Rig…**. Choose what to include (children, connected layers, expressions, keyframes, labels) and give it a name and description. The rig button recreates it in the active composition, just under the selected layer.

### Settings panel (⚙)

- **Shortcuts** of the bar selected below: drag to reorder (Shift / Cmd for several), double-click to rename, **…** to move to another page or edit an expression. Rows are grouped by page.
- **Add…**, **Spacer**, **Reset / Clear Bar**, **Hide page selector** (off by default).
- **Bars**: click to edit, double-click to open, **…** for Open, Duplicate, Rename, Switch to Vertical / Horizontal, Export Bar, Delete.
- **New Bar…**, **Import Bar…**, **Export Bar…**, **Update Bars**, **Config…** (Config Import, Config Export, Open Folder).

### Custom icons

Put a PNG named exactly like the button in `C-Bar_assets/icons/` — e.g. `Value x -1.png`. Without such a file the default icon is used.

## Folder structure

```
C_Bar/
├── C-Bar.js                  ← the code (Default bar)
├── C-Bar_<Name>.js           ← generated, one per extra bar
└── C-Bar_assets/
    ├── bars/                 ← one JSON per bar (your shortcuts)
    ├── rigs/                 ← saved rigs
    ├── icons/                ← custom icons
    └── scripts/              ← scripts imported with a bar
```

## Known limitations

- A bar's orientation is fixed when its window opens: after *Switch to Vertical / Horizontal*, close and reopen the bar.
- Cavalry scripts cannot read the keyboard: no Esc shortcut in the dialogs.
- When docked, the size of the window is controlled by Cavalry.

## Compatibility

Developed and tested on **Cavalry 2.x, macOS**. Windows feedback is welcome — please open an [issue](../../issues).

## Contributing

Bug reports and ideas are welcome in the **Issues** tab: describe what you did, what you expected, your Cavalry version and OS, and add a screenshot if you can.

## License

[MIT](LICENSE)

---

## Guide rapide (FR)

1. Copiez le dossier **`C_Bar`** dans le dossier Scripts de Cavalry (macOS : `~/Library/Application Support/Cavalry/Scripts/`).
2. Ouvrez **Scripts › C_Bar › C-Bar** : c'est la barre **Default**.
3. **+** ajoute un nœud, un script, une expression, un rig ou un espace dans la page affichée. **1 2 3 4** change de page. **⚙** ouvre les réglages (barres, pages, export / import).
4. Avec un calque ou un attribut sélectionné, les nœuds se connectent, se placent en enfant et se renomment tout seuls. **Alt + clic** : choisir l'attribut à piloter.
5. Mise à jour : remplacez seulement `C-Bar.js` ; les autres barres se mettent à jour à leur prochaine ouverture.
