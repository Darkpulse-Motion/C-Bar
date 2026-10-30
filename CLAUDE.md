# C-Bar — notes for coding agents and contributors

C-Bar is a customisable toolbar for **Cavalry 2.x** (scripting UI), in the spirit of KBar.

## Code layout
- One code file: `C_Bar/C-Bar.js` (the "Default" bar). Every other bar is a generated `C-Bar_<Name>.js`: a copy of `C-Bar.js` where **only the first line** (`var CBAR_ID = "..."`) changes. These copies are regenerated automatically when any bar opens — never edit them, never commit them.
- User data lives in `C_Bar/C-Bar_assets/` (`bars/`, `rigs/`, `icons/`, `scripts/`, `backup/`) and is **never committed** (see `.gitignore`).
- `CBAR_VERSION` (near the top of `C-Bar.js`) is the version that *Settings › Update* compares with the latest GitHub Release.

## Coding rules
- Cavalry's JavaScript engine: **ES5 only** — `var` (no `let` / `const`), no arrow functions, no template literals.
- The UI of the script is in **English**.
- No new icon files: use Cavalry's own icons, or custom icons the user drops in `C-Bar_assets/icons/<Button name>.png`.
- Check syntax before committing: `node --check C_Bar/C-Bar.js`.

## Workflow
- One change = one clear commit, with the **CHANGELOG** updated in the `## Unreleased` section (Added / Changed / Fixed).
- Commit messages keep the `Co-Authored-By: Claude …` trailer when Claude wrote the change.

## Releasing
1. Set `CBAR_VERSION` and rename `## Unreleased` in the CHANGELOG to `## v0.x.y — YYYY-MM-DD (beta)`.
2. Commit `Release v0.x.y (beta)` and push to `main`.
3. Zip: the `C_Bar` folder (with empty `C-Bar_assets/{bars,rigs,icons,scripts}`) + README, CHANGELOG, LICENSE → `C-Bar_v0.x.y-beta.zip`.
4. GitHub Release: tag `v0.x.y` on `main`, title `C-Bar v0.x.y (beta)`, zip attached, label **None** (a pre-release is ignored by *Update*), **Set as the latest release** checked.

## Cavalry scripting pitfalls (learnt the hard way)
- Mouse positions of widgets are **y-up** (like `ui.Draw`), `widget.geometry()` is in screen coordinates (y-down): flip y.
- `cavalry.Path.addRect(fromX, fromY, toX, toY)` takes two corners, not a width and height.
- A press on a button also reaches its parent Container, but the release does not.
- Reading `geometry()` of a destroyed widget (after the bar is rebuilt) **crashes Cavalry**: empty widget lists on every rebuild.
- `api.getAttributes` does not list array entries: use `api.getAttrChildren(id, "array")`.
- A Container or `ui.Draw` with mouse callbacks keeps the right-click: open the context menu yourself (`ui.showContextMenu()`).
- Windows shown with `Container.show()` stay above other applications on macOS; they are hidden on `onAppStateChanged` ("inactive").
- `ui.Modal().showConfirmation` always shows Cancel / Okay.
- Scripts cannot read the keyboard, nor tell which field (X / Y) of an attribute is being edited.
- Close secondary windows in `ui.onClose`: left open, they run the code of a closed script.
