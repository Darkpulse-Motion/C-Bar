var CBAR_ID = "default"; // CBAR_ID — do not edit this line (it is replaced in every generated bar)
// ============================================================
// C-Bar — Cavalry shortcut bars (nodes, favourites, scripts)
// ============================================================
// Install:
//   Scripts/C_Bar/C-Bar.js            ← "Default" bar (the only file to maintain)
//   Scripts/C_Bar/C-Bar_assets/
//       bars/<id>.json                ← settings, pages and shortcuts of each bar
//       rigs/<id>.json                ← saved rigs
//       icons/base/                   ← icon pack (Tabler Icons)
//       icons/customs/<Button name>.png ← custom icons
//       scripts/                      ← scripts imported with a bar
//       backup/                       ← previous C-Bar.js after an Update
//
// Each bar created from ⚙ > Bar… > "New Bar…" generates a
// "C-Bar_<Name>.js" file next to this one: a copy of C-Bar.js where only
// the first line (CBAR_ID) changes. These copies are regenerated when
// any bar opens (or with ⚙ > Bar… > "Update Bars").
//
// Orientation: chosen when a bar is created (or duplicated). Every bar
// is a clean Cavalry toolbar, without a docking tab.
//
// ⚙ Settings: the shortcuts of the selected bar, one page at a time
// (1 2 3 4), and the list of bars ("..." menu: Open, Duplicate, Rename,
// Switch orientation, Export, Delete). On the bar: hold 1.5 s on an
// empty part, or right-click > Organize Layout, to arrange it in place.
// ============================================================

function logStatus(message) {
  console.log("[C-Bar] " + message);
}

// ============================================================
// Paths
// ============================================================

function getScriptsRoot() {
  var base = String(api.getThirdPartyPluginsFolder()).replace(/[\/\\]Third-Party[\/\\]Plugins[\/\\]?$/, "");
  return base + "/Scripts";
}

// Synced bars must not depend on the macOS user name: script paths inside a
// Cavalry Scripts folder are stored as "$SCRIPTS/…" and resolved on this machine.
var SCRIPTS_TOKEN = "$SCRIPTS/";
// Case-insensitive: a synced copy of the folder can be named "CAVALRY/Scripts".
var SCRIPTS_MARKER = /[\/\\]Cavalry[\/\\]Scripts[\/\\]/i;

// Absolute path -> "$SCRIPTS/…" when the file lives in a Cavalry Scripts folder
// (this machine's or another one's: the user name is dropped).
function toPortablePath(path) {
  path = String(path || "");
  if (!path || path.indexOf(SCRIPTS_TOKEN) === 0) {
    return path;
  }
  var root = getScriptsRoot() + "/";
  if (path.indexOf(root) === 0) {
    return SCRIPTS_TOKEN + path.slice(root.length);
  }
  var m = path.match(SCRIPTS_MARKER);
  if (m) {
    return SCRIPTS_TOKEN + path.slice(m.index + m[0].length);
  }
  return path; // outside any Scripts folder: kept as is
}

// "$SCRIPTS/…" (or an old absolute path) -> real path on this machine.
function fromPortablePath(path) {
  path = toPortablePath(path);
  if (path.indexOf(SCRIPTS_TOKEN) === 0) {
    return getScriptsRoot() + "/" + path.slice(SCRIPTS_TOKEN.length);
  }
  return path;
}

var SCRIPT_DIR = "";
try {
  SCRIPT_DIR = String(ui.scriptLocation || "");
} catch (eLoc) {}
if (!SCRIPT_DIR) {
  SCRIPT_DIR = getScriptsRoot() + "/C_Bar";
}
SCRIPT_DIR = SCRIPT_DIR.replace(/[\/\\]+$/, "");

// Version of this script. A GitHub Release of the same number (tag
// "v" + CBAR_VERSION) is what Settings > Update installs.
var CBAR_VERSION = "0.9.6";
var CBAR_REPO = "Darkpulse-Motion/C-Bar";

var MAIN_SCRIPT = SCRIPT_DIR + "/C-Bar.js";
var ASSETS_DIR = SCRIPT_DIR + "/C-Bar_assets";
var BARS_DIR = ASSETS_DIR + "/bars";
var ICONS_DIR = ASSETS_DIR + "/icons";
// Icons made by the user (named like a button) and the copies made by C-Bar.
var CUSTOM_ICONS_DIR = ICONS_DIR + "/customs";

function ensureFolder(path) {
  try {
    if (!api.filePathExists(path)) {
      api.makeFolder(path);
    }
  } catch (e) {
    logStatus("Could not create folder " + path + ": " + e);
  }
}
ensureFolder(ASSETS_DIR);
ensureFolder(BARS_DIR);
ensureFolder(ICONS_DIR);
ensureFolder(CUSTOM_ICONS_DIR);

var IS_MAC = String(api.getAppAssetsPath()).indexOf(".app/") !== -1;

// ============================================================
// Name and node-type helpers
// ============================================================

// Normalises a name for comparison: lower case, no spaces, dashes or
// underscores ("Sub-Mesh Bounding Box" -> "submeshboundingbox").
function normalizeName(str) {
  return String(str).toLowerCase().replace(/[\s\-_]/g, "");
}

// File id from a name: "My Effects" -> "my-effects".
function slugify(str) {
  var s = String(str).toLowerCase();
  var from = "àáâäãåçèéêëìíîïñòóôöõùúûüýÿœæ";
  var to   = "aaaaaaceeeeiiiinooooouuuuyyoa";
  var out = "";
  for (var i = 0; i < s.length; i++) {
    var k = from.indexOf(s.charAt(i));
    out += k !== -1 ? to.charAt(k) : s.charAt(i);
  }
  return out.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "bar";
}

// Readable file name: "My Effects" -> "My_Effects".
function fileSafeName(str) {
  return String(str).replace(/[\/\\:*?"<>|]+/g, "").replace(/\s+/g, "_").replace(/^_+|_+$/g, "") || "Bar";
}

var allLayerTypesCache = null;
function getAllTypes() {
  if (!allLayerTypesCache) {
    allLayerTypesCache = api.getAllLayerTypes(true) || [];
  }
  return allLayerTypesCache;
}

function findLayerTypeByName(displayName) {
  var types = getAllTypes();
  var wanted = normalizeName(displayName);
  for (var i = 0; i < types.length; i++) {
    if (normalizeName(types[i].name) === wanted || normalizeName(types[i].type) === wanted) {
      return types[i].type;
    }
  }
  var partial = [];
  for (var j = 0; j < types.length; j++) {
    if (normalizeName(types[j].name).indexOf(wanted) !== -1) {
      partial.push(types[j].type);
    }
  }
  return partial.length === 1 ? partial[0] : null;
}

function listSimilarTypes(displayName) {
  var types = getAllTypes();
  var firstWord = normalizeName(String(displayName).split(/[\s\-]+/)[0]);
  var lines = [];
  for (var i = 0; i < types.length; i++) {
    if (normalizeName(types[i].name).indexOf(firstWord) !== -1) {
      lines.push(types[i].type + ' ("' + types[i].name + '")');
    }
  }
  return lines.join("\n");
}

function findTypeName(type) {
  var types = getAllTypes();
  for (var i = 0; i < types.length; i++) {
    if (types[i].type === type) {
      return types[i].name;
    }
  }
  return type;
}

// ============================================================
// Icon lookup
// ============================================================

var NODE_ICONS_DIR = api.getAppAssetsPath() + "/Icons/nodes";
var builtinIconIndex = null;
var pluginIconIndex = null;

function lowerFileName(path) {
  return String(path).split("/").pop().toLowerCase();
}

function getBuiltinIconIndex() {
  if (builtinIconIndex) {
    return builtinIconIndex;
  }
  builtinIconIndex = {};
  var files = api.listDirectory(NODE_ICONS_DIR) || [];
  for (var i = 0; i < files.length; i++) {
    var name = lowerFileName(files[i]);
    if (name.indexOf("@2x") === -1 && /\.png$/.test(name)) {
      builtinIconIndex[name] = files[i];
    }
  }
  return builtinIconIndex;
}

// Plugins ("author::type"): "<type>.png" in the plugin folder,
// otherwise the "icon" field of definitions.json.
function getPluginIconIndex() {
  if (pluginIconIndex) {
    return pluginIconIndex;
  }
  pluginIconIndex = {};
  var roots = [api.getThirdPartyPluginsFolder(), api.getAppAssetsPath() + "/Plugins"];
  var dirs = [];
  for (var r = 0; r < roots.length; r++) {
    dirs = dirs.concat(api.listDirectory(roots[r]) || []);
  }
  for (var i = 0; i < dirs.length; i++) {
    var dir = dirs[i];
    var defsPath = dir + "/definitions.json";
    if (!api.filePathExists(defsPath)) {
      continue;
    }
    var txt = "";
    try {
      txt = api.readFromFile(defsPath);
    } catch (e) {
      continue;
    }
    var iconMatch = txt.match(/"icon"\s*:\s*"([^"]+)"/);
    var defaultIcon = iconMatch ? dir + "/" + iconMatch[1] : null;
    var typeRegex = /"type"\s*:\s*"([^"]+)"/g;
    var m;
    while ((m = typeRegex.exec(txt)) !== null) {
      var typeName = m[1];
      if (/^(double|int|bool|string|color|double2|double3|int2|int3|enum|richText|nodeId|polyMesh|dynamic|list|array|asset)$/.test(typeName)) {
        continue;
      }
      var dedicated = dir + "/" + typeName + ".png";
      var key = typeName.toLowerCase();
      if (api.filePathExists(dedicated)) {
        pluginIconIndex[key] = dedicated;
      } else if (defaultIcon && !pluginIconIndex[key]) {
        pluginIconIndex[key] = defaultIcon;
      }
    }
  }
  return pluginIconIndex;
}

// Custom icon: C-Bar_assets/icons/<button name>.png replaces the default
// icon of that button; without such a file the default icon is kept.
function customIconFor(shortcut) {
  // Icon chosen with Set Icon… (see "Button icons").
  if (shortcut && shortcut.icon) {
    var own = iconPathFor(shortcut.icon);
    try {
      if (api.filePathExists(own)) {
        return own;
      }
    } catch (eOwn) {}
  }
  if (!shortcut || !shortcut.label) {
    return null;
  }
  var names = [String(shortcut.label)];
  var safe = fileSafeName(shortcut.label);
  if (safe && safe !== names[0]) {
    names.push(safe);
  }
  for (var i = 0; i < names.length; i++) {
    // icons/customs/, or icons/ itself (where they were before v0.9.6).
    var paths = [CUSTOM_ICONS_DIR + "/" + names[i] + ".png", ICONS_DIR + "/" + names[i] + ".png"];
    for (var j = 0; j < paths.length; j++) {
      try {
        if (api.filePathExists(paths[j])) {
          return paths[j];
        }
      } catch (e) {}
    }
  }
  return null;
}

function resolveIcon(shortcut) {
  var custom = customIconFor(shortcut);
  if (custom) {
    return custom;
  }
  var builtin = getBuiltinIconIndex();
  if (shortcut.kind === "rig" && shortcut.rootType) {
    return resolveIcon({ type: shortcut.rootType });
  }
  if (shortcut.kind === "script") {
    return findScriptIcon(fromPortablePath(shortcut.path));
  }
  if (shortcut.iconFile && builtin[shortcut.iconFile.toLowerCase()]) {
    return builtin[shortcut.iconFile.toLowerCase()];
  }
  // Interface icons of Cavalry (e.g. the Shelf: shelf_LayoutGrid.png).
  if (shortcut.iconFile) {
    var appIcon = api.getAppAssetsPath() + "/Icons/" + shortcut.iconFile;
    if (api.filePathExists(appIcon)) {
      return appIcon;
    }
  }
  var type = shortcut.type || "";
  var parts = type.split("::");
  var bare = parts[parts.length - 1];
  if (parts.length > 1) {
    var p = getPluginIconIndex()[bare.toLowerCase()];
    if (p) {
      return p;
    }
  }
  if (builtin[(bare + ".png").toLowerCase()]) {
    return builtin[(bare + ".png").toLowerCase()];
  }
  return builtin["placeholder.png"] || null;
}

// ============================================================
// Cavalry scripts: listing and launching
// ============================================================

function fileBaseName(path) {
  return String(path).split(/[\/\\]/).pop().replace(/\.(jsc|js)$/i, "");
}

// Installed scripts (.js / .jsc), sub-folders included. Skips
// "_assets" folders, plugins and the C-Bars themselves.
function listInstalledScripts() {
  var root = getScriptsRoot();
  var out = [];
  function walk(dir, depth) {
    var entries = api.listDirectory(dir) || [];
    for (var i = 0; i < entries.length; i++) {
      var p = entries[i];
      var name = String(p).split(/[\/\\]/).pop();
      if (!name || name.charAt(0) === ".") {
        continue;
      }
      var isFile = false;
      try { isFile = api.isFile(p); } catch (e) { isFile = /\.[A-Za-z0-9]+$/.test(name); }
      if (isFile) {
        if (/\.(js|jsc)$/i.test(name) && !/^C[\s\-_]?Bar/i.test(name)) {
          out.push({
            path: p,
            name: fileBaseName(p),
            folder: String(dir).substr(root.length).replace(/^[\/\\]/, "")
          });
        }
      } else if (depth < 4 && !/_assets$/i.test(name) && !api.filePathExists(p + "/definitions.json")) {
        walk(p, depth + 1);
      }
    }
  }
  walk(root, 0);
  out.sort(function (a, b) {
    return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
  });
  return out;
}

// Script icon: C-Bar_assets/icons/<name>.png, then
// <name>_assets/icon.png or <name>.png next to the script.
function findScriptIcon(scriptPath) {
  var dir = String(scriptPath).replace(/[\/\\][^\/\\]*$/, "");
  var name = fileBaseName(scriptPath);
  var candidates = [
    CUSTOM_ICONS_DIR + "/" + name + ".png",
    ICONS_DIR + "/" + name + ".png",
    SCRIPT_DIR + "/C Bar_assets/icons/" + name + ".png", // legacy folder (C Bar V / H)
    dir + "/" + name + "_assets/icon.png",
    dir + "/" + name + "_assets/" + name + ".png",
    dir + "/" + name + ".png"
  ];
  for (var i = 0; i < candidates.length; i++) {
    if (api.filePathExists(candidates[i])) {
      return candidates[i];
    }
  }
  return null;
}

function runScriptShortcut(shortcut) {
  var path = fromPortablePath(shortcut.path);
  if (!api.filePathExists(path)) {
    logStatus("Script not found: " + path);
    return;
  }
  try {
    ui.runFileScript(path);
    logStatus("Script opened: " + shortcut.label);
  } catch (e) {
    logStatus("Could not open script '" + shortcut.label + "': " + e);
  }
}

// ============================================================
// Bars: reading / writing the JSON files
// ============================================================
// One file per bar: C-Bar_assets/bars/<id>.json
//   { version, id, name, orientation, script, shortcuts: [...] }

var DEFAULT_SHORTCUTS = [
  { iconFile: "customShape.png",    label: "Custom Shape",          nodeName: "Custom Shape", useSelectedLayer: true, renameFromLayer: "Custom_", hideSelectedLayer: true },
  { iconFile: "round.png",          label: "Round",                 nodeName: "Round" },
  { iconFile: "value.png",          label: "Value",                 nodeName: "Value" },
  { iconFile: "value2.png",         label: "Value 2",               nodeName: "Value2" },
  { iconFile: "valueBlend.png",     label: "Value Blend",           nodeName: "Value Blend" },
  { iconFile: "value2Blend.png",    label: "Value Blend 2",         nodeName: "Value2 Blend" },
  { iconFile: "valueArray.png",     label: "Value Array",           nodeName: "Value Array" },
  { iconFile: "value2Array.png",    label: "Value Array 2",         nodeName: "Value2 Array" },
  { iconFile: "colorArray.png",     label: "Color Array",           nodeName: "Color Array" },
  { iconFile: "subBoundingBox.png", label: "Sub-Mesh Bounding Box", nodeName: "Sub-Mesh Bounding Box", useSelectedLayer: true },
  { type: "oscillator",             label: "Oscillator",            nodeName: "Oscillator", useSelectedLayer: true },
  { kind: "expression",             label: "Value x -1",            expression: "value*-1" }
];

// Orientation of the Default bar the first time it is created.
var DEFAULT_BAR_ORIENTATION = "vertical";

// Old preference key (C Bar V / H): imported once into the Default bar
// on first launch.
var LEGACY_PREF_KEY = "SeBarNodes.shortcuts";

var uidCounter = 0;
function makeUid(base) {
  uidCounter++;
  return String(base || "item").replace(/[^A-Za-z0-9]/g, "_") + "_" + Date.now() + "_" + uidCounter;
}

function buildDefaultShortcuts() {
  var list = [];
  for (var i = 0; i < DEFAULT_SHORTCUTS.length; i++) {
    var d = DEFAULT_SHORTCUTS[i];
    var item = {};
    for (var k in d) {
      item[k] = d[k];
    }
    if (!item.type && d.nodeName) {
      item.type = findLayerTypeByName(d.nodeName) || null;
    }
    item.uid = makeUid(item.type || item.kind || d.label);
    list.push(item);
  }
  return list;
}

function barFilePath(id) {
  return BARS_DIR + "/" + id + ".json";
}

function readBarFile(id) {
  var path = barFilePath(id);
  if (!api.filePathExists(path)) {
    return null;
  }
  try {
    var data = JSON.parse(api.readFromFile(path));
    if (data && typeof data === "object") {
      return data;
    }
  } catch (e) {
    logStatus("Unreadable bar file (" + path + "): " + e);
  }
  return null;
}

// Every write is stamped (savedAt, ms) so that a window can tell an
// older copy of its bar file (e.g. put back by a folder sync such as
// pCloud a few seconds later) from a newer change made elsewhere.
function writeBarFile(bar) {
  bar.savedAt = Math.max(Date.now(), (bar.savedAt || 0) + 1);
  try {
    api.writeToFile(barFilePath(bar.id), JSON.stringify(bar, null, 2), true);
    return true;
  } catch (e) {
    logStatus("Could not save (" + barFilePath(bar.id) + "): " + e);
    return false;
  }
}

// All known bars (read from the JSON files).
function listBars() {
  var out = [];
  var files = api.listDirectory(BARS_DIR) || [];
  for (var i = 0; i < files.length; i++) {
    var m = String(files[i]).match(/([^\/\\]+)\.json$/i);
    if (!m) {
      continue;
    }
    var data = readBarFile(m[1]);
    if (data) {
      out.push(data);
    }
  }
  out.sort(function (a, b) {
    if (a.id === "default") { return -1; }
    if (b.id === "default") { return 1; }
    return String(a.name).toLowerCase() < String(b.name).toLowerCase() ? -1 : 1;
  });
  return out;
}

function loadCurrentBar() {
  var bar = readBarFile(CBAR_ID);
  if (!bar) {
    bar = { version: 1, id: CBAR_ID, name: CBAR_ID === "default" ? "Default" : CBAR_ID,
            orientation: CBAR_ID === "default" ? DEFAULT_BAR_ORIENTATION : "horizontal",
            script: CBAR_ID === "default" ? "C-Bar.js" : "", shortcuts: [] };
    if (CBAR_ID === "default") {
      var migrated = false;
      try {
        if (api.hasPreferenceObject(LEGACY_PREF_KEY)) {
          var saved = api.getPreferenceObject(LEGACY_PREF_KEY);
          if (saved && saved.items && saved.items.length) {
            bar.shortcuts = saved.items;
            migrated = true;
            logStatus("Shortcuts from the old C Bar imported into the Default bar (" + saved.items.length + ").");
          }
        }
      } catch (e) {}
      if (!migrated) {
        bar.shortcuts = buildDefaultShortcuts();
      }
    }
    writeBarFile(bar);
  }
  if (!bar.shortcuts) {
    bar.shortcuts = [];
  }
  for (var i = 0; i < bar.shortcuts.length; i++) {
    if (!bar.shortcuts[i].uid) {
      bar.shortcuts[i].uid = makeUid(bar.shortcuts[i].type || bar.shortcuts[i].label);
    }
  }
  bar.orientation = bar.orientation === "vertical" ? "vertical" : "horizontal";
  return bar;
}

var currentBar = loadCurrentBar();
var nodeShortcuts = currentBar.shortcuts;
var lastBarText = "";          // JSON content as last read / written by this window
// Orientation saved in the bar file. It can differ from the orientation of
// this window (Switch to Vertical / Horizontal): it is kept when this
// window saves, and applied when the bar is reopened.
var diskOrientation = currentBar.orientation;
var currentBarDeleted = false; // true once the bar has been deleted from another window
var lastOwnSave = 0;           // savedAt of this window's last write

// Clean bar (Cavalry toolbar, no tab). Its orientation is chosen when
// the bar is created and fixed when the window opens.
ui.setToolbar();
if (currentBar.orientation === "vertical") {
  ui.setVerticalToolbar();
}

function readBarText(id) {
  var path = barFilePath(id);
  if (!api.filePathExists(path)) {
    return null;
  }
  try {
    return api.readFromFile(path);
  } catch (e) {
    return null;
  }
}
lastBarText = readBarText(currentBar.id) || "";

// Saves the current bar to its JSON file.
function saveShortcuts() {
  if (currentBarDeleted) {
    logStatus("This bar has been deleted: change not saved.");
    return;
  }
  currentBar.shortcuts = nodeShortcuts;
  var toSave = JSON.parse(JSON.stringify(currentBar));
  toSave.orientation = diskOrientation;
  if (writeBarFile(toSave)) {
    lastOwnSave = toSave.savedAt;
    currentBar.savedAt = toSave.savedAt;
  }
  lastBarText = readBarText(currentBar.id) || "";
}

// Reloads the current bar if its file was changed elsewhere (settings
// of another bar, manual edit…).
function syncCurrentBarFromDisk() {
  if (currentBarDeleted) {
    return false;
  }
  var txt = readBarText(currentBar.id);
  if (txt === null) {
    currentBarDeleted = true;
    logStatus("The bar \"" + currentBar.name + "\" has been deleted. You can close this window.");
    return false;
  }
  if (txt === lastBarText) {
    return false;
  }
  lastBarText = txt;
  try {
    var data = JSON.parse(txt);
    // Older than what this window saved last: a stale copy (folder sync).
    // It is ignored and this window's version is written again.
    if (lastOwnSave && data.savedAt && data.savedAt < lastOwnSave) {
      logStatus("An older copy of the bar file was found (folder sync?): kept the current version.");
      saveShortcuts();
      return false;
    }
    currentBar.name = data.name || currentBar.name;
    currentBar.hidePages = data.hidePages === true;
    diskOrientation = data.orientation === "vertical" ? "vertical" : "horizontal";
    if (!showPageSelector()) {
      currentPage = 1;
    }
    nodeShortcuts = data.shortcuts || [];
    currentBar.shortcuts = nodeShortcuts;
    ui.setTitle("C-Bar · " + currentBar.name);
    return true;
  } catch (e) {
    return false;
  }
}

// Edits the shortcut list of a bar (this window's or another one).
// fn receives the array; it can edit it in place or return a new one.
function mutateBarShortcuts(id, fn) {
  if (id === currentBar.id) {
    syncCurrentBarFromDisk();
    var before = uidSet(nodeShortcuts);
    var r = fn(nodeShortcuts);
    if (r) {
      nodeShortcuts = r;
    }
    stampNewShortcuts(before, nodeShortcuts, pageForNewShortcut(id));
    saveShortcuts();
    refillBars();
  } else {
    var bar = readBarFile(id);
    if (!bar) {
      logStatus("Bar not found: " + id);
      return;
    }
    bar.shortcuts = bar.shortcuts || [];
    var before2 = uidSet(bar.shortcuts);
    var r2 = fn(bar.shortcuts);
    if (r2) {
      bar.shortcuts = r2;
    }
    stampNewShortcuts(before2, bar.shortcuts, pageForNewShortcut(id));
    writeBarFile(bar);
  }
  onBarsChanged();
}

// Sets a simple property (e.g. hidePages) on a bar and saves it.
function setBarProperty(id, key, value) {
  if (id === currentBar.id) {
    syncCurrentBarFromDisk();
    currentBar[key] = value;
    if (key === "hidePages" && value) {
      currentPage = 1;
    }
    saveShortcuts();
    refillBars();
  } else {
    var bar = readBarFile(id);
    if (!bar) {
      return;
    }
    bar[key] = value;
    writeBarFile(bar);
  }
  onBarsChanged();
}

function getBarHidePages(id) {
  if (id === currentBar.id) {
    return !showPageSelector();
  }
  var bar = readBarFile(id);
  return !!bar && bar.hidePages === true;
}

function getBarShortcuts(id) {
  if (id === currentBar.id) {
    syncCurrentBarFromDisk();
    return nodeShortcuts;
  }
  var bar = readBarFile(id);
  return bar && bar.shortcuts ? bar.shortcuts : [];
}

// Picks up changes made from another window.
var syncTimer = null;
try {
  syncTimer = new api.Timer({
    onTimeout: function () {
      if (syncCurrentBarFromDisk()) {
        refillBars();
        onBarsChanged();
      }
      if (currentBarDeleted && syncTimer) {
        syncTimer.stop();
      }
    }
  });
  syncTimer.setInterval(1500);
  syncTimer.setRepeating(true);
  syncTimer.start();
} catch (eTimer) {}

// ============================================================
// Bars: create, duplicate, rename, delete
// ============================================================

// Source of C-Bar.js with the bar id replaced.
function buildBarScriptSource(id) {
  if (!api.filePathExists(MAIN_SCRIPT)) {
    logStatus("C-Bar.js not found: " + MAIN_SCRIPT);
    return null;
  }
  var src = api.readFromFile(MAIN_SCRIPT);
  var line = 'var CBAR_ID = "' + id + '"; // CBAR_ID — do not edit this line (it is replaced in every generated bar)';
  if (!/^var CBAR_ID = "[^"]*";[^\n]*/.test(src)) {
    logStatus("Unexpected first line in C-Bar.js: generation cancelled.");
    return null;
  }
  return src.replace(/^var CBAR_ID = "[^"]*";[^\n]*/, line);
}

function barScriptPath(bar) {
  return bar.id === "default" ? MAIN_SCRIPT : SCRIPT_DIR + "/" + bar.script;
}

function writeBarScript(bar) {
  if (bar.id === "default") {
    return MAIN_SCRIPT;
  }
  var src = buildBarScriptSource(bar.id);
  if (!src) {
    return null;
  }
  var path = barScriptPath(bar);
  try {
    api.writeToFile(path, src, true);
    return path;
  } catch (e) {
    logStatus("Could not write " + path + ": " + e);
    return null;
  }
}

function trimName(name) {
  return String(name || "").replace(/^\s+|\s+$/g, "");
}

// Checks that a name is free (id and .js file). exceptId: the bar being
// renamed, which may keep its own name.
function checkBarName(name, exceptId) {
  if (!name) {
    return "Please give the bar a name.";
  }
  var id = slugify(name);
  if (id === "default" && exceptId !== "default") {
    return "This name is reserved.";
  }
  var bars = listBars();
  for (var i = 0; i < bars.length; i++) {
    if (bars[i].id === exceptId) {
      continue;
    }
    if (bars[i].id === id || normalizeName(bars[i].name) === normalizeName(name)) {
      return "A bar named \"" + bars[i].name + "\" already exists.";
    }
  }
  return "";
}

function copyShortcuts(list) {
  var out = [];
  for (var i = 0; i < (list || []).length; i++) {
    var item = JSON.parse(JSON.stringify(list[i]));
    item.uid = makeUid(item.type || item.label);
    out.push(item);
  }
  return out;
}

// Creates a bar (empty, or with a copy of some shortcuts) and opens it.
function createBar(name, orientation, shortcuts) {
  name = trimName(name);
  var err = checkBarName(name, null);
  if (err) {
    showMessage(err);
    return null;
  }
  var bar = {
    version: 1,
    id: slugify(name),
    name: name,
    orientation: orientation === "vertical" ? "vertical" : "horizontal",
    script: "C-Bar_" + fileSafeName(name) + ".js",
    shortcuts: copyShortcuts(shortcuts)
  };
  if (!writeBarFile(bar)) {
    return null;
  }
  var path = writeBarScript(bar);
  if (!path) {
    return null;
  }
  logStatus("Bar \"" + name + "\" created: " + path);
  try {
    ui.runFileScript(path);
  } catch (e) {
    logStatus("Bar created; open it from the Scripts menu (" + bar.script + ").");
  }
  onBarsChanged();
  return bar;
}

// Moves a file to the Trash (macOS); otherwise stores it in
// C-Bar_assets/_deleted (ignored by the Scripts menu).
function moveToTrash(path) {
  if (!api.filePathExists(path)) {
    return true;
  }
  var name = String(path).split(/[\/\\]/).pop();
  var stamp = " " + Date.now();
  try {
    if (IS_MAC) {
      var home = (String(path).match(/^(\/Users\/[^\/]+)/) || [])[1];
      if (home) {
        var dest = home + "/.Trash/" + name;
        if (api.filePathExists(dest)) {
          dest = home + "/.Trash/" + name.replace(/(\.[^.]+)$/, stamp + "$1");
        }
        api.runProcess("/bin/mv", [path, dest]);
      }
    } else {
      api.runProcess("cmd", ["/c", "del", "/q", String(path).replace(/\//g, "\\")]);
    }
  } catch (e) {}
  if (!api.filePathExists(path)) {
    return true;
  }
  // Fallback: deleted-bars folder.
  try {
    var bin = ASSETS_DIR + "/_deleted";
    ensureFolder(bin);
    var dest2 = bin + "/" + name.replace(/(\.[^.]+)$/, stamp + "$1");
    if (IS_MAC) {
      api.runProcess("/bin/mv", [path, dest2]);
    } else {
      api.runProcess("cmd", ["/c", "move", "/y", String(path).replace(/\//g, "\\"), dest2.replace(/\//g, "\\")]);
    }
  } catch (e2) {}
  return !api.filePathExists(path);
}

function deleteBar(id) {
  var bar = readBarFile(id);
  if (!bar) {
    return;
  }
  if (id === "default") {
    showMessage("The Default bar cannot be deleted.");
    return;
  }
  if (id === currentBar.id) {
    showMessage("A bar cannot be deleted from its own window.\nOpen the settings of another bar (e.g. Default) to delete it.");
    return;
  }
  if (!aboveSettings(function () { return new ui.Modal().showConfirmation("Delete Bar", "Delete \"" + bar.name + "\" and its shortcuts?\nIts files will be moved to the Trash. If the bar is open, close its window."); })) {
    return;
  }
  var okJson = moveToTrash(barFilePath(id));
  var okJs = bar.script ? moveToTrash(barScriptPath(bar)) : true;
  if (okJson && okJs) {
    logStatus("Bar \"" + bar.name + "\" deleted.");
  } else {
    logStatus("Deletion incomplete: please delete manually " + (okJs ? "" : barScriptPath(bar) + " ") + (okJson ? "" : barFilePath(id)));
  }
  if (editedBarId === id) {
    editedBarId = currentBar.id;
  }
  onBarsChanged();
}

// Renames a bar: its display name and its .js file. The id (JSON file
// name) does not change, so an open window keeps working.
function renameBar(id) {
  var bar = id === currentBar.id ? currentBar : readBarFile(id);
  if (!bar) {
    return;
  }
  var name = trimName(aboveSettings(function () { return new ui.Modal().showStringInput("Rename Bar", "New name", bar.name); }));
  if (!name || name === bar.name) {
    return;
  }
  var err = checkBarName(name, id);
  if (err) {
    showMessage(err);
    return;
  }
  bar.name = name;
  if (id !== "default") {
    var oldPath = barScriptPath(bar);
    bar.script = "C-Bar_" + fileSafeName(name) + ".js";
    var newPath = barScriptPath(bar);
    if (newPath !== oldPath) {
      if (writeBarScript(bar)) {
        moveToTrash(oldPath);
      } else {
        bar.script = String(oldPath).split(/[\/\\]/).pop();
      }
    }
  }
  if (id === currentBar.id) {
    saveShortcuts();
    ui.setTitle("C-Bar · " + name);
  } else {
    writeBarFile(bar);
  }
  logStatus("Bar renamed: " + name + (id !== "default" ? " (" + bar.script + ")" : "") +
    ". If it is open, close it and reopen it from the Scripts menu.");
  onBarsChanged();
}

// Regenerates every bar from C-Bar.js (after an update).
function updateAllBarScripts() {
  var bars = listBars();
  var n = 0;
  for (var i = 0; i < bars.length; i++) {
    if (bars[i].id !== "default" && bars[i].script && writeBarScript(bars[i])) {
      n++;
    }
  }
  showMessage(n + " bar(s) updated.\nClose and reopen any open bars to load the new version.");
}

// Run when any bar opens: every generated C-Bar_<Name>.js that no
// longer matches C-Bar.js is rewritten (only its first line differs).
// After replacing C-Bar.js, opening any bar is enough; bars that were
// already open load the new code when they are reopened.
function syncBarScripts() {
  var bars = listBars();
  var updated = [];
  for (var i = 0; i < bars.length; i++) {
    var bar = bars[i];
    if (bar.id === "default" || !bar.script) {
      continue;
    }
    var src = buildBarScriptSource(bar.id);
    if (!src) {
      return; // C-Bar.js missing or unexpected: change nothing
    }
    var path = barScriptPath(bar);
    var current = null;
    try { current = api.filePathExists(path) ? api.readFromFile(path) : null; } catch (e) {}
    if (current === src) {
      continue;
    }
    try {
      api.writeToFile(path, src, true);
      updated.push(bar.name);
    } catch (e2) {
      logStatus("Could not update " + path + ": " + e2);
    }
  }
  if (updated.length) {
    logStatus("C-Bar updated for: " + updated.join(", ") + ". Reopen these bars if they are open.");
  }
}

// The orientation of a window is fixed when it opens: the new one is
// saved and applied the next time the bar is opened.
function switchBarOrientation(id) {
  var bar = readBarFile(id);
  if (!bar) {
    return;
  }
  var next = bar.orientation === "vertical" ? "horizontal" : "vertical";
  bar.orientation = next;
  if (!writeBarFile(bar)) {
    return;
  }
  if (id === currentBar.id) {
    diskOrientation = next;
    lastBarText = readBarText(id) || "";
  }
  onBarsChanged();
  showMessage("\"" + bar.name + "\" is now " + next + ".\nClose the bar and open it again to apply.");
}

function openBar(id) {
  var bar = readBarFile(id);
  if (!bar) {
    return;
  }
  var path = barScriptPath(bar);
  if (!api.filePathExists(path)) {
    path = writeBarScript(bar);
  }
  if (path) {
    try {
      ui.runFileScript(path);
    } catch (e) {
      logStatus("Could not open " + path + ": " + e);
    }
  }
}

// ------------------------------------------------------------
// Windows: dialogs above the Settings panel
// ------------------------------------------------------------
// On Windows the Settings panel can stay in front of message boxes, file
// dialogs and secondary windows. While one of them is shown, the panel is
// hidden, then shown again.
function settingsVisible() {
  if (!managerContainer) {
    return false;
  }
  try { return !managerContainer.isHidden(); } catch (e) { return false; }
}

// Last secondary window brought to the front (picker, expression, rig,
// bar or config window). When Settings is shown again after a message or
// a file dialog, this window goes back in front of it: otherwise the
// window that asked the question ends up hidden behind Settings.
var frontWindow = null;

function isShown(container) {
  if (!container) {
    return false;
  }
  try { return !container.isHidden(); } catch (e) { return false; }
}

function aboveSettings(fn) {
  var hide = !IS_MAC && settingsVisible();
  if (hide) {
    try { managerContainer.close(); } catch (e) {}
  }
  try {
    return fn();
  } finally {
    if (hide) {
      try { managerContainer.show(); } catch (e2) {}
      if (frontWindow && frontWindow !== managerContainer && isShown(frontWindow)) {
        try { frontWindow.close(); } catch (e3) {}
        try { frontWindow.show(); } catch (e4) {}
      }
    }
  }
}

// Shows a secondary window in front (re-showing it raises it).
function showOnTop(container) {
  if (!IS_MAC) {
    try { container.close(); } catch (e) {}
  }
  container.show();
  frontWindow = container;
}

function showMessage(text) {
  logStatus(String(text).replace(/\n+/g, " "));
  try { aboveSettings(function () { new ui.Modal().showMessage(text); }); } catch (e) {}
}

// ============================================================
// Node creation
// ============================================================

function applySelectionToNode(nodeId, layerId, shortcut) {
  api.connect(layerId, "id", nodeId, "inputShape");
  // Custom Shape: always "Custom_<LayerName>".
  var prefix = shortcut.renameFromLayer ||
    (findTypeName(api.getLayerType(nodeId)) === "Custom Shape" ? "Custom_" : "");
  if (prefix) {
    api.rename(nodeId, prefix + api.getNiceName(layerId));
  }
  if (shortcut.hideSelectedLayer) {
    api.set(layerId, { hidden: true });
  }
}

// ------------------------------------------------------------
// Link to a selected attribute
// ------------------------------------------------------------
// When a value node (Oscillator, Number Range, Value, Value Array…)
// is created while an attribute is selected in the Attribute Editor:
//   - its output drives that attribute,
//   - it becomes a child of that layer,
//   - it is renamed "<LayerName>_<NodeName>".

// First selected attribute, as { layer, attr } (or null).
// api.getSelectedAttributes() returns [[layerId, attrPath], ...].
function getSelectedAttributeTarget() {
  var sel = null;
  try { sel = api.getSelectedAttributes(); } catch (e) { return null; }
  if (!sel || !sel.length) {
    return null;
  }
  var first = sel[0];
  if (first && first.length >= 2) {
    return { layer: String(first[0]), attr: String(first[1]) };
  }
  if (typeof first === "string" && first.indexOf(".") !== -1) {
    var dot = first.indexOf(".");
    return { layer: first.substr(0, dot), attr: first.substr(dot + 1) };
  }
  return null;
}

// Nodes that output a value: behaviours / utilities (Oscillator, Value,
// Number Range…) and indexable arrays (Value Array, Value2 Array,
// Color Array…). Shapes, deformers and filters are left out.
function isValueNode(nodeId) {
  try {
    var st = api.getSuperTypes(nodeId) || [];
    if (st.indexOf("behaviourBase") !== -1 || st.indexOf("indexableArray") !== -1) {
      return true;
    }
    // Colour utilities that are neither (e.g. Contrasting Color).
    if (isColorNode(nodeId)) {
      return true;
    }
    // String nodes (String, String Generator, Sub-String…): atomic
    // nodes whose output is text.
    return isStringNodeType(api.getLayerType(nodeId));
  } catch (e) {
    return false;
  }
}

// Nodes linked to the String of a selected Text Shape even when that
// attribute is not selected.
var TEXT_AUTO_LINK_TYPES = ["string", "stringArray", "stringGenerator", "stringFromAsset", "getLayerName"];

// Text value types (String attributes, the String of a Text Shape).
var STRING_TYPES = ["string", "richText"];

// String family: nodes (not shapes) whose output can be text. Their
// Alt + click menu only lists the text attributes of the layer.
function isStringNodeType(type) {
  if (!type) {
    return false;
  }
  var chain = typeChain(type);
  if (chain.indexOf("shape") !== -1) {
    return false;
  }
  var out = nodeOutputTypes(type) || [];
  return out.indexOf("string") !== -1 || out.indexOf("richText") !== -1;
}

// Copies the text of the attribute into a String node: "string" (String,
// Sub-String…), the first entry of a String Array. Nodes without such an
// input (String Generator builds its own text) are left as they are.
function seedStringNode(nodeId, type, value) {
  var text = typeof value === "string" ? value :
    (value && typeof value.text === "string" ? value.text : null);
  if (!text) {
    return false;
  }
  var paths = [];
  if (/Array$/.test(type)) {
    paths = firstArrayEntryPaths(nodeId);
  } else {
    var candidates = ["string", "text", "value"];
    for (var i = 0; i < candidates.length; i++) {
      if (STRING_TYPES.indexOf(defAttrType(type, candidates[i])) !== -1) {
        paths.push(candidates[i]);
      }
    }
  }
  // Each path is written as plain text, then as rich text ({ text }),
  // and read back: a String Array entry can hold either, and a wrong
  // form does not always raise an error.
  var textOf = function (v) {
    return typeof v === "string" ? v : (v && typeof v.text === "string" ? v.text : null);
  };
  var attempt = function (list) {
    for (var j = 0; j < list.length; j++) {
      var forms = defAttrType(type, list[j]) === "richText" ? [{ text: text }, text] : [text, { text: text }];
      for (var f = 0; f < forms.length; f++) {
        var o = {};
        o[list[j]] = forms[f];
        try { api.set(nodeId, o); } catch (e) { continue; }
        var back = null;
        try { back = api.get(nodeId, list[j]); } catch (e2) {}
        if (textOf(back) === text) {
          return true;
        }
      }
    }
    return false;
  };
  if (attempt(paths) || (/Array$/.test(type) && retryWithNewEntry(nodeId, attempt))) {
    return true;
  }
  logStatus("Could not copy the text into " + api.getNiceName(nodeId) +
    (paths.length ? " (tried: " + paths.join(", ") + ")." : ": no text input found."));
  return false;
}

// Connects the output of a node to an attribute. "id" normally forwards
// to the node's default output, but some nodes (e.g. Contrasting Color)
// only connect through their "out" attribute: both are tried, and the
// result is checked.
function connectNodeOutput(nodeId, layerId, attr) {
  var sources = ["id", "out"];
  for (var i = 0; i < sources.length; i++) {
    try { api.connect(nodeId, sources[i], layerId, attr); } catch (e) {}
    var linked = "";
    try { linked = String(api.getInConnection(layerId, attr) || ""); } catch (e2) {}
    if (linked === nodeId || linked.indexOf(nodeId + ".") === 0) {
      return true;
    }
  }
  return false;
}

// Value nodes: named after the attribute they drive, and seeded with
// its current value so that linking them does not change the result.
var VALUE_NODE_TYPES = ["value", "value2", "value3", "valueArray", "value2Array", "value3Array"];
// Value Blend / Value2 Blend / Value3 Blend: the current value goes into
// "First" (they keep their usual naming and placement).
var BLEND_NODE_TYPES = ["valueBlend", "value2Blend", "value3Blend"];

function isZeroValue(v) {
  if (v === null || v === undefined) {
    return true;
  }
  if (typeof v === "number") {
    return v === 0;
  }
  if (typeof v === "object") {
    for (var k in v) {
      if (typeof v[k] === "number" && v[k] !== 0) {
        return false;
      }
    }
    return true;
  }
  return false;
}

// True when two attribute values match (numbers, {x,y,z} objects,
// colour strings). Objects are compared on the components they share:
// a Position is {x,y,z} while a Value 2 entry is {x,y}. Small float
// differences are ignored.
function sameValue(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 1e-4;
  }
  if (typeof a === "string" || typeof b === "string") {
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
  if (typeof a === "object" && typeof b === "object") {
    var shared = 0;
    for (var k in a) {
      if (typeof a[k] === "number" && typeof b[k] === "number") {
        if (Math.abs(a[k] - b[k]) >= 1e-4) {
          return false;
        }
        shared++;
      }
    }
    return shared > 0;
  }
  return a == b;
}

// Attribute paths of the first array entry ("array.0", "array.0.xxx"),
// shortest first. Cavalry creates arrays with one entry; one is added
// if the array is empty.
function firstArrayEntryPaths(nodeId) {
  var find = function () {
    var out = [];
    var attrs = [];
    try { attrs = api.getAttributes(nodeId) || []; } catch (e) {}
    for (var i = 0; i < attrs.length; i++) {
      var a = String(attrs[i]);
      if (a === "array.0" || a.indexOf("array.0.") === 0) {
        out.push(a);
      }
    }
    out.sort(function (x, y) { return x.length - y.length; });
    return out;
  };
  // Array entries are not listed by getAttributes: they are the
  // children of "array". Otherwise "array.0" is written directly.
  var paths = find();
  if (!paths.length) {
    var kids = [];
    try { kids = api.getAttrChildren(nodeId, "array") || []; } catch (e3) {}
    if (kids.length) {
      paths = [String(kids[0])];
    }
  }
  return paths.length ? paths : ["array.0"];
}

// Arrays created without any entry: one is added, then the copy is
// tried again (Cavalry normally creates the first entry itself, so an
// extra one is never added when it exists).
function retryWithNewEntry(nodeId, attempt) {
  try { api.addArrayIndex(nodeId, "array"); } catch (e) { return false; }
  return attempt(firstArrayEntryPaths(nodeId));
}

// Value / Value2 / Value3: "value". Blends: "firstValue". Arrays: their
// first entry, found among the node's attributes (only existing paths
// are written, so Cavalry logs no "Attribute not found"). The value is
// read back: only a value that reads back the same counts as copied.
function seedNodeValue(nodeId, type, value) {
  if (isZeroValue(value)) {
    return false;
  }
  var paths = ["value"];
  if (BLEND_NODE_TYPES.indexOf(type) !== -1) {
    paths = ["firstValue"];
  } else if (/Array$/.test(type)) {
    paths = firstArrayEntryPaths(nodeId);
  }
  var attempt = function (list) {
    for (var i = 0; i < list.length; i++) {
      try {
        var o = {};
        o[list[i]] = value;
        api.set(nodeId, o);
      } catch (e) {
        continue;
      }
      var back = null;
      try { back = api.get(nodeId, list[i]); } catch (e2) {}
      if (sameValue(back, value)) {
        return true;
      }
    }
    return false;
  };
  if (attempt(paths) || (/Array$/.test(type) && retryWithNewEntry(nodeId, attempt))) {
    return true;
  }
  logStatus("Could not copy the current value into " + api.getNiceName(nodeId) + ".");
  return false;
}

// Short names used in node names ("Rectangle_Pos_Oscillator"). Other
// attributes keep their name as shown in the Attribute Editor.
var ATTRIBUTE_SHORT_NAMES = {
  "Position": "Pos",
  "Rotation": "Rot"
};

function shortAttributeName(layerId, attr) {
  // One dimension: the attribute's short name plus the axis ("PosY").
  var axis = String(attr).match(/^(.+)\.(x|y|z)$/);
  if (axis) {
    return shortAttributeName(layerId, axis[1]) + axis[2].toUpperCase();
  }
  var name = attr;
  try { name = api.getAttributeNiceName(layerId, attr) || attr; } catch (e) {}
  // Array entries: "Value.0" -> "Value0".
  name = String(name).replace(/\.(\d+)$/, "$1");
  return ATTRIBUTE_SHORT_NAMES.hasOwnProperty(name) ? ATTRIBUTE_SHORT_NAMES[name] : name;
}

// ------------------------------------------------------------
// Which dimension? (1D node on a 2D / 3D attribute)
// ------------------------------------------------------------
// Cavalry does not tell a script which field (X, Y, Z) of an attribute
// is being edited, only the attribute. When a node that outputs single
// numbers (Value, Oscillator, Value Array…) is created on a vector
// attribute, a small menu offers the whole attribute first (as before),
// then each dimension. Returns true when the menu was shown: the node
// is then created from the menu.
function isVectorType(type) {
  return /^(double|int)[23]$/.test(String(type || ""));
}

function askDimension(shortcut, target, nodeType) {
  if (!target || !nodeType) {
    return false;
  }
  var type = null;
  try { type = api.getAttributeDefinition(target.layer, target.attr).type; } catch (e) {}
  if (!isVectorType(type)) {
    return false;
  }
  var outTypes = nodeOutputTypes(nodeType);
  if (!outTypes || isStringNodeType(nodeType) ||
      (outTypes.indexOf("double") === -1 && outTypes.indexOf("int") === -1)) {
    return false;
  }
  var is3d = false;
  try { is3d = !!api.get(target.layer, "is3d"); } catch (e2) {}
  var entries = attributeEntries(target.layer, target.attr, type, is3d, outTypes);
  if (entries.length <= 1) {
    // e.g. a 2D rotation: only Z is offered, it is used directly.
    if (entries.length === 1 && entries[0].path !== target.attr) {
      createNode(shortcut, { layer: target.layer, attr: entries[0].path });
      return true;
    }
    return false;
  }
  var nice = attrNiceName(target.layer, target.attr);
  var dims = 0;
  for (var c = 0; c < entries.length; c++) {
    if (entries[c].path !== target.attr) {
      dims++;
    }
  }
  ui.clearContextMenu();
  ui.addMenuItem({ name: shortcut.label + " → " + api.getNiceName(target.layer) + "." + nice, onMouseRelease: function () {} });
  ui.addMenuItem({ name: "" });
  for (var i = 0; i < entries.length; i++) {
    (function (entry) {
      var whole = entry.path === target.attr;
      ui.addMenuItem({
        name: whole ? (dims === 3 ? "All (X, Y, Z)" : "Both (X, Y)") : entry.label,
        onMouseRelease: function () {
          createNode(shortcut, { layer: target.layer, attr: entry.path });
        }
      });
    })(entries[i]);
  }
  ui.showContextMenu();
  restoreMainMenuSoon();
  return true;
}

// Oscillator, Noise, Random: the attribute's current value goes into
// this setting, so linking them keeps the value set by the user
// (Minimum / Maximum keep their defaults, except Random's Maximum).
var BEHAVIOUR_SEED_ATTRS = {
  oscillator: "offset",          // Value Offset
  noise: "generator.offset",     // Offset (of the noise type)
  random: "maximum"              // Maximum
};

function seedBehaviourValue(nodeId, type, value) {
  var attr = BEHAVIOUR_SEED_ATTRS[type];
  // Single numbers only: these settings have one value, a 2D / 3D
  // value (whole Position…) cannot go into them.
  if (!attr || typeof value !== "number" || value === 0) {
    return false;
  }
  try {
    var o = {};
    o[attr] = value;
    api.set(nodeId, o);
    return true;
  } catch (e) {
    logStatus("Could not copy the current value into " + api.getNiceName(nodeId) + " (" + attr + ").");
    return false;
  }
}

// Returns true if the node was linked to the attribute.
// keepSettings: a favourite, whose own settings are not overwritten by
// the attribute's value (Oscillator / Noise / Random).
function linkToSelectedAttribute(nodeId, target, baseName, keepSettings) {
  if (!target || !isValueNode(nodeId)) {
    return false;
  }
  var layerName = target.layer;
  try { layerName = api.getNiceName(target.layer); } catch (e0) {}
  var existing = "";
  try { existing = api.getInConnection(target.layer, target.attr); } catch (e1) {}
  if (existing) {
    logStatus("'" + layerName + "." + target.attr + "' already has an input: node created without linking it. Disconnect the attribute first to link a new node.");
    return false;
  }
  var targetType = null;
  try { targetType = api.getAttributeDefinition(target.layer, target.attr).type; } catch (eT) {}
  if (targetType === "color" && !canDriveColor(nodeOutputTypes(api.getLayerType(nodeId)))) {
    logStatus("'" + baseName + "' cannot drive a colour: node created without linking it.");
    return false;
  }
  // Value nodes keep the attribute's current value (read before linking).
  var currentValue = null;
  try { currentValue = api.get(target.layer, target.attr); } catch (eV) {}
  if (!connectNodeOutput(nodeId, target.layer, target.attr)) {
    logStatus("'" + baseName + "' is not compatible with '" + layerName + "." + target.attr + "': node created without linking it.");
    return false;
  }
  try { api.parent(nodeId, target.layer); } catch (e4) {}
  // Every node inserted on an attribute: "<LayerName>_<Attribute>_<NodeName>",
  // e.g. "Rectangle_Pos_Oscillator" (see ATTRIBUTE_SHORT_NAMES).
  // Color Arrays keep "Color Array_<LayerName>".
  var nodeTypeId = "";
  try { nodeTypeId = api.getLayerType(nodeId); } catch (e7) {}
  var linkedName = layerName + "_" + shortAttributeName(target.layer, target.attr) + "_" + baseName;
  if (nodeTypeId === "colorArray") {
    linkedName = baseName + "_" + layerName;
  }
  if (STRING_TYPES.indexOf(targetType) !== -1 && isStringNodeType(nodeTypeId)) {
    seedStringNode(nodeId, nodeTypeId, currentValue);
  } else if (VALUE_NODE_TYPES.indexOf(nodeTypeId) !== -1 || BLEND_NODE_TYPES.indexOf(nodeTypeId) !== -1 ||
      nodeTypeId === "colorArray") {
    seedNodeValue(nodeId, nodeTypeId, currentValue);
  } else if (!keepSettings && BEHAVIOUR_SEED_ATTRS[nodeTypeId]) {
    seedBehaviourValue(nodeId, nodeTypeId, currentValue);
  }
  try { api.rename(nodeId, linkedName); } catch (e5) {}
  logStatus("Node created: " + linkedName + " → " + layerName + "." + target.attr);
  return true;
}

// ------------------------------------------------------------
// Layouts (Create > Layout > Embed selected in … Layout)
// ------------------------------------------------------------
//   Layout Group:      the selected layers become its children
//                      (horizontal, or vertical when the shortcut's name
//                      contains "Vertical").
//   Grid Layout Group: Grid Layout Group > Grid Layout Row > layers.
//   Grid Layout Row:   the selected layers become its children.
function setLayoutDirection(layoutId, shortcut) {
  var vertical = shortcut.layoutDirection === "vertical" ||
    (!shortcut.layoutDirection && /vertical/i.test(String(shortcut.label || "")));
  try { api.set(layoutId, { direction: vertical ? 1 : 0 }); } catch (e) {}
}

// Index of a layer among its siblings (0 = top of the Scene Window).
function siblingIndex(id) {
  var parent = "";
  try { parent = api.getParent(id); } catch (e) {}
  var siblings = [];
  try { siblings = api.getChildren(parent || api.getActiveComp()) || []; } catch (e2) {}
  var i = siblings.indexOf(id);
  return i === -1 ? 99999 : i;
}

function isPositionAnimated(id) {
  try {
    var animated = api.getAnimatedAttributes(id) || [];
    for (var i = 0; i < animated.length; i++) {
      if (String(animated[i]).indexOf("position") === 0) {
        return true;
      }
    }
  } catch (e) {}
  return false;
}

// Children are added bottom first: each new child lands on top, so the
// original top-to-bottom order is kept. Their position is reset to 0,0
// (as Cavalry does when a layer enters a layout).
function moveIntoLayout(layers, parentId) {
  for (var i = layers.length - 1; i >= 0; i--) {
    try { api.parent(layers[i], parentId); } catch (e) {}
    if (!isPositionAnimated(layers[i])) {
      try { api.set(layers[i], { "position.x": 0, "position.y": 0 }); } catch (e2) {}
    }
  }
}

function embedInLayout(layoutId, selection, kind, shortcut) {
  var layers = selection.slice();
  layers.sort(function (a, b) { return siblingIndex(a) - siblingIndex(b); });
  // The layout takes the place of the top selected layer.
  try { api.reorder(layoutId, layers[0]); } catch (e) {}
  if (kind === "layout") {
    setLayoutDirection(layoutId, shortcut);
  }
  var target = layoutId;
  if (kind === "grid") {
    var rowId = "";
    try { rowId = api.create("gridLayoutRow", "Grid Layout Row"); } catch (e2) {}
    if (rowId) {
      try { api.parent(rowId, layoutId); } catch (e3) {}
      target = rowId;
    }
  }
  moveIntoLayout(layers, target);
  logStatus(shortcut.label + ": " + layers.length + " layer(s) embedded.");
}

// Align (and other node-list effects): added to the selected layer's
// Deformers, child of that layer, named "<LayerName>_<NodeName>".
function countDeformerInputs(layerId) {
  try {
    var ins = api.getInConnectedAttributes(layerId) || [];
    var n = 0;
    for (var i = 0; i < ins.length; i++) {
      if (/^deformers\.\d+$/.test(String(ins[i]))) {
        n++;
      }
    }
    return n;
  } catch (e) {
    return -1;
  }
}

function attachAsDeformer(nodeId, layerId, baseName) {
  var layerName = api.getNiceName(layerId);
  var linked = false;
  var canDeform = false;
  try { canDeform = api.hasAttribute(layerId, "deformers"); } catch (e0) {}
  if (canDeform) {
    var before = countDeformerInputs(layerId);
    try { api.connect(nodeId, "id", layerId, "deformers"); } catch (e) {}
    var after = countDeformerInputs(layerId);
    linked = before < 0 || after > before;
  }
  try { api.parent(nodeId, layerId); } catch (e2) {}
  try { api.rename(nodeId, layerName + "_" + baseName); } catch (e3) {}
  logStatus(linked ? "Node created: " + layerName + "_" + baseName + " → " + layerName + ".deformers" :
    "Node created: " + layerName + "_" + baseName + " (child of " + layerName + ", not linked: this layer has no Deformers).");
}

// ------------------------------------------------------------
// Shelf actions: Embed in Horizontal / Vertical / Grid Layout
// ------------------------------------------------------------
// Same as the Shelf buttons (and Create > Layout): with layers selected
// they are embedded in a new layout; otherwise an empty layout is made.
var SHELF_LAYOUTS = [
  { layout: "horizontal", label: "Embed in Horizontal Layout", iconFile: "shelf_LayoutHorizontal.png" },
  { layout: "vertical",   label: "Embed in Vertical Layout",   iconFile: "shelf_LayoutVertical.png" },
  { layout: "grid",       label: "Embed in Grid Layout",       iconFile: "shelf_LayoutGrid.png" }
];
var SHELF_UUID_PREFIX = "cbar-shelf:";

function shelfLayoutFor(key) {
  for (var i = 0; i < SHELF_LAYOUTS.length; i++) {
    if (SHELF_LAYOUTS[i].layout === key) {
      return SHELF_LAYOUTS[i];
    }
  }
  return null;
}

function runLayoutShortcut(shortcut) {
  var sel = api.getSelection() || [];
  var grid = shortcut.layout === "grid";
  var type = grid ? "gridLayoutGroup" : "layoutGroup";
  var name = grid ? "Grid Layout" : (shortcut.layout === "vertical" ? "Vertical Layout" : "Horizontal Layout");
  var id;
  try {
    id = api.create(type, name);
  } catch (e) {
    logStatus("Could not create the layout: " + e);
    return;
  }
  var opts = { label: shortcut.label, layoutDirection: shortcut.layout === "vertical" ? "vertical" : "horizontal" };
  if (sel.length) {
    embedInLayout(id, sel, grid ? "grid" : "layout", opts);
  } else if (!grid) {
    setLayoutDirection(id, opts);
  }
  api.select([id]);
}

function addLayoutShortcut(key, targetId) {
  var def = shelfLayoutFor(key);
  if (!def) {
    return;
  }
  var id = targetId || currentBar.id;
  var list = getBarShortcuts(id);
  for (var i = 0; i < list.length; i++) {
    if (list[i].kind === "layout" && list[i].layout === key) {
      logStatus("'" + def.label + "' is already in the bar.");
      return;
    }
  }
  mutateBarShortcuts(id, function (l) {
    l.push({ kind: "layout", layout: key, label: def.label, iconFile: def.iconFile, uid: makeUid("layout_" + key) });
  });
  logStatus("Shortcut added: " + def.label);
}

// A row of the Nodes list: a node type, or a Shelf action.
function addPickerRow(uuid, targetId) {
  if (String(uuid).indexOf(SHELF_UUID_PREFIX) === 0) {
    addLayoutShortcut(String(uuid).substr(SHELF_UUID_PREFIX.length), targetId);
  } else {
    addShortcutForType(uuid, findTypeName(uuid), targetId);
  }
}

var INPUT_SHAPE_TYPES = ["subBoundingBox", "extractSubMeshes"];

function isBehaviourNode(nodeId) {
  try {
    var st = api.getSuperTypes(nodeId) || [];
    if (st.indexOf("behaviour") !== -1) {
      return true;
    }
    // Path behaviours: their output is a mesh (they deform shapes).
    if (st.indexOf("behaviourBase") !== -1 && st.indexOf("shape") === -1) {
      var out = api.getAttributeDefinition(nodeId, "out");
      return !!out && out.type === "polyMesh";
    }
  } catch (e) {}
  return false;
}

// Nodes whose output is only a colour (Color Blend, Contrasting Color…).
function isColorNode(nodeId) {
  try {
    var type = api.getLayerType(nodeId);
    if (type === "colorArray") {
      return false;
    }
    var outTypes = nodeOutputTypes(type);
    return !!outTypes && outTypes.indexOf("color") !== -1 && canDriveColor(outTypes);
  } catch (e) {
    return false;
  }
}

function attachToFill(nodeId, layerId, baseName) {
  var layerName = api.getNiceName(layerId);
  var fillAttr = "material.materialColor";
  var status;
  var canFill = false;
  try { canFill = api.hasAttribute(layerId, fillAttr); } catch (e0) {}
  if (!canFill) {
    status = "not linked: this layer has no Fill";
  } else {
    var existing = "";
    try { existing = api.getInConnection(layerId, fillAttr); } catch (e1) {}
    if (existing) {
      status = "not linked: its Fill already has an input";
    } else {
      try { if (!api.hasFill(layerId)) { api.setFill(layerId, true); } } catch (e2) {}
      status = connectNodeOutput(nodeId, layerId, fillAttr) ? "→ " + layerName + ".Fill" :
        "not linked: the Fill refused this node";
    }
  }
  try { api.parent(nodeId, layerId); } catch (e4) {}
  try { api.rename(nodeId, layerName + "_" + baseName); } catch (e5) {}
  logStatus("Node created: " + layerName + "_" + baseName + " " + status);
}

function hasInputShapesList(nodeId) {
  try {
    return api.hasAttribute(nodeId, "shapes") &&
      api.getAttributeDefinition(nodeId, "shapes").type === "list";
  } catch (e) {
    return false;
  }
}

function createNode(shortcut, forcedTarget) {
  if (shortcut.kind === "spacer") {
    return;
  }
  if (shortcut.kind === "script") {
    runScriptShortcut(shortcut);
    return;
  }
  if (shortcut.kind === "expression") {
    runExpressionShortcut(shortcut, false);
    return;
  }
  if (shortcut.kind === "rig") {
    recallRig(shortcut.rig);
    return;
  }
  if (shortcut.kind === "layout") {
    runLayoutShortcut(shortcut);
    return;
  }
  if (shortcut.kind === "keys") {
    sendKeys(shortcut);
    return;
  }
  if (shortcut.preset) {
    createFromFavorite(shortcut, forcedTarget);
    return;
  }
  var displayName = shortcut.label;

  // Read the selection BEFORE creating the node (creating can change it)
  var attrTarget = forcedTarget || getSelectedAttributeTarget();
  var fullSelection = api.getSelection() || [];
  var selectedLayerId = null;
  if (shortcut.useSelectedLayer) {
    var selection = api.getSelection();
    if (selection.length === 1) {
      selectedLayerId = selection[0];
    }
  }

  var nodeType = shortcut.type || findLayerTypeByName(shortcut.nodeName || displayName);
  if (!nodeType) {
    logStatus("Node type not found for '" + displayName + "'. Similar types:\n" + listSimilarTypes(displayName));
    return;
  }

  // A Text Shape selected on its own: text nodes go to its String
  // without selecting that attribute first.
  if (!attrTarget && fullSelection.length === 1 && TEXT_AUTO_LINK_TYPES.indexOf(nodeType) !== -1) {
    var selType = "";
    try { selType = api.getLayerType(fullSelection[0]); } catch (eT) {}
    if (selType === "textShape") {
      attrTarget = { layer: fullSelection[0], attr: "text" };
    }
  }

  // A 1D node on a 2D / 3D attribute: ask which dimension (the node is
  // created from the menu).
  if (!forcedTarget && askDimension(shortcut, attrTarget, nodeType)) {
    return;
  }

  // Align: added to the deformers of the selected layer.
  var deformerHost = null;
  if (!forcedTarget && nodeType === "align" && fullSelection.length === 1) {
    try {
      if (api.hasAttribute(fullSelection[0], "deformers")) {
        deformerHost = fullSelection[0];
      }
    } catch (eD) {}
  }

  var nodeId;
  try {
    nodeId = api.create(nodeType, displayName);
  } catch (e) {
    logStatus("Could not create '" + displayName + "' (" + nodeType + "): " + e);
    return;
  }

  if (deformerHost) {
    attachAsDeformer(nodeId, deformerHost, displayName);
    api.select([nodeId]);
    return;
  }

  // Sub-Mesh Bounding Box, Extract Sub-Meshes: the selected layer goes
  // into the Input Shape (the node stays where it is).
  if (!forcedTarget && fullSelection.length && INPUT_SHAPE_TYPES.indexOf(nodeType) !== -1) {
    try {
      api.connect(fullSelection[0], "id", nodeId, "inputShape");
      logStatus("Node created: " + displayName + " (Input Shape = " + api.getNiceName(fullSelection[0]) + ").");
    } catch (eIS) {
      logStatus("Node created, but the selected layer could not be used as its Input Shape: " + eIS);
    }
    api.select([nodeId]);
    return;
  }

  // Colour nodes (Color Blend, Contrasting Color…) with a layer selected
  // and no attribute selected: connected to the layer's Fill, child of the
  // layer, "<LayerName>_<NodeName>".
  if (!forcedTarget && !attrTarget && fullSelection.length === 1 && isColorNode(nodeId)) {
    attachToFill(nodeId, fullSelection[0], displayName);
    api.select([nodeId]);
    return;
  }

  // Behaviours (Oscillator, Noise…) and path behaviours (Subdivide, Clean
  // Up, Resample Path…) with a layer selected and no attribute selected:
  // added to the layer's Deformers, child of the layer,
  // "<LayerName>_<NodeName>".
  if (!forcedTarget && !attrTarget && fullSelection.length === 1 && isBehaviourNode(nodeId) &&
      VALUE_NODE_TYPES.indexOf(nodeType) === -1) {
    attachAsDeformer(nodeId, fullSelection[0], displayName);
    api.select([nodeId]);
    return;
  }

  // Duplicator, Extrude… (an "Input Shapes" list): the selected layers
  // are added to it, like the Shelf buttons.
  if (!forcedTarget && fullSelection.length && hasInputShapesList(nodeId)) {
    // The layers also become children of the node, which is named
    // "<NodeName>_<FirstLayerName>" (e.g. "Duplicator_Circle").
    var added = 0;
    var ordered = fullSelection.slice();
    ordered.sort(function (a, b) { return siblingIndex(a) - siblingIndex(b); });
    try { api.reorder(nodeId, ordered[0]); } catch (eR) {}
    for (var si = 0; si < ordered.length; si++) {
      try {
        api.connect(ordered[si], "id", nodeId, "shapes");
        added++;
      } catch (eS) {}
    }
    for (var sp = ordered.length - 1; sp >= 0; sp--) {
      try { api.parent(ordered[sp], nodeId); } catch (eP) {}
    }
    var dupName = displayName + "_" + api.getNiceName(ordered[0]);
    try { api.rename(nodeId, dupName); } catch (eN) {}
    logStatus("Node created: " + dupName + " (" + added + " layer(s) in its Input Shapes).");
    api.select([nodeId]);
    return;
  }

  if (attrTarget && linkToSelectedAttribute(nodeId, attrTarget, displayName)) {
    api.select([nodeId]);
    return;
  }

  if (selectedLayerId && !shortcut.nodeName && !api.hasAttribute(nodeId, "inputShape")) {
    selectedLayerId = null;
  }

  if (selectedLayerId) {
    try {
      applySelectionToNode(nodeId, selectedLayerId, shortcut);
      logStatus("Node created: " + api.getNiceName(nodeId) + " (Input Shape = " + api.getNiceName(selectedLayerId) + ").");
    } catch (e2) {
      logStatus("Node created, but it could not be linked to the selected layer: " + e2);
    }
  } else {
    logStatus("Node created: " + displayName + " (" + nodeType + ")");
  }
  api.select([nodeId]);
}

// ------------------------------------------------------------
// Alt + click: Color Array from the active palette
// ------------------------------------------------------------
// The palette shown in the Color window is stored, as a file path, in
// Cavalry's preferences ("previousPalette"). Its name and scope are
// found by matching that path in the list of palettes.
function activePalette() {
  var path = "";
  try { path = String(api.getCavalryPreference("previousPalette") || ""); } catch (e) {}
  if (!path) {
    return null;
  }
  var palettes = [];
  try { palettes = api.listPalettes("all") || []; } catch (e2) {}
  for (var i = 0; i < palettes.length; i++) {
    if (palettes[i].path === path) {
      return { name: palettes[i].name, scope: palettes[i].scope };
    }
  }
  return null;
}

// Color Array button
//   click:                  basic Color Array
//   click + layer:          connected to the layer's Fill, child of the
//                           layer, named "Color Array_<Layer>"
//   Shift + click:          from the active palette of the Color window,
//                           named "Color Array_<Palette>"
//   Shift + click + layer:  same, connected to the Fill, child of the
//                           layer, named "Color Array_<Layer>_<Palette>"
//   Shift + click with Color Array(s) selected, or layers coloured by
//                           one: their colours are replaced by the
//                           palette's (no new node)

// Selected Color Arrays, and those that drive an attribute of a
// selected layer (its Fill, a Stroke…).
function colorArraysFromSelection() {
  var sel = api.getSelection() || [];
  var out = [];
  function isColorArray(id) {
    try { return api.getLayerType(id) === "colorArray"; } catch (e) { return false; }
  }
  for (var i = 0; i < sel.length; i++) {
    if (isColorArray(sel[i])) {
      if (out.indexOf(sel[i]) === -1) {
        out.push(sel[i]);
      }
      continue;
    }
    var ins = [];
    try { ins = api.getInConnectedAttributes(sel[i]) || []; } catch (e1) {}
    for (var j = 0; j < ins.length; j++) {
      var conn = "";
      try { conn = api.getInConnection(sel[i], ins[j]) || ""; } catch (e2) {}
      var src = String(conn).split(".")[0];
      if (src && isColorArray(src) && out.indexOf(src) === -1) {
        out.push(src);
      }
    }
  }
  return out;
}

// Colours of a palette (read from a temporary Color Array), or null.
function paletteColors(pal) {
  var tmp = "";
  try { tmp = api.createColorArrayFromPalette(pal.name, pal.scope); } catch (e) {}
  if (!tmp) {
    try { tmp = api.createColorArrayFromPalette(pal.name); } catch (e1) {}
  }
  if (!tmp) {
    return null;
  }
  var cols = [];
  try {
    var n = api.getArrayCount(tmp, "array");
    for (var i = 0; i < n; i++) {
      cols.push(api.get(tmp, "array." + i));
    }
  } catch (e2) {}
  try { api.deleteLayer(tmp); } catch (e3) {}
  return cols;
}

// The selected Color Arrays keep their name and connections, and get as
// many entries as the palette. An entry driven by a connection is kept.
function swapColorArraysToPalette(arrays, pal) {
  var cols = paletteColors(pal);
  if (!cols || !cols.length) {
    showMessage("Palette \"" + pal.name + "\" not found or empty");
    return;
  }
  var kept = 0;
  for (var a = 0; a < arrays.length; a++) {
    var ca = arrays[a];
    var n = 0;
    try { n = api.getArrayCount(ca, "array"); } catch (e) {}
    while (n < cols.length) {
      api.addArrayIndex(ca, "array");
      n++;
    }
    while (n > cols.length) {
      api.removeArrayIndex(ca, "array." + (n - 1));
      n--;
    }
    for (var i = 0; i < cols.length; i++) {
      var attr = "array." + i;
      var conn = "";
      try { conn = api.getInConnection(ca, attr) || ""; } catch (e2) {}
      if (conn) {
        kept++;
        continue;
      }
      var v = {};
      v[attr] = cols[i];
      api.set(ca, v);
    }
  }
  logStatus(arrays.length + " Color Array(s) now use the palette \"" + pal.name + "\" (" + cols.length + " colours)" +
    (kept ? ", " + kept + " connected entr" + (kept > 1 ? "ies" : "y") + " kept" : "") + ".");
}

function createColorArray(shortcut, fromPalette) {
  var pal = null;
  if (fromPalette) {
    pal = activePalette();
    if (!pal) {
      showMessage("No active palette in the Color window");
      return;
    }
    var arrays = colorArraysFromSelection();
    if (arrays.length) {
      swapColorArraysToPalette(arrays, pal);
      return;
    }
  }
  // Read the selection BEFORE creating the node.
  var sel = api.getSelection() || [];
  var layerId = sel.length === 1 ? sel[0] : null;
  var base = shortcut.label || "Color Array";
  var nodeId = "";
  if (pal) {
    try { nodeId = api.createColorArrayFromPalette(pal.name, pal.scope); } catch (e) {}
    if (!nodeId) {
      try { nodeId = api.createColorArrayFromPalette(pal.name); } catch (e1) {}
    }
    if (!nodeId) {
      showMessage("Palette \"" + pal.name + "\" not found");
      return;
    }
  } else {
    try {
      nodeId = api.create("colorArray", base);
    } catch (e2) {
      logStatus("Could not create '" + base + "': " + e2);
      return;
    }
  }
  var name = base;
  var status = "Color Array created";
  if (layerId) {
    var layerName = api.getNiceName(layerId);
    name += "_" + layerName;
    status += " under " + layerName;
    var fillAttr = "material.materialColor";
    var canFill = false;
    try { canFill = api.hasAttribute(layerId, fillAttr); } catch (e3) {}
    if (canFill) {
      var existing = "";
      try { existing = api.getInConnection(layerId, fillAttr); } catch (e4) {}
      if (existing) {
        status += " (its Fill already has an input: not connected)";
      } else {
        try { if (!api.hasFill(layerId)) { api.setFill(layerId, true); } } catch (e5) {}
        // Basic Color Array: starts with the layer's current fill colour.
        if (!pal) {
          var fillColor = null;
          try { fillColor = api.get(layerId, fillAttr); } catch (eC) {}
          seedNodeValue(nodeId, "colorArray", fillColor);
        }
        try { api.connect(nodeId, "id", layerId, fillAttr); } catch (e6) {}
        status += ", connected to its Fill";
      }
    } else {
      status += " (this layer has no Fill: not connected)";
    }
    try { api.parent(nodeId, layerId); } catch (e7) {}
  }
  if (pal) {
    name += "_" + pal.name;
    status += ", from the palette \"" + pal.name + "\"";
  }
  try { api.rename(nodeId, name); } catch (e8) {}
  api.select([nodeId]);
  logStatus(status + ".");
}

function isColorArrayShortcut(shortcut) {
  return !shortcut.kind && !shortcut.preset && shortcutNodeType(shortcut) === "colorArray";
}

// ------------------------------------------------------------
// Alt + click: filter attached to the selected layer
// ------------------------------------------------------------
function isFilterType(type) {
  if (!type) {
    return false;
  }
  if (typeChain(type).indexOf("filter") !== -1) {
    return true;
  }
  return /filter/i.test(String(type));
}

// The filter goes into the Filters list of the selected layer, becomes
// its child and is renamed "<LayerName>_<FilterName>".
function createFilterOnSelectedLayer(shortcut) {
  var sel = api.getSelection() || [];
  if (sel.length !== 1) {
    showMessage(MSG_SELECT_LAYER);
    return;
  }
  var layerId = sel[0];
  var hasFilters = false;
  try { hasFilters = api.hasAttribute(layerId, "filters"); } catch (e0) {}
  if (!hasFilters) {
    showMessage("This layer cannot take filters");
    return;
  }
  var nodeType = shortcutNodeType(shortcut);
  var nodeId;
  try {
    nodeId = api.create(nodeType, shortcut.label);
  } catch (e) {
    logStatus("Could not create '" + shortcut.label + "' (" + nodeType + "): " + e);
    return;
  }
  var layerName = api.getNiceName(layerId);
  var before = countFilterInputs(layerId);
  try { api.connect(nodeId, "id", layerId, "filters"); } catch (e1) {}
  var after = countFilterInputs(layerId);
  var linked = before < 0 || after > before; // -1: could not check
  try { api.parent(nodeId, layerId); } catch (e3) {}
  try { api.rename(nodeId, layerName + "_" + shortcut.label); } catch (e4) {}
  api.select([nodeId]);
  logStatus(linked ? "Filter created: " + layerName + "_" + shortcut.label + " → " + layerName + ".filters" :
    "Filter created, but it could not be added to the filters of " + layerName + ".");
}

function countFilterInputs(layerId) {
  try {
    var ins = api.getInConnectedAttributes(layerId) || [];
    var n = 0;
    for (var i = 0; i < ins.length; i++) {
      if (/^filters\.\d+$/.test(String(ins[i]))) {
        n++;
      }
    }
    return n;
  } catch (e) {
    return -1;
  }
}

// Alt + click behaviours specific to a node type. Returns true when
// handled.
function handleAltClick(shortcut) {
  if (shortcut.kind || shortcut.preset) {
    return false;
  }
  var type = shortcutNodeType(shortcut);
  if (isFilterType(type)) {
    createFilterOnSelectedLayer(shortcut);
    return true;
  }
  return false;
}

// targetId: the bar that receives the shortcut (this bar by default).
function addShortcutForType(type, name, targetId) {
  var id = targetId || currentBar.id;
  var list = getBarShortcuts(id);
  for (var i = 0; i < list.length; i++) {
    if (list[i].type === type && !list[i].preset && list[i].kind !== "script") {
      logStatus("'" + name + "' is already in the bar (page " + pageOf(list[i]) + ").");
      return;
    }
  }
  mutateBarShortcuts(id, function (l) {
    l.push({ type: type, label: name, useSelectedLayer: true, uid: makeUid(type) });
  });
  logStatus("Shortcut added: " + name + " (" + type + ")");
}

function addScriptShortcut(script, targetId) {
  var id = targetId || currentBar.id;
  var list = getBarShortcuts(id);
  for (var i = 0; i < list.length; i++) {
    if (list[i].kind === "script" && toPortablePath(list[i].path) === toPortablePath(script.path)) {
      logStatus("'" + script.name + "' is already in the bar.");
      return;
    }
  }
  mutateBarShortcuts(id, function (l) {
    l.push({ kind: "script", path: toPortablePath(script.path), label: script.name, uid: makeUid("script_" + script.name) });
  });
  logStatus("Script added: " + script.name);
}

// ------------------------------------------------------------
// Expressions
// ------------------------------------------------------------
// An expression shortcut applies its text (e.g. "*2", "+15") to the
// attribute(s) selected in the Attribute Editor. Note: Cavalry only
// evaluates an attribute expression when the attribute has an input
// connection (the expression offsets the incoming value).

// Every selected attribute, as [{ layer, attr }].
function getSelectedAttributeTargets() {
  var out = [];
  var sel = null;
  try { sel = api.getSelectedAttributes(); } catch (e) { return out; }
  for (var i = 0; i < (sel || []).length; i++) {
    var item = sel[i];
    if (item && item.length >= 2) {
      out.push({ layer: String(item[0]), attr: String(item[1]) });
    }
  }
  return out;
}

function applyExpression(expression, targets, label) {
  expression = String(expression || "");
  if (!expression) {
    logStatus("Empty expression.");
    return 0;
  }
  if (!targets || !targets.length) {
    logStatus("Select one or more attributes in the Attribute Editor to apply " + (label ? "\"" + label + "\"" : "the expression") + ".");
    return 0;
  }
  var done = 0;
  var unconnected = [];
  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    var name = t.layer;
    try { name = api.getNiceName(t.layer); } catch (e0) {}
    try {
      api.setAttributeExpression(t.layer, t.attr, expression);
      done++;
      var input = "";
      try { input = api.getInConnection(t.layer, t.attr); } catch (e1) {}
      if (!input) {
        unconnected.push(name + "." + t.attr);
      }
    } catch (e2) {
      logStatus("Could not set the expression on " + name + "." + t.attr + ": " + e2);
    }
  }
  logStatus("Expression \"" + expression + "\" applied to " + done + " attribute(s).");
  if (unconnected.length) {
    logStatus("No input connection on " + unconnected.join(", ") +
      ": Cavalry only evaluates attribute expressions on connected attributes.");
  }
  return done;
}

var exprDialog = null;
var exprField = null;
var exprSaveCheck = null;
var exprNameField = null;
var exprTargetLabel = null;
var exprTargetId = null;
var exprEditUid = null;   // set when editing a saved expression shortcut
var exprApplyBtn = null;
var exprTitle = null;

// editUid: edit that saved expression instead of creating a new one.
// saveByDefault: "Save as a shortcut" starts checked (from Settings).
function openExpressionDialog(targetId, editUid, saveByDefault) {
  exprTargetId = typeof targetId === "string" ? targetId : currentBar.id;
  exprEditUid = editUid || null;
  if (!exprDialog) {
    exprField = new ui.LineEdit();
    exprField.setPlaceholder("e.g. *2   +15   *-1");
    exprSaveCheck = new ui.Checkbox(false);
    exprNameField = new ui.LineEdit();
    exprNameField.setPlaceholder("Shortcut name (shown in its tooltip)");
    exprNameField.setEnabled(false);
    exprSaveCheck.onValueChanged = function () {
      exprNameField.setEnabled(exprSaveCheck.getValue());
    };
    exprTargetLabel = new ui.Label("");

    var saveRow = new ui.HLayout();
    saveRow.add(exprSaveCheck, new ui.Label("Save as a shortcut"));
    saveRow.addStretch();

    exprApplyBtn = new ui.Button("Apply");
    exprApplyBtn.onClick = function () {
      var expr = String(exprField.getText() || "").replace(/^\s+|\s+$/g, "");
      if (!expr) {
        showMessage("Type an expression first.");
        return;
      }
      if (exprEditUid) {
        var newName = trimName(exprNameField.getText());
        if (!newName) {
          showMessage("Give the expression a name.");
          return;
        }
        var uidToEdit = exprEditUid;
        mutateBarShortcuts(exprTargetId, function (l) {
          var idx = indexOfUidIn(l, uidToEdit);
          if (idx !== -1) {
            l[idx].expression = expr;
            l[idx].label = newName;
          }
        });
        logStatus("Expression shortcut updated: " + newName + " (" + expr + ")");
        exprDialog.close();
        return;
      }
      var save = exprSaveCheck.getValue();
      var name = trimName(exprNameField.getText());
      if (save && !name) {
        showMessage("Give the expression a name to save it.");
        return;
      }
      var targets = getSelectedAttributeTargets();
      if (!targets.length && !save) {
        showMessage("Select one or more attributes in the Attribute Editor first.");
        return;
      }
      if (targets.length) {
        applyExpression(expr, targets, name);
      }
      if (save) {
        mutateBarShortcuts(exprTargetId, function (l) {
          l.push({ kind: "expression", expression: expr, label: name, uid: makeUid("expr_" + name) });
        });
        logStatus("Expression shortcut saved: " + name + " (" + expr + ")");
      }
      exprDialog.close();
    };
    var cancelBtn = new ui.Button("Cancel");
    cancelBtn.onClick = function () {
      exprDialog.close();
    };
    var buttons = new ui.HLayout();
    buttons.addStretch();
    buttons.add(cancelBtn, exprApplyBtn);

    exprTitle = sectionTitle("Expression");
    var layout = new ui.VLayout();
    layout.setMargins(10, 10, 10, 10);
    layout.add(exprTitle);
    layout.add(exprField);
    layout.add(exprTargetLabel);
    layout.addSpacing(6);
    layout.add(saveRow);
    layout.add(exprNameField);
    layout.addStretch();
    layout.add(buttons);

    exprDialog = new ui.Container();
    exprDialog.setMinimumWidth(340);
    exprDialog.setMinimumHeight(190);
    exprDialog.setLayout(layout);
  }
  if (exprEditUid) {
    var list = getBarShortcuts(exprTargetId);
    var item = list[indexOfUidIn(list, exprEditUid)] || {};
    exprTitle.setText("Edit Expression");
    exprTargetLabel.setText("Changes the saved shortcut (attributes are not modified).");
    exprField.setText(item.expression || "");
    exprSaveCheck.setValue(true);
    exprSaveCheck.setEnabled(false);
    exprNameField.setText(item.label || "");
    exprNameField.setEnabled(true);
    exprApplyBtn.setText("Save");
  } else {
    var n = getSelectedAttributeTargets().length;
    exprTitle.setText("Expression");
    exprTargetLabel.setText(n ? "Applies to the " + n + " selected attribute(s)." :
      "No attribute selected: select one in the Attribute Editor before applying.");
    exprField.setText("");
    exprSaveCheck.setValue(!!saveByDefault);
    exprSaveCheck.setEnabled(true);
    exprNameField.setText("");
    exprNameField.setEnabled(!!saveByDefault);
    exprApplyBtn.setText("Apply");
  }
  showOnTop(exprDialog);
}

// ------------------------------------------------------------
// Rigs
// ------------------------------------------------------------
// A rig is a layer saved with everything around it (child layers,
// connected nodes, expressions, keyframes, values, names) through
// Cavalry's own serialise / deserialise. Each rig lives in its own file,
// C-Bar_assets/rigs/<id>.json, so it can be shared on its own.
// Links to the composition (time, fps…) are stored as a placeholder and
// re-linked to the active composition when the rig is recalled.

var RIGS_DIR = ASSETS_DIR + "/rigs";
var RIG_COMP_TOKEN = "__CBAR_COMP__";

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rigFilePath(rigId) {
  return RIGS_DIR + "/" + rigId + ".json";
}

// options: { children, connected, expressions, keyframes } (booleans)
function saveRig(layerId, name, options, description) {
  ensureFolder(RIGS_DIR);
  var data = api.serialise([layerId], true);
  var comp = api.getActiveComp();
  if (comp) {
    data = data.replace(new RegExp(escapeRegExp(comp) + "(?=[.\"])", "g"), RIG_COMP_TOKEN);
  }
  var base = slugify(name);
  var rigId = base;
  var n = 2;
  while (api.filePathExists(rigFilePath(rigId))) {
    rigId = base + "-" + n;
    n++;
  }
  var rig = {
    version: 1,
    name: name,
    rootType: api.getLayerType(layerId),
    rootName: api.getNiceName(layerId),
    description: description || "",
    options: options,
    scene: sceneFilePath(),
    data: data
  };
  api.writeToFile(rigFilePath(rigId), JSON.stringify(rig), true);
  return { id: rigId, rootType: rig.rootType };
}

function readRig(rigId) {
  var path = rigFilePath(rigId);
  if (!api.filePathExists(path)) {
    return null;
  }
  try {
    return JSON.parse(api.readFromFile(path));
  } catch (e) {
    return null;
  }
}

function hasSuperType(id, type) {
  try {
    return (api.getSuperTypes(id) || []).indexOf(type) !== -1;
  } catch (e) {
    return false;
  }
}

// Render-tree descendants of a layer.
function descendantsOf(id) {
  var out = [];
  var kids = [];
  try { kids = api.getChildren(id) || []; } catch (e) {}
  for (var i = 0; i < kids.length; i++) {
    out.push(kids[i]);
    out = out.concat(descendantsOf(kids[i]));
  }
  return out;
}

// Removes layer colour labels from serialised data (back to defaults).
function stripLabels(data) {
  try {
    var json = JSON.parse(data);
    var nodes = json.nodes || [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].attributes) {
        delete nodes[i].attributes.colorId;
        delete nodes[i].attributes.color;
      }
    }
    return JSON.stringify(json);
  } catch (e) {
    return data;
  }
}

// Removes attribute expressions from serialised data (Cavalry stores
// them as "expression" / "childExprs" inside each attribute).
function stripExpressions(data) {
  try {
    var json = JSON.parse(data);
    var walk = function (obj) {
      if (!obj || typeof obj !== "object") {
        return;
      }
      delete obj.expression;
      delete obj.expressionEnabled;
      delete obj.childExprs;
      for (var k in obj) {
        walk(obj[k]);
      }
    };
    var nodes = json.nodes || [];
    for (var i = 0; i < nodes.length; i++) {
      walk(nodes[i].attributes);
    }
    return JSON.stringify(json);
  } catch (e) {
    return data;
  }
}

function sceneFilePath() {
  try { return String(api.getSceneFilePath() || ""); } catch (e) { return ""; }
}

// Inputs of the recalled layers that come from layers outside the rig
// (the composition itself excepted), as "layer.attr ← source" strings.
// In another scene such a layer id can point to an unrelated layer.
function externalInputs(layers, isNew, comp) {
  var out = [];
  for (var i = 0; i < layers.length; i++) {
    var attrs = [];
    try { attrs = api.getInConnectedAttributes(layers[i]) || []; } catch (e) {}
    for (var a = 0; a < attrs.length; a++) {
      var src = "";
      try { src = String(api.getInConnection(layers[i], attrs[a]) || ""); } catch (e2) {}
      if (!src) {
        continue;
      }
      var dot = src.indexOf(".");
      var srcLayer = dot === -1 ? src : src.substr(0, dot);
      if (isNew[srcLayer] || srcLayer === comp) {
        continue;
      }
      var name = layers[i];
      try { name = api.getNiceName(layers[i]); } catch (e3) {}
      var srcName = srcLayer;
      try { srcName = api.getNiceName(srcLayer); } catch (e4) {}
      out.push(name + "." + attrs[a] + " \u2190 " + srcName + (dot === -1 ? "" : src.substr(dot)));
    }
  }
  return out;
}

// Recreates a rig in the active composition. Returns the new root id.
function recallRig(rigId) {
  var rig = readRig(rigId);
  if (!rig || !rig.data) {
    logStatus("Rig file not found: " + rigFilePath(rigId));
    return null;
  }
  var selection = api.getSelection() || [];
  var anchor = selection.length === 1 ? selection[0] : null;
  var comp = api.getActiveComp();
  var data = String(rig.data).split(RIG_COMP_TOKEN).join(comp || "");
  var opts = rig.options || {};
  if (opts.expressions === false) {
    data = stripExpressions(data);
  }
  if (opts.labels === false) {
    data = stripLabels(data);
  }

  var before = {};
  var existing = api.getAllSceneLayers() || [];
  for (var i = 0; i < existing.length; i++) {
    before[existing[i]] = true;
  }
  api.deserialise(data);
  var created = [];
  var all = api.getAllSceneLayers() || [];
  for (var j = 0; j < all.length; j++) {
    if (!before[all[j]]) {
      created.push(all[j]);
    }
  }
  if (!created.length) {
    logStatus("Rig \"" + rig.name + "\" could not be recreated.");
    return null;
  }
  var isNew = {};
  for (var c = 0; c < created.length; c++) {
    isNew[created[c]] = true;
  }
  // Root: the new layer of the saved type whose parent is not new.
  var root = null;
  for (var r = 0; r < created.length && !root; r++) {
    var parent = "";
    try { parent = api.getParent(created[r]); } catch (e1) {}
    if (api.getLayerType(created[r]) === rig.rootType && !isNew[parent]) {
      root = created[r];
    }
  }
  root = root || created[0];

  var removed = {};
  function remove(id) {
    if (removed[id] || id === root) {
      return;
    }
    removed[id] = true;
    try { api.deleteLayer(id); } catch (e2) {}
  }
  if (opts.children === false) {
    var desc = descendantsOf(root);
    for (var d = 0; d < desc.length; d++) {
      if (hasSuperType(desc[d], "shape") || hasSuperType(desc[d], "drawable")) {
        remove(desc[d]);
      }
    }
  }
  if (opts.connected === false) {
    for (var k = 0; k < created.length; k++) {
      if (!removed[created[k]] && (hasSuperType(created[k], "behaviourBase") || hasSuperType(created[k], "indexableArray"))) {
        remove(created[k]);
      }
    }
  }
  var kept = [];
  for (var q = 0; q < created.length; q++) {
    if (!removed[created[q]]) {
      kept.push(created[q]);
    }
  }
  if (opts.keyframes === false) {
    for (var l = 0; l < kept.length; l++) {
      {
        var animated = [];
        try { animated = api.getAnimatedAttributes(kept[l]) || []; } catch (e5) {}
        for (var b = 0; b < animated.length; b++) {
          if (animated[b] === "on") {
            continue; // in / out points of the layer
          }
          var times = [];
          try { times = api.getKeyframeTimes(kept[l], animated[b]) || []; } catch (e6) {}
          for (var t = 0; t < times.length; t++) {
            try { api.deleteKeyframe(kept[l], animated[b], times[t]); } catch (e7) {}
          }
        }
      }
    }
  }
  // Cavalry adds " 1", " 2"… to the copy: give back the saved name.
  if (rig.rootName) {
    try { api.rename(root, rig.rootName); } catch (e9) {}
  }
  // Placement: just under the selected layer, otherwise on top.
  if (anchor && !isNew[anchor]) {
    try { api.reorder(root, anchor); } catch (e8) {}
  }
  api.select([root]);
  logStatus("Rig \"" + rig.name + "\" recalled (" + kept.length + " layers).");
  // Links to layers that are not part of the rig: fine in the scene the
  // rig was saved from, suspicious in another one.
  var outside = externalInputs(kept, isNew, comp);
  if (outside.length) {
    var otherScene = !rig.scene || rig.scene !== sceneFilePath();
    logStatus("Rig \"" + rig.name + "\": " + outside.length + " input(s) from layers outside the rig" +
      (otherScene ? " (saved in another scene: check them)" : "") + ": " + outside.join(", "));
  }
  return root;
}

// "New Rig…" window
var rigDialog = null;
var rigNameField = null;
var rigDescField = null;
var rigChecks = null;
var rigSourceLabel = null;
var rigTargetId = null;
var rigLayerId = null;

// Checkbox + label on one line (a minimum width keeps the label from
// wrapping).
function rigCheckRow(check, label) {
  var text = new ui.Label(label);
  text.setMinimumWidth(300);
  var row = new ui.HLayout();
  row.add(check, text);
  return row;
}

function openNewRigDialog(targetId) {
  var sel = api.getSelection() || [];
  if (sel.length !== 1) {
    showMessage("Please select a layer");
    return;
  }
  rigTargetId = typeof targetId === "string" ? targetId : currentBar.id;
  rigLayerId = sel[0];
  if (!rigDialog) {
    rigNameField = new ui.LineEdit();
    rigNameField.setPlaceholder("Rig name (shown in its tooltip)");
    rigDescField = new ui.MultiLineEdit();
    rigDescField.setFixedHeight(64);
    try { rigDescField.setBackgroundColor(ui.getThemeColor("Base")); } catch (eBg) {}
    rigChecks = {
      children: new ui.Checkbox(true),
      connected: new ui.Checkbox(true),
      expressions: new ui.Checkbox(true),
      keyframes: new ui.Checkbox(true),
      labels: new ui.Checkbox(true)
    };
    rigSourceLabel = new ui.Label("");
    var saveBtn = new ui.Button("Save Rig");
    saveBtn.onClick = function () {
      var name = trimName(rigNameField.getText());
      if (!name) {
        showMessage("Give the rig a name");
        return;
      }
      var options = {
        children: rigChecks.children.getValue(),
        connected: rigChecks.connected.getValue(),
        expressions: rigChecks.expressions.getValue(),
        keyframes: rigChecks.keyframes.getValue(),
        labels: rigChecks.labels.getValue()
      };
      var description = String(rigDescField.getText() || "").replace(/^\s+|\s+$/g, "");
      var saved = null;
      try {
        saved = saveRig(rigLayerId, name, options, description);
      } catch (e) {
        showMessage("Could not save the rig");
        logStatus("Could not save the rig: " + e);
        return;
      }
      mutateBarShortcuts(rigTargetId, function (l) {
        l.push({ kind: "rig", rig: saved.id, rootType: saved.rootType, label: name, description: description, uid: makeUid("rig_" + saved.id) });
      });
      logStatus("Rig saved: " + name + " (" + rigFilePath(saved.id) + ")");
      rigDialog.close();
    };
    var cancelBtn = new ui.Button("Cancel");
    cancelBtn.onClick = function () {
      rigDialog.close();
    };
    var buttons = new ui.HLayout();
    buttons.addStretch();
    buttons.add(cancelBtn, saveBtn);

    var layout = new ui.VLayout();
    layout.setMargins(10, 10, 10, 10);
    layout.add(sectionTitle("New Rig"));
    layout.add(rigSourceLabel);
    layout.addSpacing(4);
    layout.add(new ui.Label("Rig name"));
    layout.add(rigNameField);
    layout.addSpacing(4);
    layout.add(new ui.Label("Rig description"));
    layout.add(rigDescField);
    layout.addSpacing(6);
    layout.add(rigCheckRow(rigChecks.children, "Include child layers"));
    layout.add(rigCheckRow(rigChecks.connected, "Include connected layers"));
    layout.add(rigCheckRow(rigChecks.expressions, "Include expressions"));
    layout.add(rigCheckRow(rigChecks.keyframes, "Include keyframes"));
    layout.add(rigCheckRow(rigChecks.labels, "Include labels"));
    layout.addStretch();
    layout.add(buttons);

    rigDialog = new ui.Container();
    rigDialog.setMinimumWidth(440);
    rigDialog.setMinimumHeight(330);
    rigDialog.setLayout(layout);
  }
  var layerName = api.getNiceName(rigLayerId);
  rigSourceLabel.setText("From layer: " + layerName);
  rigNameField.setText(layerName);
  rigDescField.setText("");
  for (var k in rigChecks) {
    rigChecks[k].setValue(true);
  }
  showOnTop(rigDialog);
}

// Spacer: an empty gap between shortcuts, to group them visually.
function addSpacer(targetId) {
  var id = targetId || currentBar.id;
  mutateBarShortcuts(id, function (l) {
    l.push({ kind: "spacer", label: "Spacer", uid: makeUid("spacer") });
  });
  logStatus("Spacer added.");
}

// ============================================================
// Favourites ("+" > Add Selected Layer): a scene layer with its settings
// ============================================================

var FAVORITE_SKIP_ATTRS = ["id", "position", "hidden", "frozen"];
var FAVORITE_SKIP_TYPES = ["nodeId", "list", "dynamic", "polyMesh"];

function isJsonValue(v) {
  if (v === null || v === undefined) {
    return false;
  }
  var t = typeof v;
  return t === "number" || t === "string" || t === "boolean" || t === "object";
}

function captureLayerPreset(layerId) {
  var preset = { generators: {}, fill: null, stroke: null, values: {} };
  var gens = [];
  try { gens = api.getGenerators(layerId) || []; } catch (e) { gens = []; }
  for (var g = 0; g < gens.length; g++) {
    if (gens[g] === "material" || gens[g] === "stroke") {
      continue;
    }
    try {
      var genType = api.getCurrentGeneratorType(layerId, gens[g]);
      if (genType) {
        preset.generators[gens[g]] = genType;
      }
    } catch (e2) {}
  }
  try { preset.fill = api.hasFill(layerId); } catch (e3) {}
  try { preset.stroke = api.hasStroke(layerId); } catch (e4) {}

  var attrs = api.getAttributes(layerId) || [];
  for (var i = 0; i < attrs.length; i++) {
    var a = attrs[i];
    if (FAVORITE_SKIP_ATTRS.indexOf(a) !== -1) {
      continue;
    }
    var def = null;
    try { def = api.getAttributeDefinition(layerId, a); } catch (e5) {}
    if (def && FAVORITE_SKIP_TYPES.indexOf(def.type) !== -1) {
      continue;
    }
    var inConn = "";
    try { inConn = api.getInConnection(layerId, a); } catch (e6) {}
    if (inConn) {
      continue;
    }
    var v;
    try { v = api.get(layerId, a); } catch (e7) { continue; }
    if (isJsonValue(v)) {
      preset.values[a] = v;
    }
  }
  if (/javascript|jsmath/i.test(api.getLayerType(layerId))) {
    try {
      var expr = api.get(layerId, "expression");
      if (typeof expr === "string" && expr.length) {
        preset.values["expression"] = expr;
      }
    } catch (e8) {}
  }
  return preset;
}

// Serialised copy of one layer (comp id replaced by a token, as rigs do).
function captureSnapshot(layerId) {
  try {
    var data = api.serialise([layerId], true);
    var comp = api.getActiveComp();
    if (comp) {
      data = data.replace(new RegExp(escapeRegExp(comp) + "(?=[.\"])", "g"), RIG_COMP_TOKEN);
    }
    return data;
  } catch (e) {
    logStatus("Snapshot not saved (" + e + "): only the settings are kept.");
    return null;
  }
}

// Recreates a snapshot in the active composition and returns the new
// node. Only the node itself is kept (other layers serialised with it
// are removed, its sub-nodes stay), and inputs that come from outside
// it are disconnected: in
// another scene the same layer id can be an unrelated layer. Links
// between its own attributes stay.
function restoreSnapshot(snapshot, type) {
  var comp = api.getActiveComp();
  var data = String(snapshot).split(RIG_COMP_TOKEN).join(comp || "");
  var before = {};
  var existing = api.getAllSceneLayers() || [];
  for (var i = 0; i < existing.length; i++) {
    before[existing[i]] = true;
  }
  try { api.deserialise(data); } catch (e) {
    return null;
  }
  var created = [];
  var all = api.getAllSceneLayers() || [];
  for (var j = 0; j < all.length; j++) {
    if (!before[all[j]]) {
      created.push(all[j]);
    }
  }
  // Root: a new layer of the saved type whose parent is not new (a
  // child of the same type, e.g. a group in a group, is not the root).
  var isNew = {};
  for (var n = 0; n < created.length; n++) {
    isNew[created[n]] = true;
  }
  var root = null;
  for (var r = 0; r < created.length && !root; r++) {
    var parent = "";
    try { parent = api.getParent(created[r]); } catch (eP) {}
    if (api.getLayerType(created[r]) === type && !isNew[parent]) {
      root = created[r];
    }
  }
  if (!root) {
    for (var d0 = 0; d0 < created.length; d0++) {
      try { api.deleteLayer(created[d0]); } catch (eDel0) {}
    }
    return null;
  }
  // Other layers serialised with it (children, connected behaviours and
  // arrays) are removed. Its own hidden sub-nodes (Fill, Stroke,
  // generator…) are kept: deleting them would strip the node.
  for (var c = 0; c < created.length; c++) {
    var other = created[c];
    if (other !== root && (hasSuperType(other, "shape") || hasSuperType(other, "drawable") ||
        hasSuperType(other, "behaviourBase") || hasSuperType(other, "indexableArray"))) {
      try { api.deleteLayer(other); } catch (eDel) {}
    }
  }
  var attrs = [];
  try { attrs = api.getInConnectedAttributes(root) || []; } catch (e2) {}
  for (var a = 0; a < attrs.length; a++) {
    var src = "";
    try { src = String(api.getInConnection(root, attrs[a]) || ""); } catch (e3) {}
    var dot = src.indexOf(".");
    var srcLayer = dot === -1 ? src : src.substr(0, dot);
    if (src && srcLayer !== root && dot !== -1) {
      try { api.disconnect(srcLayer, src.substr(dot + 1), root, attrs[a]); } catch (e4) {}
    }
  }
  try { api.parent(root, comp); } catch (e5) {}
  return root;
}

function addFavoriteFromSelection(targetId) {
  var sel = api.getSelection();
  if (sel.length !== 1) {
    logStatus("Select a single layer (in the Scene Window or the timeline) to add it as a favourite.");
    return;
  }
  var layerId = sel[0];
  var type = api.getLayerType(layerId);
  var name = api.getNiceName(layerId);
  var preset = captureLayerPreset(layerId);
  // Snapshot of the node as Cavalry saves it: values, expressions,
  // keyframes and the connections between its own attributes (e.g. an
  // Oscillator's Minimum driven by its Maximum with value*-1).
  var snapshot = captureSnapshot(layerId);
  if (snapshot) {
    preset.snapshot = snapshot;
  }
  mutateBarShortcuts(typeof targetId === "string" ? targetId : currentBar.id, function (l) {
    l.push({ type: type, label: name, preset: preset, uid: makeUid("fav_" + type) });
  });
  logStatus("Favourite added: " + name + " (" + type + ", " + Object.keys(preset.values).length + " settings)");
}

function createFromFavorite(shortcut, forcedTarget) {
  var p = shortcut.preset || {};
  var attrTarget = forcedTarget || getSelectedAttributeTarget();
  if (!forcedTarget && askDimension(shortcut, attrTarget, shortcut.type)) {
    return;
  }
  if (p.snapshot) {
    var restored = restoreSnapshot(p.snapshot, shortcut.type);
    if (restored) {
      try { api.rename(restored, shortcut.label); } catch (eName) {}
      logStatus("Favourite created: " + api.getNiceName(restored));
      linkToSelectedAttribute(restored, attrTarget, shortcut.label, true);
      api.select([restored]);
      return;
    }
    logStatus("Favourite snapshot could not be restored: created from its saved settings instead.");
  }
  var nodeId;
  try {
    nodeId = api.create(shortcut.type, shortcut.label);
  } catch (e) {
    logStatus("Could not create favourite '" + shortcut.label + "': " + e);
    return;
  }
  var gens = p.generators || {};
  for (var g in gens) {
    try { api.setGenerator(nodeId, g, gens[g]); } catch (e1) {
      logStatus("Generator " + g + " (" + gens[g] + ") not applied: " + e1);
    }
  }
  if (p.fill !== null && p.fill !== undefined) {
    try { api.setFill(nodeId, p.fill); } catch (e2) {}
  }
  if (p.stroke !== null && p.stroke !== undefined) {
    try { api.setStroke(nodeId, p.stroke); } catch (e3) {}
  }
  var values = p.values || {};
  var failed = [];
  for (var a in values) {
    var obj = {};
    obj[a] = values[a];
    try { api.set(nodeId, obj); } catch (e4) { failed.push(a); }
  }
  if (failed.length) {
    logStatus("Favourite created, but " + failed.length + " setting(s) not applied: " + failed.join(", "));
  } else {
    logStatus("Favourite created: " + api.getNiceName(nodeId));
  }
  linkToSelectedAttribute(nodeId, attrTarget, shortcut.label, true);
  api.select([nodeId]);
}

// ============================================================
// Pages (1 to 4)
// ============================================================
// Every shortcut belongs to one page ("page" in the bar's JSON, 1 when
// missing). The bar shows one page at a time; it opens on page 1. New
// shortcuts go to the page shown on the bar.

var PAGE_COUNT = 4;
var currentPage = 1;

function pageOf(s) {
  var p = parseInt(s && s.page, 10);
  return p >= 1 && p <= PAGE_COUNT ? p : 1;
}

function setCurrentPage(p) {
  if (p === currentPage) {
    return;
  }
  currentPage = p;
  refillBars();
}

function uidSet(list) {
  var set = {};
  for (var i = 0; i < (list || []).length; i++) {
    set[list[i].uid] = true;
  }
  return set;
}

// Shortcuts added by a change (uid not there before) and without a page
// get the given page.
function stampNewShortcuts(before, list, page) {
  for (var i = 0; i < (list || []).length; i++) {
    if (!before[list[i].uid] && !list[i].page) {
      list[i].page = page;
    }
  }
}

function visibleShortcuts() {
  var out = [];
  for (var i = 0; i < nodeShortcuts.length; i++) {
    if (pageOf(nodeShortcuts[i]) === currentPage) {
      out.push(nodeShortcuts[i]);
    }
  }
  return out;
}

// Node family, guessed from the type: Alt + click (attribute picker)
// is not offered on shapes and filters.
function guessCategory(type, displayName) {
  var t = (String(type || "") + " " + String(displayName || "")).toLowerCase();
  if (/filter|blur|glow|grain|chroma ?key|bloom|mosaik|kaleido|kolorama|riso|ps1|outliner|choker|threshold|light ?sweep|levels|hue|tint|posteri|sharpen|dither|halftone|vignette|shadow/.test(t)) {
    return "effect";
  }
  if (/deformer|bend|bevel|distort|explode|extrude|warp|inflate|pinch|round|smooth|spheri|squash|taper|twist|wave|wiggle|resample|subdivide|offset path|pathfinder|jitter|magnet|melt|ripple|bulge|pucker|bloat|trim/.test(t)) {
    return "deformer";
  }
  if (/shape|group|duplicator|text|connect|editable|image|footage|svg|polygon|rectangle|ellipse|star|spiral|arc|line|grid|cube|sphere|particle|trail|bounding|outline|null|comp/.test(t)) {
    return "shape";
  }
  return "utility";
}

function getShortcutCategory(s) {
  if (s.kind === "spacer" || s.kind === "expression" || s.kind === "rig" || s.kind === "script" || s.kind === "keys") {
    return s.kind;
  }
  return guessCategory(s.type || s.nodeName, s.label);
}

// ============================================================
// Bar widgets
// ============================================================

function scriptInitials(name) {
  var words = String(name).replace(/[_\-.]+/g, " ").split(/\s+/).filter(function (w) { return w.length; });
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return String(name).substr(0, 2).toUpperCase();
}

function createScriptTile(shortcut) {
  var size = 26;
  var d = new ui.Draw();
  d.setSize(size, size);
  try { d.setBackgroundColor(ui.getThemeColor("Window")); } catch (e) {}
  var bg = new cavalry.Path();
  bg.addRect(2, 2, size - 2, size - 2); // addRect(fromX, fromY, toX, toY)
  d.addPath(bg.toObject(), { color: "#5b4a8f" });
  var txt = new cavalry.Path();
  txt.addText(scriptInitials(shortcut.label), 10, 0, 0);
  var bb = txt.boundingBox();
  txt.translate(size / 2 - bb.centre.x, size / 2 - bb.centre.y);
  d.addPath(txt.toObject(), { color: "#ffffff" });
  d.setToolTip("Script: " + shortcut.label);
  d.onMousePress = function (position, button) {
    if (button === "left") {
      createNode(shortcut);
    } else if (button === "right") {
      showBarMenu();
    }
  };
  return d;
}

// Paths of the π glyph in a size × size square (no background). ui.Draw is y-up
// (origin at the bottom left), so the bar is near the top (high y).
function addExpressionGlyph(d, size) {
  var k = size / 26;
  var glyph = "#cfcfcf";
  var w = 1.8 * k;
  var top = 16.5 * k;
  var bar = new cavalry.Path();
  bar.moveTo(8 * k, top);
  bar.lineTo(18 * k, top);
  d.addPath(bar.toObject(), { color: glyph, stroke: true, strokeWidth: w });
  var left = new cavalry.Path();
  left.moveTo(11 * k, top);
  left.lineTo(11 * k, 8.5 * k);
  d.addPath(left.toObject(), { color: glyph, stroke: true, strokeWidth: w });
  var right = new cavalry.Path();
  right.moveTo(15.2 * k, top);
  right.lineTo(15.2 * k, 10.4 * k);
  right.cubicTo(15.2 * k, 9 * k, 16 * k, 8.4 * k, 17.6 * k, 8.6 * k);
  d.addPath(right.toObject(), { color: glyph, stroke: true, strokeWidth: w });
}

// Click: apply to the selected attribute(s). Alt + click: pick the
// attribute of the selected layer.
var MSG_SELECT_LAYER = "Please select a layer";
var MSG_SELECT_ATTRIBUTE = "Please select an attribute";

function runExpressionShortcut(shortcut, alt) {
  var sel = api.getSelection() || [];
  if (alt) {
    if (!sel.length) {
      showMessage(MSG_SELECT_LAYER);
      return;
    }
    if (showAttributeMenu(shortcut)) {
      return;
    }
  }
  var targets = getSelectedAttributeTargets();
  if (targets.length) {
    applyExpression(shortcut.expression, targets, shortcut.label);
    return;
  }
  showMessage(sel.length ? MSG_SELECT_ATTRIBUTE : MSG_SELECT_LAYER);
}

function createExpressionTile(shortcut, tip) {
  var size = 26;
  var d = new ui.Draw();
  d.setSize(size, size);
  try { d.setBackgroundColor(ui.getThemeColor("Window")); } catch (e) {}
  addExpressionGlyph(d, size);
  d.setToolTip(tip);
  d.onMousePress = function (position, button) {
    if (button === "right") {
      showBarMenu();
      return;
    }
    if (button !== "left") {
      return;
    }
    var alt = false;
    try { alt = api.isAltHeld(); } catch (e3) {}
    runExpressionShortcut(shortcut, alt);
  };
  return d;
}

// ------------------------------------------------------------
// "Shortcut as Button" (kind "keys")
// ------------------------------------------------------------
// A "keys" button plays a key combination ("alt+w", "alt+shift+w",
// "cmd+d"…) as if it was typed: Cavalry has no API to run its menu
// commands, so the keys are sent by the system (macOS: System Events,
// which needs Cavalry in System Settings > Privacy & Security >
// Accessibility; Windows: SendKeys). The keys go where the focus is,
// exactly like the keyboard.
var KEY_MODS = {
  cmd: "cmd", command: "cmd", "⌘": "cmd", meta: "cmd", win: "cmd",
  ctrl: "ctrl", control: "ctrl", "⌃": "ctrl",
  alt: "alt", option: "alt", opt: "alt", "⌥": "alt",
  shift: "shift", "⇧": "shift"
};
// macOS key codes of the keys that are not plain characters.
var MAC_KEY_CODES = {
  "return": 36, enter: 76, tab: 48, space: 49, "delete": 51, backspace: 51, del: 117, forwarddelete: 117,
  escape: 53, esc: 53, left: 123, right: 124, down: 125, up: 126, home: 115, end: 119, pageup: 116, pagedown: 121,
  f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97, f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111,
  f13: 105, f14: 107, f15: 113, f16: 106, f17: 64, f18: 79, f19: 80
};
var WIN_KEY_NAMES = {
  "return": "{ENTER}", enter: "{ENTER}", tab: "{TAB}", space: " ", "delete": "{BACKSPACE}", backspace: "{BACKSPACE}",
  del: "{DELETE}", forwarddelete: "{DELETE}", escape: "{ESC}", esc: "{ESC}", left: "{LEFT}", right: "{RIGHT}",
  down: "{DOWN}", up: "{UP}", home: "{HOME}", end: "{END}", pageup: "{PGUP}", pagedown: "{PGDN}"
};

// "alt+shift+w" -> { mods: ["alt", "shift"], key: "w" } (null if invalid).
function parseKeys(str) {
  var parts = String(str || "").replace(/\s+/g, "").toLowerCase().split("+");
  var mods = [];
  var key = null;
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (!p && i === parts.length - 1 && parts.length > 1) { // "cmd++"
      key = "+";
      continue;
    }
    if (!p) {
      continue;
    }
    if (KEY_MODS[p]) {
      if (mods.indexOf(KEY_MODS[p]) === -1) {
        mods.push(KEY_MODS[p]);
      }
    } else {
      key = p;
    }
  }
  if (!key) {
    return null;
  }
  if (key.length > 1 && MAC_KEY_CODES[key] === undefined) {
    return null;
  }
  return { mods: mods, key: key };
}

// Readable form: macOS symbols ("⌥⇧W"), "Ctrl+Alt+W" elsewhere.
function prettyKeys(str) {
  var k = parseKeys(str);
  if (!k) {
    return String(str || "");
  }
  var order = ["ctrl", "alt", "shift", "cmd"];
  var macNames = { ctrl: "⌃", alt: "⌥", shift: "⇧", cmd: "⌘" };
  var winNames = { ctrl: "Win", alt: "Alt", shift: "Shift", cmd: "Ctrl" }; // Cavalry's Ctrl is ⌘ on macOS
  var key = k.key.length === 1 ? k.key.toUpperCase() : k.key.charAt(0).toUpperCase() + k.key.substr(1);
  var out = [];
  for (var i = 0; i < order.length; i++) {
    if (k.mods.indexOf(order[i]) !== -1) {
      out.push(IS_MAC ? macNames[order[i]] : winNames[order[i]]);
    }
  }
  return IS_MAC ? out.join("") + key : out.concat([key]).join("+");
}

// Short text for the tile: "A W", "AS W", "C D"…
function keysTileText(str) {
  var k = parseKeys(str);
  if (!k) {
    return "?";
  }
  var m = "";
  if (k.mods.indexOf("ctrl") !== -1) { m += "^"; }
  if (k.mods.indexOf("alt") !== -1) { m += "A"; }
  if (k.mods.indexOf("shift") !== -1) { m += "S"; }
  if (k.mods.indexOf("cmd") !== -1) { m += "C"; }
  var key = k.key.length === 1 ? k.key.toUpperCase() : k.key.substr(0, 3).toUpperCase();
  return m ? m + " " + key : key;
}

var KEYS_LOG = (function () {
  try {
    return String(api.getTempFolder()).replace(/[\/\\]+$/, "") + "/cbar_keys.log";
  } catch (e) {
    return "/tmp/cbar_keys.log";
  }
})();

function shQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

// Reads the log of the last key sending a moment later: shows the
// reason when macOS refused it (usually the Accessibility permission).
var keysLogTimer = null;
function checkKeysLogSoon() {
  try {
    if (!keysLogTimer) {
      keysLogTimer = new api.Timer({
        onTimeout: function () {
          var txt = "";
          try { txt = api.filePathExists(KEYS_LOG) ? String(api.readFromFile(KEYS_LOG) || "") : ""; } catch (e) {}
          if (!txt.replace(/\s+/g, "")) {
            return;
          }
          if (/1002|not allowed|n.est pas autoris|assistive|accessibilit/i.test(txt)) {
            showMessage("macOS refused to send the keys.\nAdd Cavalry in System Settings > Privacy & Security > Accessibility (switch it on), then restart Cavalry.\n\n" + txt);
          } else {
            showMessage("The keys could not be sent:\n" + txt);
          }
        }
      });
      keysLogTimer.setRepeating(false);
    }
    keysLogTimer.setInterval(1500);
    keysLogTimer.start();
  } catch (e) {}
}

function sendKeys(shortcut) {
  var k = parseKeys(shortcut.keys);
  if (!k) {
    showMessage("Invalid shortcut: \"" + shortcut.keys + "\".\nExamples: alt+w, alt+shift+w, cmd+d, ctrl+shift+left");
    return;
  }
  try {
    if (IS_MAC) {
      var names = { cmd: "command down", ctrl: "control down", alt: "option down", shift: "shift down" };
      var using = [];
      for (var i = 0; i < k.mods.length; i++) {
        using.push(names[k.mods[i]]);
      }
      var press = MAC_KEY_CODES[k.key] !== undefined ? "key code " + MAC_KEY_CODES[k.key] :
        "keystroke \"" + k.key.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\"";
      if (using.length) {
        press += " using {" + using.join(", ") + "}";
      }
      // The keys must reach Cavalry's main window, not the floating bar
      // that was just clicked: the biggest window of Cavalry is raised
      // first. Errors are written to a log that is read a moment later.
      var script = [
        "delay 0.1",
        "tell application \"System Events\"",
        "  set p to first application process whose frontmost is true",
        "  set best to missing value",
        "  set bestArea to 0",
        "  repeat with w in (windows of p)",
        "    try",
        "      set s to size of w",
        "      set a to (item 1 of s) * (item 2 of s)",
        "      if a > bestArea then",
        "        set bestArea to a",
        "        set best to w",
        "      end if",
        "    end try",
        "  end repeat",
        "  if best is not missing value then perform action \"AXRaise\" of best",
        "  delay 0.05",
        "  " + press,
        "end tell"
      ].join("\n");
      try { api.writeToFile(KEYS_LOG, "", true); } catch (eW) {}
      var cmd = "/usr/bin/osascript -e " + shQuote(script) + " > /dev/null 2> " + shQuote(KEYS_LOG);
      api.runDetachedProcess("/bin/sh", ["-c", cmd]);
      checkKeysLogSoon();
    } else {
      var winMods = { cmd: "^", alt: "%", shift: "+" }; // cmd = Ctrl on Windows
      var pre = "";
      for (var j = 0; j < k.mods.length; j++) {
        if (winMods[k.mods[j]]) {
          pre += winMods[k.mods[j]];
        }
      }
      var key = WIN_KEY_NAMES[k.key] || (/^f([1-9]|1[0-6])$/.test(k.key) ? "{" + k.key.toUpperCase() + "}" :
        (/[+^%~(){}\[\]]/.test(k.key) ? "{" + k.key + "}" : k.key));
      var ps = "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 80; " +
        "[System.Windows.Forms.SendKeys]::SendWait('" + (pre + key).replace(/'/g, "''") + "')";
      api.runDetachedProcess("powershell", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", ps]);
    }
    logStatus("Keys sent: " + prettyKeys(shortcut.keys) + (shortcut.label ? " (" + shortcut.label + ")" : ""));
  } catch (e) {
    logStatus("Could not send the keys " + shortcut.keys + ": " + e);
  }
}

function keysTooltip(shortcut) {
  return "Cavalry shortcut: " + shortcut.label + "\n" + prettyKeys(shortcut.keys) +
    "\nClick: plays the keys (they go where the focus is, like the keyboard)";
}

function createKeysTile(shortcut) {
  var size = 26;
  var d = new ui.Draw();
  d.setSize(size, size);
  try { d.setBackgroundColor(ui.getThemeColor("Window")); } catch (e) {}
  var bg = new cavalry.Path();
  bg.addRect(2, 2, size - 2, size - 2); // addRect(fromX, fromY, toX, toY)
  d.addPath(bg.toObject(), { color: "#2f6a7a" });
  var txt = new cavalry.Path();
  txt.addText(keysTileText(shortcut.keys), 8, 0, 0);
  var bb = txt.boundingBox();
  if (bb.width > size - 6) {
    var sc = (size - 6) / bb.width;
    txt.scale(sc, sc);
    bb = txt.boundingBox();
  }
  txt.translate(size / 2 - bb.centre.x, size / 2 - bb.centre.y);
  d.addPath(txt.toObject(), { color: "#ffffff" });
  d.setToolTip(keysTooltip(shortcut));
  d.onMousePress = function (position, button) {
    if (button === "left") {
      sendKeys(shortcut);
    } else if (button === "right") {
      showBarMenu();
    }
  };
  return d;
}

// ------------------------------------------------------------
// Cavalry's shortcuts (list of the "Shortcut as Button" window)
// ------------------------------------------------------------
// Default keys of Cavalry 2.x, from its Shortcut Manager and its docs
// (scripts cannot read them). Keys as typed in the window: cmd is Cavalry's
// "Ctrl" (⌘ on macOS, Ctrl on Windows), ctrl is ⌃ on macOS.
var CAVALRY_SHORTCUTS = [
  ["Add Null", "cmd+shift+="], ["Add Time Marker", "cmd+*"],
  ["Arrange > Bring Forward", "cmd+]"], ["Arrange > Bring to Front", "cmd+shift+]"],
  ["Arrange > Send Backward", "cmd+["], ["Arrange > Send to Back", "cmd+shift+["],
  ["Attribute Editor", "alt+a"], ["Background", "cmd+y"], ["Bake Selected Shape", "cmd+shift+b"],
  ["Camera", "cmd+m"], ["Camera Tool", "c"], ["Clear Quicklist", "alt+shift+w"],
  ["Close Composition", "cmd+w"], ["Close Other Compositions", "alt+cmd+w"], ["Color Window", "alt+c"],
  ["Command Search", "/"], ["Command Search (Quick Actions Only)", "alt+/"],
  ["Composition Settings…", "cmd+k"], ["Control Centre", "alt+e"],
  ["Duplicate", "cmd+d"], ["Duplicate (Options)…", "cmd+shift+d"], ["Duplicate and Split", "ctrl+d"],
  ["Edit Shape Tool", "a"], ["Export Lottie…", "alt+cmd+l"],
  ["Go to Composition End", "cmd+end"], ["Go to Composition Start", "cmd+home"],
  ["Go to Next Keyframe", "alt+cmd+right"], ["Go to Next Time Marker", ">"],
  ["Go to Playback End", "end"], ["Go to Playback Start", "home"],
  ["Go to Previous Keyframe", "alt+cmd+left"], ["Go to Previous Time Marker", "<"],
  ["Graph Editor", "alt+l"], ["Group", "cmd+g"], ["Group and Flatten", "alt+cmd+g"],
  ["Import Assets…", "cmd+i"], ["Import Scene…", "alt+cmd+i"], ["JavaScript Editor", "alt+f"],
  ["Jump Backward", "cmd+shift+left"], ["Jump Forward", "cmd+shift+right"],
  ["Magic Easing > Slow In, Slow Out", "shift+1"], ["Magic Easing > Very Slow In, Very Slow Out", "shift+2"],
  ["Magic Easing > Spring Out", "shift+3"], ["Magic Easing > Bounce Out", "shift+4"],
  ["Magic Easing > None", "shift+5"],
  ["Make Editable", "cmd+e"], ["Make Editable Copy", "cmd+shift+e"], ["Mesh Tool", "m"],
  ["Move Backward 1 Frame", "cmd+left"], ["Move Forward 1 Frame", "cmd+right"],
  ["New Composition", "cmd+shift+n"], ["Nudge Keyframes Backward", "-"], ["Nudge Keyframes Forward", "="],
  ["Parent", "cmd+p"], ["Pen Tool", "p"], ["Pencil Tool", "l"], ["Pivot Tool", "y"], ["Play / Stop", "space"],
  ["Pre-Compose Based on Selection Bounds", "alt+shift+c"], ["Project Settings…", "alt+p"],
  ["Quick Add", "cmd+."], ["Redo", "cmd+shift+z"],
  ["Render Current Frame…", "cmd+shift+r"], ["Render Manager", "alt+b"],
  ["Scene Window (Time Editor)", "alt+k"], ["Select Tool", "v"],
  ["Set Composition to Playback Range", "alt+r"], ["Set Playback End to Current Frame", "n"],
  ["Set Playback Range to Selection", "alt+s"], ["Set Playback Start to Current Frame", "b"],
  ["Set Transform Keyframes > All", "k"], ["Set Transform Keyframes > Position", "shift+t"],
  ["Set Transform Keyframes > Rotation", "shift+r"], ["Set Transform Keyframes > Scale", "shift+s"],
  ["Show 2D Grid", "alt+g"], ["Show Guides", "cmd+;"], ["Show in Attribute Editor", "cmd+shift+u"],
  ["Show in Scene Window", "cmd+l"], ["Show Pixel Grid", "alt+i"], ["Show Rulers", "cmd+r"],
  ["Show/Hide Animation", "cmd+shift+h"], ["Show/Hide Selected", "cmd+shift+v"], ["Snapping", "cmd+u"],
  ["Solo Selection in Viewport", "alt+w"], ["Stroke Width Tool", "w"], ["Text Tool", "t"],
  ["Toggle Background Alpha", "alt+cmd+b"], ["Un-Group", "cmd+shift+g"], ["Un-Parent", "cmd+shift+p"],
  ["Undo", "cmd+z"], ["Zoom In", "cmd+="], ["Zoom Out", "cmd+-"]
];
// Commands without a default key: listed once given a key in the Shortcut
// Manager (Cavalry's shortcuts.json, by action name).
var CAVALRY_ACTIONS = {
  enableTimeRemappingAction: "Enable Time Remapping",
  mlspAction: "Move Layer Start to Current Frame",
  mlepAction: "Move Layer End to Current Frame",
  slipAction: "Set Layer In Point to Current Frame",
  slopAction: "Set Layer Out Point to Current Frame",
  toggleTimeGraphEditor: "Toggle Time/Graph Editor"
};

// "Ctrl+Alt+H" (Cavalry's shortcuts.json) -> "cmd+alt+h".
function keysFromCavalry(str) {
  var names = { ctrl: "cmd", meta: "ctrl", alt: "alt", shift: "shift" };
  var parts = String(str || "").split("+");
  var out = [];
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].toLowerCase();
    out.push(i < parts.length - 1 && names[p] ? names[p] : p);
  }
  return out.join("+");
}

// Cavalry's shortcuts.json (the keys changed in the Shortcut Manager), or null.
function cavalryShortcutsFile() {
  var candidates = [];
  try { candidates.push(String(api.getPreferencesPath()).replace(/[\/\\]+$/, "") + "/shortcuts.json"); } catch (e) {}
  var home = IS_MAC ? (String(getScriptsRoot()).match(/^(\/Users\/[^\/]+)/) || [])[1] : null;
  if (home) {
    candidates.push(home + "/Library/Preferences/Cavalry/shortcuts.json");
  }
  for (var i = 0; i < candidates.length; i++) {
    try {
      if (api.filePathExists(candidates[i])) {
        return candidates[i];
      }
    } catch (e2) {}
  }
  return null;
}

// [{ label, keys }], sorted: the list above, plus the keys the user gave
// to the commands of CAVALRY_ACTIONS (read from shortcuts.json).
function cavalryShortcutList() {
  var out = [];
  for (var i = 0; i < CAVALRY_SHORTCUTS.length; i++) {
    out.push({ label: CAVALRY_SHORTCUTS[i][0], keys: CAVALRY_SHORTCUTS[i][1] });
  }
  var file = cavalryShortcutsFile();
  if (file) {
    try {
      var own = JSON.parse(api.readFromFile(file)).shortcuts || {};
      for (var a in CAVALRY_ACTIONS) {
        if (CAVALRY_ACTIONS.hasOwnProperty(a) && own[a] && parseKeys(keysFromCavalry(own[a]))) {
          out.push({ label: CAVALRY_ACTIONS[a], keys: keysFromCavalry(own[a]) });
        }
      }
    } catch (e) {}
  }
  out.sort(function (x, y) {
    return x.label.toLowerCase() < y.label.toLowerCase() ? -1 : 1;
  });
  return out;
}

// ------------------------------------------------------------
// "Shortcut as Button" window
// ------------------------------------------------------------
// The list of Cavalry's shortcuts (search, double-click to add), or any
// keys typed by hand.
var keysDialog = null;
var keysTargetId = null;
var keysEditUid = null;

// Adds (or edits, with editUid) a "Shortcut as Button".
function saveKeysButton(keys, name) {
  keys = String(keys || "").replace(/\s+/g, "").toLowerCase();
  if (!parseKeys(keys)) {
    showMessage("Choose a shortcut in the list, or type keys such as alt+w or alt+shift+w.");
    return false;
  }
  name = trimName(name) || prettyKeys(keys);
  if (keysEditUid) {
    var uidToEdit = keysEditUid;
    mutateBarShortcuts(keysTargetId, function (l) {
      var idx = indexOfUidIn(l, uidToEdit);
      if (idx !== -1) {
        l[idx].keys = keys;
        l[idx].label = name;
      }
    });
    logStatus("Shortcut as Button updated: " + name + " (" + prettyKeys(keys) + ")");
  } else {
    mutateBarShortcuts(keysTargetId, function (l) {
      l.push({ kind: "keys", keys: keys, label: name, uid: makeUid("keys_" + name) });
    });
    logStatus("Shortcut as Button added: " + name + " (" + prettyKeys(keys) + ")");
  }
  return true;
}

function openKeysDialog(targetId, editUid) {
  keysTargetId = typeof targetId === "string" ? targetId : currentBar.id;
  keysEditUid = editUid || null;
  // Rebuilt on every opening so the search field gets the keyboard focus.
  if (keysDialog) {
    try { keysDialog.close(); } catch (e0) {}
    keysDialog = null;
  }
  var shortcuts = cavalryShortcutList();
  var byUuid = {};
  var model = [];
  for (var i = 0; i < shortcuts.length; i++) {
    var uuid = "cav_" + i;
    byUuid[uuid] = shortcuts[i];
    model.push({ uuid: uuid, label: shortcuts[i].label + "    " + prettyKeys(shortcuts[i].keys),
      tooltip: shortcuts[i].label + "\n" + prettyKeys(shortcuts[i].keys) });
  }
  var list = makePickerList("No shortcuts");
  list.setSelectionMode("single");
  list.showSearchBar(false);
  list.setModel(model);

  var searchField = new ui.LineEdit();
  searchField.setPlaceholder("Search Cavalry shortcuts…");
  searchField.onValueChanged = function () {
    list.setSearchFilter(String(searchField.getText() || ""));
  };
  var keysField = new ui.LineEdit();
  keysField.setPlaceholder("Keys, e.g. alt+w   alt+shift+w   cmd+d   ctrl+shift+left");
  var nameField = new ui.LineEdit();
  nameField.setPlaceholder("Button name (shown in its tooltip)");
  var help = new ui.Label("Modifiers: cmd, ctrl, alt (option), shift. Keys: a letter, a digit, a sign,\n" +
    "or return, tab, space, delete, escape, left, right, up, down, home, end, f1-f19.");
  try { help.setTextColor("#8a8a8a"); } catch (eH) {}

  list.onSelectionChanged = function (sel) {
    var s = sel && sel.length ? byUuid[sel[0]] : null;
    if (s) {
      keysField.setText(s.keys);
      nameField.setText(s.label);
    }
  };
  list.onRowDoubleClicked = function (uuid) {
    var s = byUuid[uuid];
    if (s && saveKeysButton(s.keys, s.label)) {
      keysDialog.close();
    }
  };

  var saveBtn = new ui.Button(keysEditUid ? "Save" : "Add");
  saveBtn.onClick = function () {
    if (saveKeysButton(keysField.getText(), nameField.getText())) {
      keysDialog.close();
    }
  };
  var cancelBtn = new ui.Button("Cancel");
  cancelBtn.onClick = function () {
    keysDialog.close();
  };
  var buttons = new ui.HLayout();
  buttons.addStretch();
  buttons.add(cancelBtn, saveBtn);

  if (keysEditUid) {
    var items = getBarShortcuts(keysTargetId);
    var item = items[indexOfUidIn(items, keysEditUid)] || {};
    keysField.setText(item.keys || "");
    nameField.setText(item.label || "");
  }

  var layout = new ui.VLayout();
  layout.setMargins(8, 8, 8, 8);
  layout.add(searchField);
  layout.add(sectionTitle((keysEditUid ? "Edit Shortcut as Button: " : "Shortcut as Button: ") + barDisplayName(keysTargetId)));
  layout.add(new ui.Label("Double-click a Cavalry shortcut to add it as a button, or type the keys below."));
  layout.add(list);
  layout.add(keysField);
  layout.add(help);
  layout.add(nameField);
  layout.add(buttons);
  keysDialog = new ui.Container();
  keysDialog.setMinimumWidth(380);
  keysDialog.setMinimumHeight(560);
  keysDialog.setLayout(layout);
  showOnTop(keysDialog);
}

// ------------------------------------------------------------
// Button icons: Set Icon, Icon Colour, Remove Custom Icon
// ------------------------------------------------------------
// shortcut.icon: the button's icon, relative to C-Bar_assets/icons (an icon
// of the pack, "base/bolt_40px.png", or a copy made by C-Bar,
// "customs/Null_1730280000000.png"), or one of Cavalry's ("cavalry:nodes/null.png"). shortcut.iconBase: the image it was coloured
// from (kept so that colours never degrade); shortcut.iconColor: the colour.
// C-Bar only ever deletes the copies it made (name ending in _<13 digits>).
var ICON_PACK_DIR = ICONS_DIR + "/base";
// shortcut.icon can also be one of Cavalry's icons: "cavalry:nodes/null.png".
var CAVALRY_ICON_PREFIX = "cavalry:";

function iconPathFor(name) {
  name = String(name || "");
  if (name.indexOf(CAVALRY_ICON_PREFIX) === 0) {
    return api.getAppAssetsPath() + "/Icons/" + name.substr(CAVALRY_ICON_PREFIX.length);
  }
  var path = ICONS_DIR + "/" + name;
  // Copies made before v0.9.6 were in icons/ itself: they may have been
  // moved to icons/customs/ by hand.
  if (!/[\/\\]/.test(name) && !api.filePathExists(path) && api.filePathExists(CUSTOM_ICONS_DIR + "/" + name)) {
    return CUSTOM_ICONS_DIR + "/" + name;
  }
  return path;
}
var ICON_COLORS = ["White", "Green", "Yellow", "Blue", "Red"];
var ICON_COLOR_HEX = { White: "#FFFFFF", Green: "#4FFD7A", Yellow: "#FFD84D", Blue: "#4DA6FF", Red: "#FF5A5A" };

function isOwnIconCopy(name) {
  return !!name && /^(customs\/)?[^\/\\]+_\d{13}\.png$/.test(name);
}

// True when another button (any bar) still uses that icon file: a
// duplicated or imported bar shares the copies of the original.
function iconFileUsedElsewhere(name, barId, uid) {
  var bars = listBars();
  for (var b = 0; b < bars.length; b++) {
    var list = bars[b].id === currentBar.id ? nodeShortcuts : (bars[b].shortcuts || []);
    for (var i = 0; i < list.length; i++) {
      if (bars[b].id === barId && list[i].uid === uid) {
        continue;
      }
      if (list[i].icon === name || list[i].iconBase === name) {
        return true;
      }
    }
  }
  return false;
}

// Trashes the copies C-Bar made for the button barId / uid, except keep
// and those another button still uses.
function trashOwnIconCopies(names, keep, barId, uid) {
  for (var i = 0; i < names.length; i++) {
    if (isOwnIconCopy(names[i]) && keep.indexOf(names[i]) === -1 && !iconFileUsedElsewhere(names[i], barId, uid)) {
      moveToTrash(iconPathFor(names[i]));
    }
  }
}

// Icons of the pack: [{ name: "bolt", file: "base/bolt_40px.png" }].
function listPackIcons() {
  var out = [];
  var files = [];
  try { files = api.listDirectory(ICON_PACK_DIR) || []; } catch (e) {}
  for (var i = 0; i < files.length; i++) {
    var file = String(files[i]).split(/[\/\\]/).pop();
    var m = file.match(/^([^_].*?)(_40px)?\.png$/i);
    if (m) {
      out.push({ name: m[1], file: "base/" + file });
    }
  }
  out.sort(function (a, b) {
    return a.name < b.name ? -1 : 1;
  });
  return out;
}

// The icon pack is not brought by Settings › Update (it only replaces
// C-Bar.js): it can be downloaded from the GitHub archive of this version
// (or of main), with the system's curl and unzip / tar. Files already in
// icons/base are never replaced. Returns the number of icons added.
function downloadIconPack() {
  var tmp = String(api.getTempFolder()).replace(/[\/\\]+$/, "") + "/cbar_iconpack_" + Date.now();
  var zip = tmp + "/pack.zip";
  var winPath = function (p) { return String(p).replace(/\//g, "\\"); };
  ensureFolder(tmp);
  logStatus("Downloading the icon pack…");
  var refs = ["tags/v" + CBAR_VERSION, "heads/main"];
  var src = null;
  for (var r = 0; r < refs.length && !src; r++) {
    var url = "https://github.com/" + CBAR_REPO + "/archive/refs/" + refs[r] + ".zip";
    try {
      if (IS_MAC) {
        api.runProcess("/usr/bin/curl", ["-L", "-f", "-s", "-o", zip, url]);
        if (api.filePathExists(zip)) {
          api.runProcess("/usr/bin/unzip", ["-o", "-q", zip, "*/C_Bar/C-Bar_assets/icons/base/*", "-d", tmp]);
        }
      } else {
        api.runProcess("curl.exe", ["-L", "-f", "-s", "-o", winPath(zip), url]);
        if (api.filePathExists(zip)) {
          api.runProcess("tar", ["-xf", winPath(zip), "-C", winPath(tmp)]);
        }
      }
    } catch (e) {
      logStatus("Icon pack download (" + refs[r] + "): " + e);
    }
    // The archive holds one folder ("C-Bar-0.9.6", "C-Bar-main").
    var entries = [];
    try { entries = api.listDirectory(tmp) || []; } catch (e1) {}
    for (var i = 0; i < entries.length; i++) {
      var dir = String(entries[i]) + "/C_Bar/C-Bar_assets/icons/base";
      if (api.filePathExists(dir)) {
        src = dir;
        break;
      }
    }
  }
  var added = 0;
  if (src) {
    ensureFolder(ICON_PACK_DIR);
    var files = [];
    try { files = api.listDirectory(src) || []; } catch (e2) {}
    for (var f = 0; f < files.length; f++) {
      var name = String(files[f]).split(/[\/\\]/).pop();
      if (name && name.charAt(0) !== "." && !api.filePathExists(ICON_PACK_DIR + "/" + name)) {
        try {
          if (api.copyFilePath(String(files[f]), ICON_PACK_DIR + "/" + name)) {
            added++;
          }
        } catch (e3) {}
      }
    }
  }
  try {
    if (IS_MAC) {
      api.runProcess("/bin/rm", ["-rf", tmp]);
    } else {
      api.runProcess("cmd", ["/c", "rmdir", "/s", "/q", winPath(tmp)]);
    }
  } catch (e4) {}
  if (!src) {
    showMessage("Could not download the icon pack.\nDownload the latest release zip from GitHub and copy its folder C_Bar/C-Bar_assets/icons/base into:\n" + ICONS_DIR);
    return 0;
  }
  logStatus("Icon pack: " + added + " file(s) added to " + ICON_PACK_DIR + ".");
  return added;
}

// --- PNG recolouring (pure JavaScript: base64 <-> PNG decode / encode) ---
// The icon is decoded, every pixel takes the colour times its own
// brightness (white becomes exactly the colour, greys darker shades), the
// transparency is kept, and a new PNG is written. Code by Antonin.
var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64Decode(str) {
  str = String(str).replace(/[^A-Za-z0-9+\/]/g, "");
  var out = [], buf = 0, bits = 0;
  for (var i = 0; i < str.length; i++) {
    buf = (buf << 6) | B64.indexOf(str.charAt(i)); bits += 6;
    if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); }
  }
  return out;
}
function b64Encode(bytes) {
  var s = "", i;
  for (i = 0; i + 2 < bytes.length; i += 3) {
    var n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    s += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63) + B64.charAt((n >> 6) & 63) + B64.charAt(n & 63);
  }
  var rest = bytes.length - i;
  if (rest === 1) {
    var a = bytes[i] << 16;
    s += B64.charAt((a >> 18) & 63) + B64.charAt((a >> 12) & 63) + "==";
  } else if (rest === 2) {
    var b = (bytes[i] << 16) | (bytes[i + 1] << 8);
    s += B64.charAt((b >> 18) & 63) + B64.charAt((b >> 12) & 63) + B64.charAt((b >> 6) & 63) + "=";
  }
  return s;
}
// zlib inflate (RFC 1950 / 1951)
function pngInflate(data) {
  var pos = 2, bitBuf = 0, bitCnt = 0, out = [];
  function bit() { if (!bitCnt) { bitBuf = data[pos++]; bitCnt = 8; } var b = bitBuf & 1; bitBuf >>= 1; bitCnt--; return b; }
  function bitsN(n) { var v = 0; for (var i = 0; i < n; i++) { v |= bit() << i; } return v; }
  function build(lengths) {
    var counts = [], offs = [], syms = [], i;
    for (i = 0; i < 16; i++) { counts[i] = 0; }
    for (i = 0; i < lengths.length; i++) { counts[lengths[i]]++; }
    counts[0] = 0; offs[1] = 0;
    for (i = 1; i < 16; i++) { offs[i + 1] = offs[i] + counts[i]; }
    for (i = 0; i < lengths.length; i++) { if (lengths[i]) { syms[offs[lengths[i]]++] = i; } }
    return { counts: counts, syms: syms };
  }
  function decode(h) {
    var code = 0, first = 0, index = 0;
    for (var len = 1; len < 16; len++) {
      code |= bit(); var c = h.counts[len];
      if (code - c < first) { return h.syms[index + (code - first)]; }
      index += c; first += c; first <<= 1; code <<= 1;
    }
    throw "bad huffman code";
  }
  var LB = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  var LE = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var DB = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  var DE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  var fixedL = null, fixedD = null, last = 0;
  do {
    last = bit();
    var type = bitsN(2), lit, dist;
    if (type === 0) {
      bitCnt = 0;
      var len = data[pos] | (data[pos + 1] << 8);
      pos += 4;
      for (var k = 0; k < len; k++) { out.push(data[pos++]); }
      continue;
    }
    if (type === 1) {
      if (!fixedL) {
        var l = [], j;
        for (j = 0; j < 144; j++) { l[j] = 8; }
        for (; j < 256; j++) { l[j] = 9; }
        for (; j < 280; j++) { l[j] = 7; }
        for (; j < 288; j++) { l[j] = 8; }
        fixedL = build(l);
        var d = [];
        for (j = 0; j < 30; j++) { d[j] = 5; }
        fixedD = build(d);
      }
      lit = fixedL; dist = fixedD;
    } else if (type === 2) {
      var hlit = bitsN(5) + 257, hdist = bitsN(5) + 1, hclen = bitsN(4) + 4;
      var ORD = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], cl = [], q;
      for (q = 0; q < 19; q++) { cl[q] = 0; }
      for (q = 0; q < hclen; q++) { cl[ORD[q]] = bitsN(3); }
      var ch = build(cl), lens = [];
      while (lens.length < hlit + hdist) {
        var sym = decode(ch);
        if (sym < 16) { lens.push(sym); }
        else if (sym === 16) { var prev = lens[lens.length - 1], r16 = 3 + bitsN(2); while (r16--) { lens.push(prev); } }
        else if (sym === 17) { var r17 = 3 + bitsN(3); while (r17--) { lens.push(0); } }
        else { var r18 = 11 + bitsN(7); while (r18--) { lens.push(0); } }
      }
      lit = build(lens.slice(0, hlit)); dist = build(lens.slice(hlit));
    } else {
      throw "bad deflate block";
    }
    for (;;) {
      var s = decode(lit);
      if (s < 256) { out.push(s); }
      else if (s === 256) { break; }
      else {
        s -= 257;
        var ln = LB[s] + bitsN(LE[s]);
        var ds = decode(dist);
        var dd = DB[ds] + bitsN(DE[ds]);
        var from = out.length - dd;
        for (var m = 0; m < ln; m++) { out.push(out[from + m]); }
      }
    }
  } while (!last);
  return out;
}
var CRC_T = null;
function crc32(bytes, start, end) {
  if (!CRC_T) {
    CRC_T = [];
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) { c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; }
      CRC_T[n] = c >>> 0;
    }
  }
  var crc = 0xFFFFFFFF;
  for (var i = start; i < end; i++) { crc = CRC_T[(crc ^ bytes[i]) & 255] ^ (crc >>> 8); }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
// PNG bytes -> { w, h, px: RGBA bytes }
function pngDecode(b) {
  var pos = 8, w = 0, h = 0, depth = 0, ctype = 0, inter = 0, idat = [], pal = null, trns = null;
  function u32(p) { return ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0; }
  while (pos < b.length) {
    var len = u32(pos), type = String.fromCharCode(b[pos + 4], b[pos + 5], b[pos + 6], b[pos + 7]), d = pos + 8;
    if (type === "IHDR") { w = u32(d); h = u32(d + 4); depth = b[d + 8]; ctype = b[d + 9]; inter = b[d + 12]; }
    else if (type === "PLTE") { pal = b.slice(d, d + len); }
    else if (type === "tRNS") { trns = b.slice(d, d + len); }
    else if (type === "IDAT") { for (var i = 0; i < len; i++) { idat.push(b[d + i]); } }
    else if (type === "IEND") { break; }
    pos = d + len + 4;
  }
  if (depth !== 8 || inter !== 0) {
    throw "only 8-bit, non-interlaced PNGs can be recoloured (this one: " + depth + "-bit" + (inter ? ", interlaced" : "") + ")";
  }
  var ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  if (!ch) {
    throw "unsupported PNG colour type " + ctype;
  }
  var raw = pngInflate(idat), stride = w * ch, px = [], prevLine = [], line, x, y;
  for (x = 0; x < stride; x++) { prevLine[x] = 0; }
  var p = 0;
  for (y = 0; y < h; y++) {
    var f = raw[p++];
    line = [];
    for (x = 0; x < stride; x++) {
      var v = raw[p++], a = x >= ch ? line[x - ch] : 0, up = prevLine[x], c = x >= ch ? prevLine[x - ch] : 0;
      if (f === 1) { v += a; } else if (f === 2) { v += up; } else if (f === 3) { v += (a + up) >> 1; }
      else if (f === 4) { var pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? up : c); }
      line[x] = v & 255;
    }
    for (x = 0; x < w; x++) {
      var r, g, bl, al = 255, o = x * ch;
      if (ctype === 6) { r = line[o]; g = line[o + 1]; bl = line[o + 2]; al = line[o + 3]; }
      else if (ctype === 2) { r = line[o]; g = line[o + 1]; bl = line[o + 2]; }
      else if (ctype === 0) { r = g = bl = line[o]; if (trns && trns.length >= 2 && line[o] === trns[1]) { al = 0; } }
      else if (ctype === 4) { r = g = bl = line[o]; al = line[o + 1]; }
      else { var ix = line[o]; r = pal[ix * 3]; g = pal[ix * 3 + 1]; bl = pal[ix * 3 + 2]; al = trns && ix < trns.length ? trns[ix] : 255; }
      px.push(r, g, bl, al);
    }
    prevLine = line;
  }
  return { w: w, h: h, px: px };
}
// RGBA -> PNG bytes (zlib "stored" blocks: no compression needed for small icons)
function pngEncode(w, h, px) {
  var raw = [], i, y;
  for (y = 0; y < h; y++) { raw.push(0); for (i = 0; i < w * 4; i++) { raw.push(px[y * w * 4 + i]); } }
  var z = [0x78, 0x01], a1 = 1, a2 = 0;
  for (i = 0; i < raw.length; i += 65535) {
    var n = Math.min(65535, raw.length - i), lastBlock = i + n >= raw.length ? 1 : 0;
    z.push(lastBlock, n & 255, (n >> 8) & 255, (~n) & 255, ((~n) >> 8) & 255);
    for (var k = 0; k < n; k++) { var v = raw[i + k]; z.push(v); a1 = (a1 + v) % 65521; a2 = (a2 + a1) % 65521; }
  }
  z.push((a2 >> 8) & 255, a2 & 255, (a1 >> 8) & 255, a1 & 255);
  var out = [137, 80, 78, 71, 13, 10, 26, 10];
  function chunk(type, data) {
    var l = data.length;
    out.push((l >>> 24) & 255, (l >>> 16) & 255, (l >>> 8) & 255, l & 255);
    var s = out.length;
    for (var t = 0; t < 4; t++) { out.push(type.charCodeAt(t)); }
    for (var q = 0; q < l; q++) { out.push(data[q]); }
    var c = crc32(out, s, out.length);
    out.push((c >>> 24) & 255, (c >>> 16) & 255, (c >>> 8) & 255, c & 255);
  }
  chunk("IHDR", [(w >>> 24) & 255, (w >>> 16) & 255, (w >>> 8) & 255, w & 255, (h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255, 8, 6, 0, 0, 0]);
  chunk("IDAT", z);
  chunk("IEND", []);
  return out;
}
// Writes a tinted copy of the PNG srcPath to destPath. hex: "#RRGGBB".
function tintPng(srcPath, destPath, hex) {
  var img = pngDecode(b64Decode(api.encodeBinary(srcPath)));
  var m = String(hex).replace("#", "");
  var cr = parseInt(m.substr(0, 2), 16), cg = parseInt(m.substr(2, 2), 16), cb = parseInt(m.substr(4, 2), 16);
  var px = img.px, maxLum = 0, i;
  // The brightest visible pixel becomes exactly the colour (icons drawn
  // in light grey are not darkened).
  for (i = 0; i < px.length; i += 4) {
    if (px[i + 3] > 0) { maxLum = Math.max(maxLum, px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722); }
  }
  maxLum = maxLum > 0 ? maxLum : 255;
  for (i = 0; i < px.length; i += 4) {
    var lum = Math.min(1, (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / maxLum);
    px[i] = Math.round(cr * lum); px[i + 1] = Math.round(cg * lum); px[i + 2] = Math.round(cb * lum);
  }
  api.writeEncodedToBinaryFile(destPath, b64Encode(pngEncode(img.w, img.h, px)));
}

function findShortcut(barId, uid) {
  var list = getBarShortcuts(barId);
  return list[indexOfUidIn(list, uid)] || null;
}

// Gives a button an icon (relative to C-Bar_assets/icons), without colour.
function setShortcutIconFile(barId, uid, iconName) {
  var item = findShortcut(barId, uid);
  if (!item) {
    return;
  }
  trashOwnIconCopies([item.icon, item.iconBase], [iconName], barId, uid);
  mutateBarShortcuts(barId, function (l) {
    var idx = indexOfUidIn(l, uid);
    if (idx !== -1) {
      l[idx].icon = iconName;
      l[idx].iconBase = iconName;
      delete l[idx].iconColor;
    }
  });
  logStatus("Icon of " + item.label + ": " + iconName);
}

// "Other PNG…": the chosen file is copied to C-Bar_assets/icons/customs (a new
// name each time, so Cavalry never shows a cached older image).
function chooseIconFile(barId, uid) {
  var item = findShortcut(barId, uid);
  if (!item) {
    return false;
  }
  var src = "";
  try {
    src = aboveSettings(function () { return api.presentOpenFile(CUSTOM_ICONS_DIR, "Icon for " + item.label + " (PNG, ideally 40 x 40 px)", "Images (*.png *.PNG)"); });
  } catch (e) {}
  if (!src) {
    return false;
  }
  if (!/\.png$/i.test(src)) {
    showMessage("Please choose a PNG file.");
    return false;
  }
  var name = "customs/" + fileSafeName(item.label) + "_" + Date.now() + ".png";
  try {
    api.writeEncodedToBinaryFile(ICONS_DIR + "/" + name, api.encodeBinary(src));
  } catch (e2) {}
  if (!api.filePathExists(ICONS_DIR + "/" + name)) {
    showMessage("Could not copy the icon to " + CUSTOM_ICONS_DIR);
    return false;
  }
  setShortcutIconFile(barId, uid, name);
  return true;
}

// Colours the button's icon: its own (Set Icon) or, failing that, the
// image it shows (custom icon file, script icon, Cavalry node icon).
function setShortcutIconColor(barId, uid, color) {
  var item = findShortcut(barId, uid);
  if (!item) {
    return;
  }
  var hex = ICON_COLOR_HEX[color];
  if (color === "Custom") {
    var cur = item.iconColor && item.iconColor.charAt(0) === "#" ? item.iconColor : "#FFFFFF";
    var typed = aboveSettings(function () { return new ui.Modal().showStringInput("Icon Colour", "Hex colour (e.g. #FF8800)", cur); });
    if (!typed) {
      return;
    }
    typed = String(typed).replace(/\s+/g, "");
    if (typed.charAt(0) !== "#") {
      typed = "#" + typed;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(typed)) {
      showMessage("Please type a colour like #FF8800.");
      return;
    }
    hex = typed.toUpperCase();
    color = hex;
  }
  if (!hex) {
    return;
  }
  var baseName = item.iconBase && api.filePathExists(iconPathFor(item.iconBase)) ? item.iconBase : null;
  var newBase = null;
  if (!baseName) {
    var shown = resolveIcon(item);
    if (!shown || !/\.png$/i.test(shown) || !api.filePathExists(shown)) {
      showMessage("This button has no image to colour: choose one with Set Icon… first.");
      return;
    }
    if (isInFolder(shown, ICONS_DIR)) {
      baseName = String(shown).substr(ICONS_DIR.length + 1);
    } else {
      // An icon from elsewhere (Cavalry, a script folder): copied once.
      newBase = "customs/" + fileSafeName(item.label) + "_" + Date.now() + ".png";
      try { api.writeEncodedToBinaryFile(ICONS_DIR + "/" + newBase, api.encodeBinary(shown)); } catch (e0) {}
      if (!api.filePathExists(ICONS_DIR + "/" + newBase)) {
        showMessage("Could not copy the icon to " + CUSTOM_ICONS_DIR);
        return;
      }
      baseName = newBase;
    }
  }
  var newName = "customs/" + fileSafeName(item.label) + "_" + (Date.now() + 1) + ".png";
  try {
    tintPng(iconPathFor(baseName), ICONS_DIR + "/" + newName, hex);
  } catch (e) {
    showMessage("Could not recolour this icon:\n" + e);
    return;
  }
  trashOwnIconCopies([item.icon], [baseName, newName], barId, uid);
  mutateBarShortcuts(barId, function (l) {
    var idx = indexOfUidIn(l, uid);
    if (idx !== -1) {
      l[idx].icon = newName;
      l[idx].iconBase = baseName;
      l[idx].iconColor = color;
    }
  });
  logStatus("Icon colour of " + item.label + ": " + color);
}

function removeShortcutIcon(barId, uid) {
  var item = findShortcut(barId, uid);
  if (!item) {
    return;
  }
  trashOwnIconCopies([item.icon, item.iconBase], [], barId, uid);
  mutateBarShortcuts(barId, function (l) {
    var idx = indexOfUidIn(l, uid);
    if (idx !== -1) {
      delete l[idx].icon;
      delete l[idx].iconBase;
      delete l[idx].iconColor;
    }
  });
  logStatus("Custom icon removed: " + item.label);
  var labelIcon = customIconFor({ label: item.label });
  if (labelIcon) {
    logStatus("The icon " + labelIcon + " still applies to \"" + item.label + "\": delete that file to go back to the default icon.");
  }
}

// Menu entries shared by Settings (… menu) and Organize Layout.
function iconMenuEntries(item) {
  var out = [{ label: "Set Icon…", id: "icon_set" }];
  if (item.icon || resolveIcon(item)) {
    for (var i = 0; i < ICON_COLORS.length; i++) {
      out.push({ label: (item.iconColor === ICON_COLORS[i] ? "✓ " : "    ") + "Icon Colour: " + ICON_COLORS[i], id: "icolor_" + ICON_COLORS[i] });
    }
    var isCustom = item.iconColor && String(item.iconColor).charAt(0) === "#";
    out.push({ label: (isCustom ? "✓ " : "    ") + "Icon Colour: Custom…" + (isCustom ? " (" + item.iconColor + ")" : ""), id: "icolor_Custom" });
  }
  if (item.icon) {
    out.push({ label: "Remove Custom Icon", id: "icon_remove" });
  }
  return out;
}

// Returns true when actionId was an icon action.
function runIconMenuAction(barId, uid, actionId) {
  if (actionId === "icon_set") {
    openIconPicker(barId, uid);
  } else if (actionId === "icon_remove") {
    removeShortcutIcon(barId, uid);
  } else if (String(actionId).indexOf("icolor_") === 0) {
    setShortcutIconColor(barId, uid, actionId.substr(7));
  } else {
    return false;
  }
  return true;
}

// ------------------------------------------------------------
// "Set Icon" window: icon pack and Cavalry icons, with search and previews
// ------------------------------------------------------------
// Each tab is a grid of image buttons. The search shows the matching
// icons in the first cells and hides the others, so no widget is ever
// destroyed while the window is open. A grid has at most maxCells cells:
// Cavalry has about 900 icons, the search narrows them down.
var ICON_GRID_COLUMNS = 8;
var CAVALRY_ICON_CELLS = 160;
var iconDialog = null;

// Cavalry's own icons (Icons/ and Icons/nodes/), stored as "cavalry:<path>".
function listCavalryIcons() {
  var root = api.getAppAssetsPath() + "/Icons";
  var out = [];
  var dirs = ["", "nodes/"];
  for (var d = 0; d < dirs.length; d++) {
    var files = [];
    try { files = api.listDirectory(root + "/" + dirs[d]) || []; } catch (e) {}
    for (var i = 0; i < files.length; i++) {
      var file = String(files[i]).split(/[\/\\]/).pop();
      var m = file.match(/^(.+)\.png$/i);
      if (m && !/@2x$/i.test(m[1])) {
        out.push({ name: (dirs[d] ? "node " : "") + m[1], file: CAVALRY_ICON_PREFIX + dirs[d] + file });
      }
    }
  }
  out.sort(function (a, b) {
    return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
  });
  return out;
}

// { scroll, filter(text) -> number shown }
function makeIconGrid(icons, maxCells, onPick) {
  var count = Math.min(icons.length, maxCells);
  var cells = [];
  var cellIcon = [];
  var rows = [];
  var grid = new ui.VLayout();
  grid.setSpaceBetween(2);
  for (var r = 0; r * ICON_GRID_COLUMNS < Math.max(count, 1); r++) {
    var rowLayout = new ui.HLayout();
    rowLayout.setSpaceBetween(2);
    rowLayout.setMargins(0, 0, 0, 0);
    for (var c = 0; c < ICON_GRID_COLUMNS && r * ICON_GRID_COLUMNS + c < count; c++) {
      (function (k) {
        var btn = new ui.ImageButton(iconPathFor(icons[k].file));
        btn.setImageSize(28, 28);
        btn.setSize(38, 38);
        btn.setDrawStroke(false);
        btn.onClick = function () {
          if (cellIcon[k]) {
            onPick(cellIcon[k]);
          }
        };
        cells.push(btn);
        rowLayout.add(btn);
      })(r * ICON_GRID_COLUMNS + c);
    }
    rowLayout.addStretch();
    var row = new ui.Container();
    row.setLayout(rowLayout);
    rows.push(row);
    grid.add(row);
  }
  grid.addStretch();
  var scroll = new ui.ScrollView();
  scroll.setLayout(grid);
  scroll.setFixedHeight(360);

  function filter(text) {
    var words = String(text || "").toLowerCase().replace(/[-_]+/g, " ").split(/\s+/).filter(function (w) { return w.length; });
    var found = 0;
    for (var i = 0; i < icons.length; i++) {
      // "addArray" is also found with "add array".
      var name = icons[i].name.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/[-_]+/g, " ");
      var ok = true;
      for (var w = 0; w < words.length; w++) {
        if (name.indexOf(words[w]) === -1) {
          ok = false;
          break;
        }
      }
      if (!ok) {
        continue;
      }
      if (found < cells.length) {
        cells[found].setImage(iconPathFor(icons[i].file));
        cells[found].setToolTip(icons[i].name);
        cellIcon[found] = icons[i];
      }
      found++;
    }
    var shown = Math.min(found, cells.length);
    for (var j = 0; j < cells.length; j++) {
      cells[j].setHidden(j >= shown);
      if (j >= shown) {
        cellIcon[j] = null;
      }
    }
    for (var q = 0; q < rows.length; q++) {
      rows[q].setHidden(q * ICON_GRID_COLUMNS >= shown);
    }
    return found;
  }
  return { scroll: scroll, filter: filter };
}

function openIconPicker(barId, uid) {
  var item = findShortcut(barId, uid);
  if (!item) {
    return;
  }
  if (iconDialog) {
    try { iconDialog.close(); } catch (e0) {}
    iconDialog = null;
  }
  function pick(icon) {
    setShortcutIconFile(barId, uid, icon.file);
    iconDialog.close();
  }
  var packIcons = listPackIcons();
  var cavalryIcons = listCavalryIcons();
  var packGrid = makeIconGrid(packIcons, packIcons.length, pick);
  var cavalryGrid = makeIconGrid(cavalryIcons, CAVALRY_ICON_CELLS, pick);
  var packCount = new ui.Label("");
  var cavalryCount = new ui.Label("");
  try { packCount.setTextColor("#8a8a8a"); cavalryCount.setTextColor("#8a8a8a"); } catch (eC) {}

  function showIcons(text) {
    var p = packGrid.filter(text);
    packCount.setText(p + " / " + packIcons.length + " icons");
    var n = cavalryGrid.filter(text);
    cavalryCount.setText(n > CAVALRY_ICON_CELLS ? CAVALRY_ICON_CELLS + " shown of " + n + " — type to narrow the search" :
      n + " / " + cavalryIcons.length + " icons");
  }

  var searchField = new ui.LineEdit();
  searchField.setPlaceholder("Search icons…");
  searchField.onValueChanged = function () {
    showIcons(searchField.getText());
  };

  var packLayout = new ui.VLayout();
  packLayout.add(new ui.Label(packIcons.length ? "Click an icon to use it (white: colour it with Icon Colour)." :
    "The icon pack is missing (Settings › Update only replaces C-Bar.js)."));
  if (!packIcons.length) {
    var downloadBtn = new ui.Button("Download Icon Pack");
    downloadBtn.onClick = function () {
      if (downloadIconPack() > 0) {
        openIconPicker(barId, uid);
      }
    };
    var downloadRow = new ui.HLayout();
    downloadRow.add(downloadBtn);
    downloadRow.addStretch();
    packLayout.add(downloadRow);
  }
  packLayout.add(packGrid.scroll);
  packLayout.add(packCount);
  var cavalryLayout = new ui.VLayout();
  cavalryLayout.add(new ui.Label("Cavalry's own icons (interface and nodes). Click one to use it."));
  cavalryLayout.add(cavalryGrid.scroll);
  cavalryLayout.add(cavalryCount);
  var tabs = new ui.TabView();
  tabs.add("C-Bar Icons", packLayout);
  tabs.add("Cavalry Icons", cavalryLayout);

  var otherBtn = new ui.Button("Other PNG…");
  otherBtn.onClick = function () {
    if (chooseIconFile(barId, uid)) {
      iconDialog.close();
    }
  };
  var closeBtn = new ui.Button("Close");
  closeBtn.onClick = function () {
    iconDialog.close();
  };
  var buttons = new ui.HLayout();
  buttons.add(otherBtn);
  buttons.addStretch();
  buttons.add(closeBtn);

  var layout = new ui.VLayout();
  layout.setMargins(8, 8, 8, 8);
  layout.add(searchField);
  layout.add(sectionTitle("Icon for \"" + item.label + "\""));
  layout.add(tabs);
  layout.add(buttons);
  iconDialog = new ui.Container();
  iconDialog.setMinimumWidth(ICON_GRID_COLUMNS * 40 + 40);
  iconDialog.setLayout(layout);
  showIcons("");
  showOnTop(iconDialog);
}

function createToolbarButton(shortcut) {
  if (shortcut.kind === "keys" && !customIconFor(shortcut)) {
    return createKeysTile(shortcut);
  }
  if (shortcut.kind === "expression" && !customIconFor(shortcut)) {
    return createExpressionTile(shortcut, "Expression: " + shortcut.label + "\n" + shortcut.expression +
      "\nClick: apply to the selected attribute(s)\nAlt + click with a layer selected: choose the attribute");
  }
  if (shortcut.kind === "script" && !resolveIcon(shortcut)) {
    return createScriptTile(shortcut);
  }
  var btn;
  var iconPath = resolveIcon(shortcut);
  if (iconPath) {
    btn = new ui.ImageButton(iconPath);
    btn.setImageSize(20, 20);
    btn.setSize(26, 26);
    btn.setDrawStroke(false);
  } else {
    btn = new ui.Button(String(shortcut.label).substr(0, 3));
    btn.setSize(24, 24);
  }
  var tip = shortcut.kind === "expression" ? "Expression: " + shortcut.label + "\n" + shortcut.expression +
      "\nClick: apply to the selected attribute(s)\nAlt + click with a layer selected: choose the attribute" :
    shortcut.kind === "rig" ? "Rig: " + shortcut.label + (shortcut.description ? "\n" + shortcut.description : "") :
    shortcut.kind === "keys" ? keysTooltip(shortcut) :
    shortcut.kind === "script" ? "Script: " + shortcut.label :
    shortcut.kind === "layout" ? shortcut.label + "\nWith layers selected: they become its children" :
    (shortcut.preset ? "♥ " + shortcut.label + " (favourite with its settings)" : "Create a " + shortcut.label + " node");
  var altType = (shortcut.kind || shortcut.preset) ? null : shortcutNodeType(shortcut);
  if (altType === "colorArray") {
    tip += "\nWith a layer selected: connected to its Fill, as a child of the layer" +
      "\nShift + click: from the active palette of the Color window" +
      "\nShift + click with a Color Array (or a layer it colours) selected: its colours become the palette's" +
      "\nAlt + click with a layer selected: choose the colour to drive";
  } else if (isFilterType(altType)) {
    tip += "\nAlt + click with a layer selected: add it to the layer's filters";
  } else if (canPickAttribute(shortcut)) {
    tip += "\nAlt + click with a layer selected: choose the attribute to drive";
  }
  btn.setToolTip(tip);
  btn.onClick = function () {
    cancelLongPress();
    var alt = false;
    try { alt = api.isAltHeld(); } catch (e) {}
    var shift = false;
    try { shift = api.isShiftHeld(); } catch (eS) {}
    if (shortcut.kind === "keys") { // shortcut as button with a custom icon
      sendKeys(shortcut);
      return;
    }
    if (shortcut.kind === "expression") { // expression with a custom icon
      runExpressionShortcut(shortcut, alt);
      return;
    }
    if (!alt && isColorArrayShortcut(shortcut)) {
      createColorArray(shortcut, shift);
      return;
    }
    if (alt && handleAltClick(shortcut)) {
      return;
    }
    if (alt && canPickAttribute(shortcut) && showAttributeMenu(shortcut)) {
      return;
    }
    createNode(shortcut);
  };
  return btn;
}

function createUtilityButton(iconName, fallbackText, tooltip, onClick) {
  var iconPath = api.getAppAssetsPath() + "/Icons/" + iconName;
  var btn;
  if (api.filePathExists(iconPath)) {
    btn = new ui.ImageButton(iconPath);
    btn.setImageSize(16, 16);
    btn.setSize(24, 24);
    btn.setDrawStroke(false);
  } else {
    btn = new ui.Button(fallbackText);
    btn.setSize(24, 24);
  }
  btn.setToolTip(tooltip);
  btn.onClick = function () {
    cancelLongPress();
    onClick();
  };
  return btn;
}

// Button centred across the thickness of the bar.
function centeredCell(vertical, widget) {
  var cell = vertical ? new ui.HLayout() : new ui.VLayout();
  cell.setMargins(0, 0, 0, 0);
  cell.setSpaceBetween(0);
  cell.addStretch();
  cell.add(widget);
  cell.addStretch();
  return cell;
}

// Page selector: light grey squares with their number, the size of the
// old solo buttons; the number of the page shown is green, and the page
// under a dragged shortcut (Organize Layout) is highlighted.
// cavalry.Path.addRect takes (fromX, fromY, toX, toY).
var PAGE_BUTTON_SIZE = 24;
var PAGE_BUTTON_COLOR = "#4a4a4a";
var PAGE_DROP_COLOR = "#3e6a96";
var PAGE_ACTIVE_COLOR = "#4ffd7a"; // number of the page shown

// activePage: the page with the green number (the bar's page by default;
// Settings passes its own).
function paintPageButton(d, n, dropHover, activePage) {
  var size = PAGE_BUTTON_SIZE;
  var active = n === (activePage === undefined ? currentPage : activePage);
  try { d.clearPaths(); } catch (e) {}
  var sq = new cavalry.Path();
  sq.addRect(3, 3, size - 3, size - 3);
  d.addPath(sq.toObject(), { color: dropHover ? PAGE_DROP_COLOR : PAGE_BUTTON_COLOR });
  var txt = new cavalry.Path();
  txt.addText(String(n), 11, 0, 0);
  var bb = txt.boundingBox();
  txt.translate(size / 2 - bb.centre.x, size / 2 - bb.centre.y);
  d.addPath(txt.toObject(), { color: active ? PAGE_ACTIVE_COLOR : (dropHover ? "#ffffff" : "#c8c8c8") });
  try { d.redraw(); } catch (e2) {}
}

function createPageButton(n) {
  var size = PAGE_BUTTON_SIZE;
  var d = new ui.Draw();
  d.setSize(size, size);
  try { d.setBackgroundColor(ui.getThemeColor("Window")); } catch (e) {}
  paintPageButton(d, n, false);
  d.setToolTip("Page " + n + (editMode ? "\nDrop a shortcut here to move it to this page" :
    "\nHold 1.5 s on the bar: Organize Layout"));
  // The page changes on release: changing it on press would rebuild the
  // bar under the mouse, and the release (which stops the long press)
  // would be lost.
  d.onMousePress = function (position, button) {
    if (button === "left") {
      startLongPress();
    } else if (button === "right") {
      showBarMenu();
    }
  };
  d.onMouseRelease = function (position, button) {
    var wasPending = longPressPending();
    cancelLongPress();
    // Normal mode: only when the long press did not fire. Organize Layout:
    // there is no long press, a click shows the page.
    if (button === "left" && (wasPending || editMode)) {
      setCurrentPage(n);
    }
  };
  pageButtons[n] = d;
  return d;
}

function createSeparator(vertical) {
  var line = new ui.Container();
  var color = "#5a5a5a";
  try { color = ui.getThemeColor("Mid"); } catch (e) {}
  line.setBackgroundColor(color);
  if (vertical) {
    line.setFixedWidth(20);
    line.setFixedHeight(1);
  } else {
    line.setFixedWidth(1);
    line.setFixedHeight(20);
  }
  return line;
}

var SPACER_SIZE = 12;

function createSpacerWidget(vertical) {
  var gap = new ui.Container();
  if (vertical) {
    gap.setFixedWidth(20);
    gap.setFixedHeight(SPACER_SIZE);
  } else {
    gap.setFixedWidth(SPACER_SIZE);
    gap.setFixedHeight(20);
  }
  return gap;
}

// Shortcuts of the current page, followed by "+" and ⚙. The stretch
// pushes the page selector (1 2 3 4) to the bottom (vertical) or to the
// right (horizontal).
function fillLayout(layout, vertical) {
  pageButtons = {};
  // Emptied on every rebuild, Organize Layout included: the widgets of
  // the previous layout are destroyed, and reading the geometry of a
  // destroyed widget crashes Cavalry.
  barItemWidgets = [];
  if (editMode) {
    fillEditLayout(layout, vertical);
    return;
  }
  layout.setSpaceBetween(4);
  var shown = visibleShortcuts();
  for (var i = 0; i < shown.length; i++) {
    if (shown[i].kind === "spacer") {
      layout.add(centeredCell(vertical, createSpacerWidget(vertical)));
    } else {
      layout.add(centeredCell(vertical, barItem(createToolbarButton(shown[i]))));
    }
  }
  // Built-in gap before "+" (not a shortcut, not listed in Settings).
  layout.add(centeredCell(vertical, createSpacerWidget(vertical)));
  layout.add(centeredCell(vertical, barItem(createUtilityButton(
    "addIcon.png", "+", "Add a node, a script, the selected layer, an expression, a rig or a spacer", showAddMenu))));
  layout.add(centeredCell(vertical, barItem(createUtilityButton(
    "settings.png", "⚙", "Settings: shortcuts and bars", openManager))));
  layout.addStretch();
  if (showPageSelector()) {
    layout.add(centeredCell(vertical, createSeparator(vertical)));
    for (var n = 1; n <= PAGE_COUNT; n++) {
      layout.add(centeredCell(vertical, createPageButton(n)));
    }
  }
}

// "Hide page selector" (per bar, off by default). Always shown in Edit
// Layout mode (drop targets).
function showPageSelector() {
  return editMode || currentBar.hidePages !== true;
}

function getBarItemCount() {
  return visibleShortcuts().length + 3 + (showPageSelector() ? 1 + PAGE_COUNT : 0);
}

// ============================================================
// Organize Layout mode
// ============================================================
// Hold the mouse 1.5 s on the bar (an empty part or a page button), or
// right-click > Organize Layout. The shortcuts stop working and can be
// dragged between two others, or onto a page button (1 2 3 4) to move
// it to that page; right-click gives Move / Delete. The dotted "+" adds
// a spacer at the end of the page, the green check mark leaves the mode
// (a long press only enters it).

var LONG_PRESS_MS = 1500;
var editMode = false;
var longPressTimer = null;
var pageButtons = {};   // page number -> its widget (drop targets)
var editCells = [];     // { cell, shortcut } for the page shown, in order
var drag = null;        // { from, cell, start, moved, target, page }

var EDIT_BAR_COLOR = "#26313d";

function startLongPress() {
  if (editMode) {
    return;
  }
  try {
    if (!longPressTimer) {
      longPressTimer = new api.Timer({
        onTimeout: function () {
          longPressTimer.stop();
          longPressStarted = false;
          // A long press only enters the mode: while editing, holding a
          // shortcut to drag it must never leave it.
          if (!editMode) {
            toggleEditMode();
          }
        }
      });
      longPressTimer.setRepeating(false);
      longPressTimer.setInterval(LONG_PRESS_MS);
    }
    longPressTimer.stop();
    longPressTimer.start();
    longPressStarted = true;
  } catch (e) {}
}

// True between the press and the 1.5 s mark.
var longPressStarted = false;
function longPressPending() {
  return longPressStarted;
}

function cancelLongPress() {
  longPressStarted = false;
  try {
    if (longPressTimer) {
      longPressTimer.stop();
    }
  } catch (e) {}
}

function toggleEditMode() {
  cancelLongPress();
  editMode = !editMode;
  drag = null;
  // The bar itself keeps Cavalry's own background (a colour set on it
  // could not be removed afterwards): only the shortcut cells and the
  // gaps between them are tinted while editing.
  refillBars();
  buildMainMenu();
  logStatus(editMode ? "Organize Layout: drag the shortcuts, drop on 1 2 3 4 to change page, \u2713 when done." :
    "Layout saved.");
}

// Global position of the mouse along the bar, from a position local to
// the pressed cell. geometry() is in screen coordinates (y going down)
// but mouse positions are y-up (origin at the bottom left, like
// ui.Draw), so y is flipped against the height of the cell.
function globalAlong(cell, position) {
  var g = null;
  try { g = cell.geometry(); } catch (e) {}
  if (!g) {
    return null;
  }
  if (isVertical()) {
    var h = g.height !== undefined ? g.height : (g.bottom - g.top);
    return g.top + (h - position.y);
  }
  return g.left + position.x;
}

// While a shortcut is dragged, the gap where it would go opens and
// shows a dotted line; the dragged shortcut stays highlighted, and so
// does the page button under the mouse.
var EDIT_DRAG_COLOR = "#3e6a96";
var GAP_IDLE = 4;
var GAP_OPEN = 16;
var editGaps = [];      // gap widgets: editGaps[k] is before editCells[k]

function setGapOpen(k, open) {
  var gap = editGaps[k];
  if (!gap) {
    return;
  }
  var vertical = isVertical();
  var len = open ? GAP_OPEN : GAP_IDLE;
  try {
    if (vertical) {
      gap.setSize(26, len);
    } else {
      gap.setSize(len, 26);
    }
  } catch (e) {}
  try { gap.clearPaths(); } catch (e2) {}
  if (open) {
    // Dotted line across the bar, in the middle of the gap.
    for (var t = 3; t < 23; t += 4) {
      var dash = new cavalry.Path();
      if (vertical) {
        dash.addRect(t, len / 2 - 0.75, t + 2, len / 2 + 0.75);
      } else {
        dash.addRect(len / 2 - 0.75, t, len / 2 + 0.75, t + 2);
      }
      gap.addPath(dash.toObject(), { color: "#e6e6e6" });
    }
  }
  try { gap.redraw(); } catch (e3) {}
}

function createGap(vertical) {
  var gap = new ui.Draw();
  if (vertical) {
    gap.setSize(26, GAP_IDLE);
  } else {
    gap.setSize(GAP_IDLE, 26);
  }
  try { gap.setBackgroundColor(EDIT_BAR_COLOR); } catch (e) {}
  try { gap.setTransparentForMouseEvents(true); } catch (e2) {}
  return gap;
}

// Start and end of a widget along the bar (screen coordinates).
function spanAlong(widget) {
  var g = null;
  try { g = widget.geometry(); } catch (e) {}
  if (!g) {
    return null;
  }
  return isVertical() ? { start: g.top, end: g.bottom } : { start: g.left, end: g.right };
}

// Slot (0..N) where the dragged shortcut would be inserted: the number
// of other shortcuts whose middle is before the mouse.
function slotAt(v) {
  var slot = 0;
  for (var i = 0; i < editCells.length; i++) {
    if (i === drag.from) {
      continue;
    }
    var sp = spanAlong(editCells[i].cell);
    if (sp && v > (sp.start + sp.end) / 2) {
      slot = i + 1;
    }
  }
  return slot;
}

function setPageDropHover(page) {
  if (page === drag.page) {
    return;
  }
  if (drag.page && pageButtons[drag.page]) {
    paintPageButton(pageButtons[drag.page], drag.page, false);
  }
  if (page && pageButtons[page]) {
    paintPageButton(pageButtons[page], page, true);
  }
  drag.page = page;
}

function setOpenSlot(slot) {
  if (slot === drag.slot) {
    return;
  }
  if (drag.slot !== null) {
    setGapOpen(drag.slot, false);
  }
  if (slot !== null) {
    setGapOpen(slot, true);
  }
  drag.slot = slot;
}

function createEditCell(shortcut, index, vertical) {
  var inner = shortcut.kind === "spacer" ? createSpacerWidget(vertical) : createToolbarButton(shortcut);
  try { inner.setTransparentForMouseEvents(true); } catch (e) {}
  try { inner.setEnabled(false); } catch (e2) {}
  var lay = new ui.HLayout();
  lay.setMargins(0, 0, 0, 0);
  lay.addStretch();
  lay.add(inner);
  lay.addStretch();
  var cell = new ui.Container();
  cell.setLayout(lay);
  var len = shortcut.kind === "spacer" ? SPACER_SIZE : 26;
  if (vertical) {
    cell.setFixedWidth(26);
    cell.setFixedHeight(len);
  } else {
    cell.setFixedWidth(len);
    cell.setFixedHeight(26);
  }
  try { cell.setBackgroundColor(EDIT_BAR_COLOR); } catch (e3) {}
  if (shortcut.kind === "spacer") {
    try { cell.setBorder("#8a8a8a", 1, 2, 2); } catch (e4) {}
  }
  cell.setToolTip((shortcut.label || "Spacer") + "\nDrag to move it · drop on 1 2 3 4 to change its page" +
    "\nRight-click: move, change page, delete");
  cell.onMousePress = function (position, button) {
    if (button === "right") {
      showEditCellMenu(shortcut);
      return;
    }
    if (button !== "left") {
      return;
    }
    drag = { from: index, cell: cell, start: globalAlong(cell, position), moved: false, slot: null, page: null };
    try { cell.setBackgroundColor(EDIT_DRAG_COLOR); } catch (e5) {}
  };
  cell.onMouseMove = function (position) {
    if (!drag || drag.cell !== cell) {
      return;
    }
    var v = globalAlong(cell, position);
    if (v === null || drag.start === null) {
      return;
    }
    if (!drag.moved && Math.abs(v - drag.start) < 4) {
      return;
    }
    drag.moved = true;
    var page = null;
    for (var n = 1; n <= PAGE_COUNT; n++) {
      var sp = pageButtons[n] ? spanAlong(pageButtons[n]) : null;
      if (sp && v >= sp.start && v <= sp.end) {
        page = n;
      }
    }
    setPageDropHover(page && page !== currentPage ? page : null);
    var slot = page ? null : slotAt(v);
    // Its own place (just before or after itself): nothing to open.
    if (slot === drag.from || slot === drag.from + 1) {
      slot = null;
    }
    setOpenSlot(slot);
  };
  cell.onMouseRelease = function () {
    var d = drag;
    drag = null;
    if (!d) {
      return;
    }
    if (!d.moved) {
      try { cell.setBackgroundColor(EDIT_BAR_COLOR); } catch (e6) {}
      return;
    }
    var uid = editCells[d.from].shortcut.uid;
    if (d.page) {
      moveShortcutToPage(uid, d.page);
    } else if (d.slot !== null) {
      moveShortcutToSlot(uid, d.slot);
    } else {
      refillBars();
    }
  };
  return cell;
}

// Right-click on a shortcut in Organize Layout: move it one step (Up / Down
// on a vertical bar, Left / Right on a horizontal one), to another page,
// or delete it.
function showEditCellMenu(shortcut) {
  var uid = shortcut.uid;
  var vertical = isVertical();
  var shown = visibleShortcuts();
  var pos = indexOfUidIn(shown, uid);
  ui.clearContextMenu();
  ui.addMenuItem({ name: vertical ? "Move Up" : "Move Left", enabled: pos > 0,
    onMouseRelease: function () { moveShortcutBy(uid, -1); } });
  ui.addMenuItem({ name: vertical ? "Move Down" : "Move Right", enabled: pos !== -1 && pos < shown.length - 1,
    onMouseRelease: function () { moveShortcutBy(uid, 1); } });
  ui.addMenuItem({ name: "" });
  for (var n = 1; n <= PAGE_COUNT; n++) {
    (function (page) {
      ui.addMenuItem({ name: "Move to Page " + page, enabled: page !== currentPage,
        onMouseRelease: function () { moveShortcutToPage(uid, page); } });
    })(n);
  }
  ui.addMenuItem({ name: "" });
  if (shortcut.kind === "keys") {
    ui.addMenuItem({ name: "Edit Shortcut as Button…", onMouseRelease: function () { openKeysDialog(currentBar.id, uid); } });
    ui.addMenuItem({ name: "" });
  }
  if (shortcut.kind !== "spacer") {
    var iconEntries = iconMenuEntries(shortcut);
    var colours = null;
    for (var ie = 0; ie < iconEntries.length; ie++) {
      (function (entry) {
        var item = { name: entry.label.replace(/^\s+/, "").replace(/^(✓ )?Icon Colour: /, "$1"),
          onMouseRelease: function () { runIconMenuAction(currentBar.id, uid, entry.id); } };
        if (entry.id.indexOf("icolor_") === 0) {
          if (!colours) {
            colours = new ui.Menu("Icon Colour");
          }
          colours.addMenuItem(item);
        } else {
          if (entry.id === "icon_remove" && colours) {
            ui.addSubMenu(colours);
            colours = null;
          }
          ui.addMenuItem(item);
        }
      })(iconEntries[ie]);
    }
    if (colours) {
      ui.addSubMenu(colours);
    }
    ui.addMenuItem({ name: "" });
  }
  ui.addMenuItem({ name: "Delete", onMouseRelease: function () { deleteShortcut(uid); } });
  ui.showContextMenu();
  restoreMainMenuSoon();
}

// Swaps a shortcut with its neighbour on the page shown (step -1 or 1).
function moveShortcutBy(uid, step) {
  var shown = visibleShortcuts();
  var pos = indexOfUidIn(shown, uid);
  var other = shown[pos + step];
  if (pos === -1 || !other) {
    return;
  }
  mutateBarShortcuts(currentBar.id, function (l) {
    var a = indexOfUidIn(l, uid);
    var b = indexOfUidIn(l, other.uid);
    if (a === -1 || b === -1) {
      return;
    }
    var tmp = l[a];
    l[a] = l[b];
    l[b] = tmp;
  });
}

function deleteShortcut(uid) {
  var label = "";
  mutateBarShortcuts(currentBar.id, function (l) {
    var idx = indexOfUidIn(l, uid);
    if (idx !== -1) {
      label = l[idx].label || "Spacer";
      l.splice(idx, 1);
    }
  });
  if (label) {
    logStatus("Shortcut deleted: " + label);
  }
}

// Moves a shortcut to a slot of the page shown: before the shortcut
// shown at that slot, or after the last one.
function moveShortcutToSlot(uid, slot) {
  var before = slot < editCells.length ? editCells[slot].shortcut.uid : null;
  var last = editCells.length ? editCells[editCells.length - 1].shortcut.uid : null;
  mutateBarShortcuts(currentBar.id, function (l) {
    var from = indexOfUidIn(l, uid);
    if (from === -1) {
      return;
    }
    var moved = l.splice(from, 1)[0];
    var to = before ? indexOfUidIn(l, before) : indexOfUidIn(l, last) + 1;
    if (to < 0) {
      l.splice(from, 0, moved);
      return;
    }
    l.splice(to, 0, moved);
  });
}

// Moves a shortcut to the end of another page.
function moveShortcutToPage(uid, page) {
  mutateBarShortcuts(currentBar.id, function (l) {
    var from = indexOfUidIn(l, uid);
    if (from === -1) {
      return;
    }
    var moved = l.splice(from, 1)[0];
    moved.page = page;
    l.push(moved);
  });
  logStatus("Moved to page " + page + ".");
}

// Organize Layout "+": a dotted frame with a small "+", to show that it
// adds a spacer (an empty gap). addRect takes (fromX, fromY, toX, toY).
function createSpacerTile() {
  var size = 24;
  var d = new ui.Draw();
  d.setSize(size, size);
  try { d.setBackgroundColor(ui.getThemeColor("Window")); } catch (e) {}
  var c = "#c8c8c8";
  var a = 4;
  var b = size - 4;
  for (var t = a; t < b; t += 4) {
    var e = Math.min(t + 2, b);
    var top = new cavalry.Path();
    top.addRect(t, b - 1, e, b);
    d.addPath(top.toObject(), { color: c });
    var bottom = new cavalry.Path();
    bottom.addRect(t, a, e, a + 1);
    d.addPath(bottom.toObject(), { color: c });
    var left = new cavalry.Path();
    left.addRect(a, t, a + 1, e);
    d.addPath(left.toObject(), { color: c });
    var right = new cavalry.Path();
    right.addRect(b - 1, t, b, e);
    d.addPath(right.toObject(), { color: c });
  }
  var m = size / 2;
  var h = new cavalry.Path();
  h.addRect(m - 3, m - 0.5, m + 3, m + 0.5);
  d.addPath(h.toObject(), { color: c });
  var v = new cavalry.Path();
  v.addRect(m - 0.5, m - 3, m + 0.5, m + 3);
  d.addPath(v.toObject(), { color: c });
  d.setToolTip("Add a spacer at the end of this page");
  d.onMouseRelease = function (position, button) {
    if (button === "left") {
      addSpacer(currentBar.id);
    }
  };
  d.onMousePress = function (position, button) {
    if (button === "right") {
      showBarMenu();
    }
  };
  return d;
}

// Organize Layout "Done": a green check mark (ui.Draw is y-up).
function createDoneTile() {
  var size = 24;
  var d = new ui.Draw();
  d.setSize(size, size);
  try { d.setBackgroundColor(ui.getThemeColor("Window")); } catch (e) {}
  var check = new cavalry.Path();
  check.moveTo(6.5, 12.5);
  check.lineTo(10.5, 8.5);
  check.lineTo(17.5, 16);
  d.addPath(check.toObject(), { color: PAGE_ACTIVE_COLOR, stroke: true, strokeWidth: 2 });
  d.setToolTip("Done: leave Organize Layout");
  d.onMouseRelease = function (position, button) {
    if (button === "left") {
      toggleEditMode();
    }
  };
  d.onMousePress = function (position, button) {
    if (button === "right") {
      showBarMenu();
    }
  };
  return d;
}

function fillEditLayout(layout, vertical) {
  editCells = [];
  editGaps = [];
  layout.setSpaceBetween(0);
  var shown = visibleShortcuts();
  for (var i = 0; i < shown.length; i++) {
    var gap = createGap(vertical);
    editGaps.push(gap);
    layout.add(centeredCell(vertical, gap));
    var cell = barItem(createEditCell(shown[i], i, vertical));
    editCells.push({ cell: cell, shortcut: shown[i] });
    layout.add(centeredCell(vertical, cell));
  }
  var lastGap = createGap(vertical);
  editGaps.push(lastGap);
  layout.add(centeredCell(vertical, lastGap));
  layout.add(centeredCell(vertical, createSpacerWidget(vertical)));
  layout.add(centeredCell(vertical, barItem(createSpacerTile())));
  layout.addSpacing(4);
  layout.add(centeredCell(vertical, barItem(createDoneTile())));
  layout.addStretch();
  // The page selector stays visible while editing (drop targets).
  layout.add(centeredCell(vertical, createSeparator(vertical)));
  for (var n = 1; n <= PAGE_COUNT; n++) {
    layout.addSpacing(4);
    layout.add(centeredCell(vertical, createPageButton(n)));
  }
}

// ============================================================
// Bar: building and sizing
// ============================================================

var BAR_THICKNESS = 32;
var sizeFree = false;
var mainBar = null;

function isVertical() {
  return currentBar.orientation === "vertical";
}

function makeBar(vertical) {
  var layout = vertical ? new ui.VLayout() : new ui.HLayout();
  layout.setSpaceBetween(4);
  if (vertical) {
    layout.setMargins(0, 2, 0, 2);
  } else {
    layout.setMargins(2, 0, 2, 0);
  }
  fillLayout(layout, vertical);
  var container = new ui.Container();
  container.setLayout(layout);
  // Hold 1.5 s on an empty part of the bar: Organize Layout mode. The
  // tooltip shows on the empty parts (buttons have their own).
  container.setToolTip("Hold the mouse 1.5 s here, or right-click > Organize Layout,\nto move, page and delete the shortcuts");
  container.onMousePress = function (position, button) {
    // A click on a shortcut also reaches the bar (the buttons let the
    // press through) while its release does not: the long press would
    // then start on every click. It only starts on an empty part.
    if (pressIsOnBarItem(container, position)) {
      return;
    }
    if (button === "left") {
      startLongPress();
    } else if (button === "right") {
      showBarMenu();
    }
  };
  container.onMouseRelease = function () {
    cancelLongPress();
  };
  var bar = { container: container, layout: layout, vertical: vertical, root: container };
  // Horizontal: the window does not scroll sideways by itself, so the bar
  // sits in a ScrollView that shows a horizontal scroll bar when the
  // window is narrower than the buttons.
  if (!vertical) {
    try {
      var wrap = new ui.HLayout();
      wrap.setMargins(0, 0, 0, 0);
      wrap.setSpaceBetween(0);
      wrap.add(container);
      var scroll = new ui.ScrollView();
      scroll.setLayout(wrap);
      // Content height fits inside the view: no vertical scroll bar.
      container.setFixedHeight(BAR_THICKNESS - 4);
      scroll.setFixedHeight(BAR_THICKNESS);
      // An explicit minimum width: otherwise the scroll view takes the
      // width of its content as its own minimum, the docked window can
      // never be narrower than the buttons, and the dock simply cuts them
      // off instead of showing the horizontal scroll bar.
      try { scroll.setMinimumWidth(BAR_THICKNESS); } catch (eMin) {}
      bar.root = scroll;
      bar.scroll = scroll;
    } catch (eScroll) {
      bar.root = container;
    }
  }
  return bar;
}

// Vertical: window tall enough at opening to show every button.
// Horizontal: minimum width of all the buttons, so a narrow window shows
// a horizontal scroll bar instead of squeezing the buttons.
function applyBarSize() {
  if (!mainBar) {
    return;
  }
  if (mainBar.vertical) {
    mainBar.container.setMinimumHeight(getBarItemCount() * 28 + 12);
  } else {
    mainBar.container.setMinimumWidth(barContentLength());
  }
}

function refillBars() {
  if (!mainBar) {
    return;
  }
  // A pending long press never survives a rebuild of the bar: the
  // widget that got the press is gone, so its release would be lost and
  // Organize Layout would start by itself (e.g. after a click on Hide page
  // selector in Settings).
  cancelLongPress();
  mainBar.layout.clear();
  fillLayout(mainBar.layout, mainBar.vertical);
  applyBarSize();
  updateOverflow();
}

// Fixed thickness (width when vertical, height when horizontal) so the
// bar hugs its buttons; its length stays free.
function applySizeLimits() {
  ui.setMinimumWidth(0);
  ui.setMinimumHeight(0);
  ui.setMaximumWidth(99999);
  ui.setMaximumHeight(99999);
  if (sizeFree) {
    return;
  }
  var thickness = BAR_THICKNESS + (barOverflowing ? SCROLLBAR_SIZE : 0);
  if (isVertical()) {
    ui.setFixedWidth(thickness);
  } else {
    ui.setFixedHeight(thickness);
    if (mainBar && mainBar.scroll) {
      mainBar.scroll.setFixedHeight(thickness);
    }
  }
}

var openSizeTimer = null;
function openAtFullLength() {
  var len = barContentLength() + 4;
  try {
    if (isVertical()) {
      ui.setMinimumHeight(len);
    } else {
      ui.setMinimumWidth(len);
    }
  } catch (e) {}
  try {
    openSizeTimer = new api.Timer({
      onTimeout: function () {
        openSizeTimer.stop();
        if (isVertical()) {
          ui.setMinimumHeight(0);
        } else {
          ui.setMinimumWidth(0);
        }
      }
    });
    openSizeTimer.setInterval(800);
    openSizeTimer.setRepeating(false);
    openSizeTimer.start();
  } catch (e2) {}
}

// When the window is made shorter (vertical) or narrower (horizontal)
// than its buttons, Cavalry adds a scroll bar inside the window. The bar
// is then made thicker by the width of that scroll bar so it no longer
// covers the buttons; it goes back to its normal thickness once
// everything fits again.
var SCROLLBAR_SIZE = 14;
var barOverflowing = false;

// Length needed to show every button without scrolling.
function barContentLength() {
  var shown = visibleShortcuts();
  var len = 4; // margins
  var count = 0;
  for (var i = 0; i < shown.length; i++) {
    len += shown[i].kind === "spacer" ? SPACER_SIZE : 26;
    count++;
  }
  len += SPACER_SIZE + 24 + 24; // built-in gap, "+", ⚙
  count += 3;
  if (showPageSelector()) {
    len += 1 + PAGE_COUNT * PAGE_BUTTON_SIZE;
    count += 1 + PAGE_COUNT;
  }
  len += (count - 1) * 4; // spacing between items
  if (isVertical()) {
    len = Math.max(len, getBarItemCount() * 28 + 12); // minimum height of the bar
  }
  return len;
}

// Width (horizontal) or height (vertical) actually available to the bar.
// Horizontal: the smaller of the window size and the scroll view's own
// width, because a docked window can report the size of its content.
function availableLength() {
  var size = null;
  try { size = ui.size(); } catch (e) {}
  var len = 0;
  if (size) {
    len = isVertical() ? (size.height !== undefined ? size.height : size.y) :
      (size.width !== undefined ? size.width : size.x);
  }
  if (!isVertical() && mainBar && mainBar.scroll) {
    var g = null;
    try { g = mainBar.scroll.geometry(); } catch (e2) {}
    if (g && g.width > 0 && (!len || g.width < len)) {
      len = g.width;
    }
  }
  return len > 0 ? Math.round(len) : 0;
}

function updateOverflow() {
  if (sizeFree) {
    return;
  }
  var available = availableLength();
  if (!available) {
    return;
  }
  var overflowing = available < barContentLength();
  if (overflowing !== barOverflowing) {
    barOverflowing = overflowing;
    applySizeLimits();
  }
}

// Horizontal: the scroll view never gets wider than the window, so a
// docked window that is too narrow shows the horizontal scroll bar
// instead of cutting the buttons off.
var lastFitWidth = -1;
function fitScrollToWindow() {
  if (!mainBar || !mainBar.scroll) {
    return;
  }
  var size = null;
  try { size = ui.size(); } catch (e) { return; }
  var w = size ? Math.round(size.width !== undefined ? size.width : size.x) : 0;
  if (w > 0 && w !== lastFitWidth) {
    lastFitWidth = w;
    try { mainBar.scroll.setMaximumWidth(w); } catch (e2) {}
  }
}

ui.onResize = function () {
  fitScrollToWindow();
  updateOverflow();
};

// Resizing a docked panel does not always fire onResize: the horizontal
// bar also checks its size a few times per second (cheap, nothing is
// rebuilt unless the size changed).
var resizeTimer = null;
function startResizeWatch() {
  if (isVertical()) {
    return;
  }
  try {
    resizeTimer = new api.Timer({
      onTimeout: function () {
        fitScrollToWindow();
        updateOverflow();
      }
    });
    resizeTimer.setInterval(400);
    resizeTimer.setRepeating(true);
    resizeTimer.start();
  } catch (e) {}
}

function freeSize() {
  sizeFree = true;
  applySizeLimits();
  logStatus("Size unlocked: you can resize the window freely.");
}

function fitToButtons() {
  sizeFree = false;
  applySizeLimits();
}

// ============================================================
// "Add" window (nodes and scripts)
// ============================================================

var pickerContainer = null;
var pickerList = null;
var scriptPickerList = null;
var pickerTabs = null;
var pickerTitle = null;
var pickerScripts = {};
// Bar that receives what is added: this bar (+ button) or the bar
// selected in the settings.
var pickerTargetId = null;

function pickerTarget() {
  return pickerTargetId || currentBar.id;
}

function buildPickerModel() {
  var types = getAllTypes().slice();
  types.sort(function (a, b) {
    return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
  });
  var model = [];
  for (var sh = 0; sh < SHELF_LAYOUTS.length; sh++) {
    var shelfRow = { uuid: SHELF_UUID_PREFIX + SHELF_LAYOUTS[sh].layout, label: SHELF_LAYOUTS[sh].label,
                     tooltip: "Shelf action: embeds the selected layers in a new layout" };
    var shelfIcon = resolveIcon({ iconFile: SHELF_LAYOUTS[sh].iconFile });
    if (shelfIcon) {
      shelfRow.icon = shelfIcon;
    }
    model.push(shelfRow);
  }
  for (var i = 0; i < types.length; i++) {
    var row = { uuid: types[i].type, label: types[i].name, tooltip: types[i].type };
    var icon = resolveIcon({ type: types[i].type });
    if (icon) {
      row.icon = icon;
    }
    model.push(row);
  }
  return model;
}

function buildScriptPickerModel() {
  var scripts = listInstalledScripts();
  pickerScripts = {};
  var model = [];
  for (var i = 0; i < scripts.length; i++) {
    pickerScripts[scripts[i].path] = scripts[i];
    model.push({
      uuid: scripts[i].path,
      label: scripts[i].folder ? scripts[i].name + "   (" + scripts[i].folder + ")" : scripts[i].name,
      tooltip: scripts[i].path,
      icon: findScriptIcon(scripts[i].path) || (NODE_ICONS_DIR + "/javascript.png")
    });
  }
  return model;
}

function makePickerList(placeholder) {
  var list = new ui.List();
  list.showSearchBar(true);
  list.setSelectionMode("extended");
  list.setRowsRenamable(false);
  list.setRowsDeletable(false);
  list.setRowsReorderable(false);
  list.setPlaceholder(placeholder);
  return list;
}

function addSelectedFromPicker() {
  if (pickerTabs && pickerTabs.currentTab() === 1) {
    var selS = scriptPickerList.getSelection() || [];
    if (!selS.length) {
      logStatus("Select a script in the list.");
    }
    for (var j = 0; j < selS.length; j++) {
      if (pickerScripts[selS[j]]) {
        addScriptShortcut(pickerScripts[selS[j]], pickerTarget());
      }
    }
    return;
  }
  var sel = pickerList.getSelection() || [];
  if (!sel.length) {
    logStatus("Select a node in the list.");
  }
  for (var i = 0; i < sel.length; i++) {
    addPickerRow(sel[i], pickerTarget());
  }
}

function barDisplayName(id) {
  if (id === currentBar.id) {
    return currentBar.name;
  }
  var b = readBarFile(id);
  return b ? b.name : id;
}

function openPicker(targetId) {
  pickerTargetId = typeof targetId === "string" ? targetId : currentBar.id;
  // Rebuilt on every opening so the search field (first widget of the
  // window) gets the keyboard focus: type straight away.
  if (pickerContainer) {
    try { pickerContainer.close(); } catch (e0) {}
    pickerContainer = null;
  }
  pickerList = makePickerList("No nodes");
  pickerList.showSearchBar(false);
  pickerList.setModel(buildPickerModel());
  pickerList.onRowDoubleClicked = function (uuid) {
    addPickerRow(uuid, pickerTarget());
  };
  scriptPickerList = makePickerList("No scripts in the Scripts folder");
  scriptPickerList.showSearchBar(false);
  scriptPickerList.setModel(buildScriptPickerModel());
  scriptPickerList.onRowDoubleClicked = function (uuid) {
    if (pickerScripts[uuid]) {
      addScriptShortcut(pickerScripts[uuid], pickerTarget());
    }
  };

  // One search field for both tabs.
  var searchField = new ui.LineEdit();
  searchField.setPlaceholder("Search nodes and scripts…");
  searchField.onValueChanged = function () {
    var text = String(searchField.getText() || "");
    pickerList.setSearchFilter(text);
    scriptPickerList.setSearchFilter(text);
  };

  var nodesLayout = new ui.VLayout();
  nodesLayout.add(new ui.Label("Double-click a node to add it to the bar."));
  nodesLayout.add(pickerList);
  var scriptsLayout = new ui.VLayout();
  scriptsLayout.add(new ui.Label("Double-click a script: its button will open the script's panel."));
  scriptsLayout.add(scriptPickerList);

  pickerTabs = new ui.TabView();
  pickerTabs.add("Nodes", nodesLayout);
  pickerTabs.add("Scripts", scriptsLayout);

  var addBtn = new ui.Button("Add Selected");
  addBtn.onClick = addSelectedFromPicker;
  var closeBtn = new ui.Button("Close");
  closeBtn.onClick = function () {
    pickerContainer.close();
  };
  var buttons = new ui.HLayout();
  buttons.addStretch();
  buttons.add(addBtn, closeBtn);

  pickerTitle = sectionTitle("Add to bar: " + barDisplayName(pickerTargetId));

  var layout = new ui.VLayout();
  layout.setMargins(8, 8, 8, 8);
  layout.add(searchField);
  layout.add(pickerTitle);
  layout.add(pickerTabs);
  layout.add(buttons);

  pickerContainer = new ui.Container();
  pickerContainer.setMinimumWidth(320);
  pickerContainer.setMinimumHeight(480);
  pickerContainer.setLayout(layout);
  showOnTop(pickerContainer);
}

// ============================================================
// "New Bar" / "Duplicate Bar" window
// ============================================================

var barDialog = null;
var barDialogTitle = null;
var barDialogName = null;
var barDialogH = null;
var barDialogV = null;
var barDialogCreate = null;
var barDialogSourceId = null; // null = new empty bar

// Two checkboxes that behave like radio buttons.
function makeRadioPair(hCheck, vCheck) {
  var busy = false;
  hCheck.onValueChanged = function () {
    if (busy) { return; }
    busy = true;
    vCheck.setValue(!hCheck.getValue());
    busy = false;
  };
  vCheck.onValueChanged = function () {
    if (busy) { return; }
    busy = true;
    hCheck.setValue(!vCheck.getValue());
    busy = false;
  };
}

function radioRow(hCheck, vCheck) {
  var row = new ui.HLayout();
  row.add(hCheck, new ui.Label("Horizontal"));
  row.addSpacing(16);
  row.add(vCheck, new ui.Label("Vertical"));
  row.addStretch();
  return row;
}

function openBarDialog(sourceId) {
  barDialogSourceId = sourceId || null;
  if (!barDialog) {
    barDialogTitle = sectionTitle("");
    barDialogName = new ui.LineEdit();
    barDialogName.setPlaceholder("e.g. Animation, Text, Effects…");
    barDialogH = new ui.Checkbox(true);
    barDialogV = new ui.Checkbox(false);
    makeRadioPair(barDialogH, barDialogV);

    barDialogCreate = new ui.Button("Create Bar");
    barDialogCreate.onClick = function () {
      var shortcuts = barDialogSourceId ? getBarShortcuts(barDialogSourceId) : [];
      var bar = createBar(barDialogName.getText(), barDialogV.getValue() ? "vertical" : "horizontal", shortcuts);
      if (bar) {
        barDialog.close();
      }
    };
    var cancelBtn = new ui.Button("Cancel");
    cancelBtn.onClick = function () {
      barDialog.close();
    };
    var buttons = new ui.HLayout();
    buttons.addStretch();
    buttons.add(cancelBtn, barDialogCreate);

    var layout = new ui.VLayout();
    layout.setMargins(10, 10, 10, 10);
    layout.add(barDialogTitle);
    layout.addSpacing(4);
    layout.add(new ui.Label("Bar name"));
    layout.add(barDialogName);
    layout.addSpacing(6);
    layout.add(new ui.Label("Orientation"));
    layout.add(radioRow(barDialogH, barDialogV));
    layout.addSpacing(6);
    layout.add(new ui.Label("The bar opens straight away and stays available\nin the Scripts > C_Bar menu."));
    layout.addStretch();
    layout.add(buttons);

    barDialog = new ui.Container();
    barDialog.setMinimumWidth(320);
    barDialog.setMinimumHeight(220);
    barDialog.setLayout(layout);
  }
  var vertical = false;
  if (barDialogSourceId) {
    var src = barDialogSourceId === currentBar.id ? currentBar : readBarFile(barDialogSourceId);
    var srcName = src ? src.name : barDialogSourceId;
    vertical = !!(src && src.orientation === "vertical");
    barDialogTitle.setText("Duplicate \"" + srcName + "\"");
    barDialogName.setText(srcName + " copy");
    barDialogCreate.setText("Duplicate");
  } else {
    barDialogTitle.setText("New Bar (empty)");
    barDialogName.setText("");
    barDialogCreate.setText("Create Bar");
  }
  barDialogH.setValue(!vertical);
  barDialogV.setValue(vertical);
  showOnTop(barDialog);
}

function openNewBarDialog() {
  openBarDialog(null);
}

// ============================================================
// "Settings" window (⚙)
// ============================================================
// Top: the shortcuts of the bar selected below.
// Bottom: every bar; "..." menu: Open, Duplicate, Rename, Delete.

var managerContainer = null;
var managerList = null;
var resetBtn = null;
var hidePagesCheck = null;
var updatingPagesCheck = false;
var barsList = null;
var editedBarId = currentBar.id;

function editedBarName() {
  return barDisplayName(editedBarId);
}

// Settings shows the shortcuts of one page at a time (managerPage),
// chosen with its own 1 2 3 4 selector.
var managerPage = 1;
var managerPageButtons = {};

function buildManagerModel() {
  var all = getBarShortcuts(editedBarId);
  var model = [];
  for (var i = 0; i < all.length; i++) {
    var s = all[i];
    if (pageOf(s) !== managerPage) {
      continue;
    }
    if (s.kind === "spacer") {
      model.push({ uuid: s.uid, label: "────  " + (s.label || "Spacer") + "  ────",
                   tooltip: "Empty gap between shortcuts", threeDotsMenu: true });
      continue;
    }
    var row = {
      uuid: s.uid,
      label: (s.preset ? "♥ " : "") + (s.kind === "expression" ? " π  " : "") + (s.kind === "keys" ? "⌨  " : "") + s.label,
      tooltip: (s.preset ? "Favourite — " : "") + (s.kind === "script" ? fromPortablePath(s.path) :
        (s.kind === "keys" ? "Cavalry shortcut: " + prettyKeys(s.keys) : s.kind === "expression" ? "Expression: " + s.expression :
          (s.kind === "rig" ? "Rig — " + (s.description || s.label) :
          s.kind === "layout" ? "Shelf action" :
            (s.type || s.nodeName || "")))),
      threeDotsMenu: true
    };
    var icon = (s.kind === "expression" || (s.kind === "keys" && !customIconFor(s))) ? null :
      (resolveIcon(s) || (s.kind === "script" ? NODE_ICONS_DIR + "/javascript.png" : null));
    if (icon) {
      row.icon = icon;
    }
    model.push(row);
  }
  return model;
}

function createManagerPageButton(n) {
  var d = new ui.Draw();
  d.setSize(PAGE_BUTTON_SIZE, PAGE_BUTTON_SIZE);
  try { d.setBackgroundColor(ui.getThemeColor("Window")); } catch (e) {}
  d.setToolTip("Show the shortcuts of page " + n);
  d.onMousePress = function (position, button) {
    if (button === "left" && managerPage !== n) {
      managerPage = n;
      refreshManagerPageButtons();
      onBarsChanged();
    }
  };
  managerPageButtons[n] = d;
  return d;
}

function refreshManagerPageButtons() {
  for (var n = 1; n <= PAGE_COUNT; n++) {
    if (managerPageButtons[n]) {
      paintPageButton(managerPageButtons[n], n, false, managerPage);
    }
  }
}

// Page a shortcut added now goes to: the page shown in Settings for the
// bar edited there, otherwise the page shown on this bar (page 1 for
// another bar).
function pageForNewShortcut(id) {
  if (settingsVisible() && id === editedBarId) {
    return managerPage;
  }
  return id === currentBar.id ? currentPage : 1;
}

function buildBarsModel() {
  var bars = listBars();
  var model = [];
  var accent = "#3e8ed0";
  try { accent = ui.getThemeColor("Accent1"); } catch (e) {}
  for (var i = 0; i < bars.length; i++) {
    var b = bars[i];
    var row = {
      uuid: b.id,
      label: b.name + "   · " + (b.orientation === "vertical" ? "vertical" : "horizontal") + ", " +
        (b.shortcuts ? b.shortcuts.length : 0) + " shortcut(s)",
      tooltip: (b.id === "default" ? "C-Bar.js" : (b.script || "")) + " — click to edit its shortcuts, \"...\" for more options",
      threeDotsMenu: true
    };
    if (b.id === editedBarId) {
      row.borderColor = accent;
      row.borderWidth = 1;
    }
    model.push(row);
  }
  return model;
}

// Refreshes the panel after a change (shortcuts or bars).
function onBarsChanged() {
  if (!managerContainer) {
    return;
  }
  if (editedBarId !== currentBar.id && !readBarFile(editedBarId)) {
    editedBarId = currentBar.id;
  }
  resetBtn.setText(editedBarId === "default" ? "Reset" : "Clear Bar");
  updatingPagesCheck = true;
  hidePagesCheck.setValue(getBarHidePages(editedBarId));
  updatingPagesCheck = false;
  managerList.setModel(buildManagerModel());
  barsList.setModel(buildBarsModel());
}

function selectEditedBar(id) {
  if (!id || id === editedBarId) {
    return;
  }
  editedBarId = id;
  onBarsChanged();
}

function indexOfUidIn(list, uid) {
  for (var i = 0; i < list.length; i++) {
    if (list[i].uid === uid) {
      return i;
    }
  }
  return -1;
}

function sectionTitle(text) {
  var l = new ui.Label(text);
  try { l.setTextColor(ui.getThemeColor("Accent1")); } catch (e) {}
  return l;
}

// ------------------------------------------------------------
// Settings: the bars list always shows 4 bars; the shortcuts list
// takes the rest of the height.
// ------------------------------------------------------------
var BARS_ROW_HEIGHT = 26;

function defaultBarsListHeight() {
  return BARS_ROW_HEIGHT * 4 + 8; // 4 bars
}

function openManager() {
  // The panel is rebuilt on every opening: a reused ui.List swaps the
  // order of its colour chip and its icon once it has been shown.
  if (managerContainer) {
    try { managerContainer.close(); } catch (e) {}
    managerContainer = null;
  }
  {
    // --- Shortcuts of the selected bar ---
    managerList = new ui.List();
    // Shift / Cmd + click: several shortcuts can be moved, deleted or
    // sent to another page at once.
    managerList.setSelectionMode("extended");
    managerList.setRowsRenamable(true);
    managerList.setRowsDeletable(true);
    managerList.setRowsReorderable(true);
    managerList.setPlaceholder("Empty bar — use \"Add…\" or the + button on the bar");

    managerList.onRowDeleted = function (uid) {
      mutateBarShortcuts(editedBarId, function (l) {
        var idx = indexOfUidIn(l, uid);
        if (idx !== -1) {
          l.splice(idx, 1);
        }
      });
    };
    managerList.onRowRenamed = function (uid, newName) {
      if (!newName) {
        return;
      }
      mutateBarShortcuts(editedBarId, function (l) {
        var idx = indexOfUidIn(l, uid);
        if (idx !== -1) {
          l[idx].label = l[idx].kind === "spacer" ?
            (String(newName).replace(/\s*\(Page \d\)\s*$/, "").replace(/^[─\s]+|[─\s]+$/g, "") || "Spacer") :
            String(newName).replace(/^\s*(♥|π)\s*/, "").replace(/\s*\([^()]*\)\s*$/, "");
        }
      });
    };
    // Only the page shown is reordered: its shortcuts take, in the new
    // order, the places they had in the bar (other pages are untouched).
    managerList.onReorder = function () {
      var model = managerList.getModel() || [];
      mutateBarShortcuts(editedBarId, function (l) {
        var ordered = [];
        for (var i = 0; i < model.length; i++) {
          var idx = indexOfUidIn(l, model[i].uuid);
          if (idx !== -1) {
            ordered.push(l[idx]);
          }
        }
        var slots = [];
        for (var j = 0; j < l.length; j++) {
          if (pageOf(l[j]) === managerPage) {
            slots.push(j);
          }
        }
        if (slots.length !== ordered.length) {
          return;
        }
        var out = l.slice();
        for (var k = 0; k < slots.length; k++) {
          out[slots[k]] = ordered[k];
        }
        return out;
      });
    };
    managerList.onContextMenuRequest = function (uid) {
      var items = [];
      var l0 = getBarShortcuts(editedBarId);
      var i0 = indexOfUidIn(l0, uid);
      // Rename / Delete are provided by the list itself.
      if (i0 !== -1 && l0[i0].kind === "expression") {
        items.push({ label: "Edit Expression…", id: "expr_edit" });
        items.push({ separator: true });
      }
      if (i0 !== -1 && l0[i0].kind === "keys") {
        items.push({ label: "Edit Shortcut as Button…", id: "keys_edit" });
        items.push({ separator: true });
      }
      if (i0 !== -1 && l0[i0].kind !== "spacer") {
        items = items.concat(iconMenuEntries(l0[i0]));
        items.push({ separator: true });
      }
      var page0 = i0 !== -1 ? pageOf(l0[i0]) : 0;
      for (var p = 1; p <= PAGE_COUNT; p++) {
        if (p !== page0) {
          items.push({ label: "Move to Page " + p, id: "page_" + p });
        }
      }
      return items;
    };
    managerList.onContextMenuAction = function (uid, actionId) {
      if (actionId === "expr_edit") {
        openExpressionDialog(editedBarId, uid);
        return;
      }
      if (actionId === "keys_edit") {
        openKeysDialog(editedBarId, uid);
        return;
      }
      if (runIconMenuAction(editedBarId, uid, actionId)) {
        return;
      }
      if (actionId.indexOf("page_") !== 0) {
        return;
      }
      // Applied to every selected row when the clicked row is selected.
      var uids = [uid];
      var selected = [];
      try { selected = managerList.getSelection() || []; } catch (eSel) {}
      if (selected.indexOf(uid) !== -1) {
        uids = selected;
      }
      mutateBarShortcuts(editedBarId, function (l) {
        for (var u = 0; u < uids.length; u++) {
          var idx = indexOfUidIn(l, uids[u]);
          if (idx !== -1) {
            l[idx].page = parseInt(actionId.substr(5), 10);
          }
        }
      });
    };

    var addBtn = new ui.Button("Add…");
    addBtn.onClick = function () {
      showAddMenu(editedBarId);
    };
    resetBtn = new ui.Button("Reset");
    resetBtn.onClick = function () {
      var isDefault = editedBarId === "default";
      var question = isDefault ? "Restore the original shortcuts of the Default bar?" :
        "Remove every shortcut from \"" + editedBarName() + "\"?";
      if (aboveSettings(function () { return new ui.Modal().showConfirmation("C-Bar", question); })) {
        mutateBarShortcuts(editedBarId, function () {
          return isDefault ? buildDefaultShortcuts() : [];
        });
      }
    };
    hidePagesCheck = new ui.Checkbox(false);
    hidePagesCheck.onValueChanged = function () {
      if (updatingPagesCheck) {
        return;
      }
      setBarProperty(editedBarId, "hidePages", hidePagesCheck.getValue());
    };
    var spacerBtn = new ui.Button("Spacer");
    spacerBtn.onClick = function () {
      addSpacer(editedBarId);
    };
    var shortcutButtons = new ui.HLayout();
    shortcutButtons.add(addBtn, spacerBtn, resetBtn);
    shortcutButtons.addStretch();
    shortcutButtons.add(hidePagesCheck, new ui.Label("Hide page selector"));

    // --- Bars ---
    barsList = new ui.List();
    // Fixed height (4 bars): the shortcuts list takes the remaining space.
    try { barsList.setRowHeight(BARS_ROW_HEIGHT); } catch (eRow) {}
    barsList.setFixedHeight(defaultBarsListHeight());
    barsList.setSelectionMode("single");
    barsList.setRowsRenamable(false);
    barsList.setRowsDeletable(false);
    barsList.setRowsReorderable(false);
    barsList.onSelectionChanged = function (uuids) {
      if (uuids && uuids.length) {
        selectEditedBar(uuids[0]);
      }
    };
    barsList.onRowDoubleClicked = function (id) {
      if (id !== currentBar.id) {
        openBar(id);
      }
    };
    barsList.onContextMenuRequest = function (id) {
      var items = [];
      if (id !== currentBar.id) {
        items.push({ label: "Open", id: "open" });
      }
      items.push({ label: "Duplicate…", id: "duplicate" });
      items.push({ label: "Rename…", id: "rename" });
      var b0 = readBarFile(id);
      items.push({ label: b0 && b0.orientation === "vertical" ? "Switch to Horizontal" : "Switch to Vertical", id: "switch" });
      items.push({ label: "Export Bar…", id: "export" });
      if (id !== "default") {
        items.push({ separator: true });
        items.push({ label: "Delete", id: "delete" });
      }
      return items;
    };
    barsList.onContextMenuAction = function (id, actionId) {
      if (actionId === "open") {
        openBar(id);
      } else if (actionId === "duplicate") {
        openBarDialog(id);
      } else if (actionId === "rename") {
        renameBar(id);
      } else if (actionId === "export") {
        exportBar(id);
      } else if (actionId === "switch") {
        switchBarOrientation(id);
      } else if (actionId === "delete") {
        deleteBar(id);
      }
    };

    // "Bar…": New Bar… / Import Bar… / Export Bar… / — / Update Bars.
    var barMenuBtn = new ui.Button("Bar…");
    barMenuBtn.setToolTip("New, import or export a bar (the one selected in the list), regenerate the bar scripts");
    barMenuBtn.onClick = showBarActionsMenu;
    var barButtons = new ui.HLayout();
    // "Config…": Config Import… / Config Export… / Open Folder.
    var configBtn = new ui.Button("Config…");
    configBtn.setToolTip("Import or export the whole configuration (bars and rigs), open the C-Bar folder");
    configBtn.onClick = showConfigMenu;
    barButtons.add(barMenuBtn);
    barButtons.addStretch();
    barButtons.add(configBtn, createUpdateButton(), createInfoButton());

    var closeBtn = new ui.Button("Close");
    closeBtn.onClick = function () {
      managerContainer.close();
    };
    var closeRow = new ui.HLayout();
    closeRow.addStretch();
    closeRow.add(closeBtn);

    var layout = new ui.VLayout();
    layout.setMargins(10, 10, 10, 10);
    var pageRow = new ui.HLayout();
    pageRow.setSpaceBetween(4);
    pageRow.addStretch();
    pageRow.add(new ui.Label("Page"));
    managerPageButtons = {};
    for (var pg = 1; pg <= PAGE_COUNT; pg++) {
      pageRow.add(createManagerPageButton(pg));
    }
    // Tip on its own line, across the whole width of the panel.
    var layoutHint = new ui.Label("Tip: hold the mouse 1.5 s on an empty part of a bar (or right-click > Organize Layout) to arrange it directly on the bar.");
    try { layoutHint.setTextColor("#9a9a9a"); } catch (eHint) {}
    layout.add(layoutHint);
    layout.add(pageRow);
    layout.add(new ui.Label("Drag to reorder, double-click to rename, \"...\" to move to another page."));
    layout.add(managerList);
    layout.add(shortcutButtons);
    layout.addSpacing(10);
    layout.add(sectionTitle("Bars"));
    layout.add(new ui.Label("Click: edit its shortcuts above · double-click: open it · \"...\": more actions."));
    layout.add(barsList);
    layout.add(barButtons);
    layout.addSpacing(4);
    layout.add(closeRow);

    managerContainer = new ui.Container();
    managerContainer.setMinimumWidth(760);
    managerContainer.setMinimumHeight(600);
    managerContainer.setLayout(layout);
  }
  cancelLongPress();
  editedBarId = currentBar.id;
  managerPage = currentPage;
  refreshManagerPageButtons();
  onBarsChanged();
  frontWindow = null; // Settings is now the front window
  managerContainer.show();
  checkForUpdateSoon();
}

// ============================================================
// Import / Export of the configuration
// ============================================================
// One ".cbar" file (JSON) holding the selected sections. New sections
// only need an entry in CONFIG_SECTIONS.

var CONFIG_FORMAT = "C-Bar config";
var CONFIG_FILTER = "C-Bar config (*.cbar *.json)";

function listRigIds() {
  var out = [];
  if (!api.filePathExists(RIGS_DIR)) {
    return out;
  }
  var files = api.listDirectory(RIGS_DIR) || [];
  for (var i = 0; i < files.length; i++) {
    var m = String(files[i]).match(/([^\/\\]+)\.json$/i);
    if (m) {
      out.push(m[1]);
    }
  }
  return out;
}

var CONFIG_SECTIONS = [
  {
    key: "bars",
    label: "Bars (shortcuts, orientation, settings)",
    count: function () { return listBars().length; },
    exportData: function () { return listBars(); },
    importData: function (bars) {
      var n = 0;
      for (var i = 0; i < (bars || []).length; i++) {
        var bar = bars[i];
        if (!bar || !bar.id) {
          continue;
        }
        if (bar.id !== "default" && !bar.script) {
          bar.script = "C-Bar_" + fileSafeName(bar.name || bar.id) + ".js";
        }
        if (bar.id === "default") {
          bar.script = "C-Bar.js";
        }
        if (writeBarFile(bar)) {
          if (bar.id !== "default") {
            writeBarScript(bar);
          }
          n++;
        }
      }
      return n + " bar(s)";
    }
  },
  {
    key: "rigs",
    label: "Rigs",
    count: function () { return listRigIds().length; },
    exportData: function () {
      var out = {};
      var ids = listRigIds();
      for (var i = 0; i < ids.length; i++) {
        var rig = readRig(ids[i]);
        if (rig) {
          out[ids[i]] = rig;
        }
      }
      return out;
    },
    importData: function (rigs) {
      ensureFolder(RIGS_DIR);
      var n = 0;
      for (var id in (rigs || {})) {
        try {
          api.writeToFile(rigFilePath(id), JSON.stringify(rigs[id]), true);
          n++;
        } catch (e) {
          logStatus("Could not import the rig " + id + ": " + e);
        }
      }
      return n + " rig(s)";
    }
  }
];

function configStartFolder() {
  var dir = "";
  try { dir = api.getDownloadsFolder(); } catch (e) {}
  if (!dir) {
    try { dir = api.getHomeFolder(); } catch (e2) {}
  }
  return dir || SCRIPT_DIR;
}

function chooseConfigFile(mode) {
  var start = configStartFolder();
  var path = "";
  if (mode === "export") {
    try {
      path = aboveSettings(function () { return api.presentSaveFile(start, "Export C-Bar Config", CONFIG_FILTER, "C-Bar_Config.cbar"); });
    } catch (e) {
      try { path = ui.chooseFileToSave(start + "/C-Bar_Config.cbar", CONFIG_FILTER); } catch (e2) {}
    }
  } else {
    try {
      path = aboveSettings(function () { return api.presentOpenFile(start, "Import C-Bar Config", CONFIG_FILTER); });
    } catch (e3) {
      try { path = ui.chooseFileToOpen(start, CONFIG_FILTER); } catch (e4) {}
    }
  }
  return path ? String(path) : "";
}

// ------------------------------------------------------------
// Export / Import of a single bar ("..." > Export Bar…, Import Bar…)
// ------------------------------------------------------------
// The file holds everything the bar needs: its shortcuts (expressions
// included), the rigs it recalls, the scripts it runs and the custom
// icons it shows.

var BAR_FORMAT = "C-Bar bar";
var SCRIPTS_COPY_DIR = ASSETS_DIR + "/scripts";

function isInFolder(path, dir) {
  return String(path || "").indexOf(dir + "/") === 0;
}

function exportBar(id) {
  var bar = readBarFile(id);
  if (!bar) {
    return;
  }
  var pack = { format: BAR_FORMAT, version: 1, exported: new Date().toISOString(),
               bar: bar, rigs: {}, scripts: {}, icons: {} };
  var list = bar.shortcuts || [];
  for (var i = 0; i < list.length; i++) {
    var s = list[i];
    if (s.kind === "rig" && s.rig && !pack.rigs[s.rig]) {
      var rig = readRig(s.rig);
      if (rig) {
        delete rig.scene; // a bar is shared: no local file path in it
        pack.rigs[s.rig] = rig;
      }
    }
    if (s.kind === "script" && s.path && !pack.scripts[toPortablePath(s.path)] && api.filePathExists(fromPortablePath(s.path))) {
      try { pack.scripts[toPortablePath(s.path)] = api.readFromFile(fromPortablePath(s.path)); } catch (e) {}
    }
    var icon = null;
    try { icon = resolveIcon(s); } catch (e2) {}
    if (icon && isInFolder(icon, ICONS_DIR)) {
      // Relative to the icons folder: "Null.png", "base/bolt_40px.png".
      var iconName = String(icon).substr(ICONS_DIR.length + 1).replace(/\\/g, "/");
      if (!pack.icons[iconName]) {
        try { pack.icons[iconName] = api.encodeBinary(icon); } catch (e3) {}
      }
    }
  }
  var start = configStartFolder();
  var fileName = "C-Bar_" + fileSafeName(bar.name || id) + ".cbar";
  var path = "";
  try {
    path = aboveSettings(function () { return api.presentSaveFile(start, "Export Bar", CONFIG_FILTER, fileName); });
  } catch (e4) {
    try { path = ui.chooseFileToSave(start + "/" + fileName, CONFIG_FILTER); } catch (e5) {}
  }
  if (!path) {
    return;
  }
  path = String(path);
  if (!/\.(cbar|json)$/i.test(path)) {
    path += ".cbar";
  }
  try {
    api.writeToFile(path, JSON.stringify(pack, null, 1), true);
  } catch (e6) {
    showMessage("Could not write the file");
    return;
  }
  var nRigs = Object.keys(pack.rigs).length;
  var nScripts = Object.keys(pack.scripts).length;
  showMessage("Bar exported");
  logStatus("Bar \"" + bar.name + "\" exported (" + list.length + " shortcut(s), " + nRigs + " rig(s), " +
    nScripts + " script(s)): " + path);
}

// Free bar name: "Name", "Name 2", "Name 3"…
function freeBarName(name) {
  name = trimName(name) || "Imported Bar";
  if (slugify(name) === "default") {
    name = "Default Imported";
  }
  var candidate = name;
  var n = 2;
  while (checkBarName(candidate, null)) {
    candidate = name + " " + n;
    n++;
  }
  return candidate;
}

function importBar() {
  var path = chooseConfigFile("import");
  if (!path) {
    return;
  }
  var pack = null;
  try { pack = JSON.parse(api.readFromFile(path)); } catch (e) {}
  if (!pack || pack.format !== BAR_FORMAT || !pack.bar) {
    showMessage(pack && pack.format === CONFIG_FORMAT ? "This is a full config: use Config > Config Import" : "Not a C-Bar bar file");
    return;
  }
  var shortcuts = JSON.parse(JSON.stringify(pack.bar.shortcuts || []));

  // Rigs: kept as is when identical, otherwise saved under a free id.
  var rigIds = {};
  ensureFolder(RIGS_DIR);
  for (var rigId in (pack.rigs || {})) {
    var text = JSON.stringify(pack.rigs[rigId]);
    var target = rigId;
    var n = 2;
    while (api.filePathExists(rigFilePath(target)) && api.readFromFile(rigFilePath(target)) !== text) {
      target = rigId + "-" + n;
      n++;
    }
    if (!api.filePathExists(rigFilePath(target))) {
      api.writeToFile(rigFilePath(target), text, true);
    }
    rigIds[rigId] = target;
  }

  // Scripts: copied into C-Bar_assets/scripts when missing here.
  var scriptPaths = {};
  for (var sp in (pack.scripts || {})) {
    if (api.filePathExists(fromPortablePath(sp))) {
      scriptPaths[toPortablePath(sp)] = toPortablePath(sp);
      continue;
    }
    ensureFolder(SCRIPTS_COPY_DIR);
    var copy = SCRIPTS_COPY_DIR + "/" + String(sp).split(/[\/\\]/).pop();
    if (!api.filePathExists(copy)) {
      try { api.writeToFile(copy, pack.scripts[sp], true); } catch (e2) {}
    }
    scriptPaths[toPortablePath(sp)] = toPortablePath(copy);
  }

  // Icons: added to C-Bar_assets/icons when missing.
  for (var iconName in (pack.icons || {})) {
    if (/(^|\/)\.\.(\/|$)/.test(iconName)) {
      continue;
    }
    var iconPath = ICONS_DIR + "/" + iconName;
    if (!api.filePathExists(iconPath)) {
      if (iconName.indexOf("/") !== -1) {
        ensureFolder(iconPath.replace(/\/[^\/]+$/, ""));
      }
      try { api.writeEncodedToBinaryFile(iconPath, pack.icons[iconName]); } catch (e3) {}
    }
  }

  for (var i = 0; i < shortcuts.length; i++) {
    var s = shortcuts[i];
    if (s.kind === "rig" && rigIds[s.rig]) {
      s.rig = rigIds[s.rig];
    }
    if (s.kind === "script" && scriptPaths[toPortablePath(s.path)]) {
      s.path = scriptPaths[toPortablePath(s.path)];
    }
  }

  var name = freeBarName(pack.bar.name);
  var bar = createBar(name, pack.bar.orientation, shortcuts);
  if (!bar) {
    return;
  }
  if (pack.bar.hidePages === true) {
    setBarProperty(bar.id, "hidePages", true);
  }
  logStatus("Bar imported as \"" + name + "\" from " + path);
}

function exportConfig(keys) {
  var path = chooseConfigFile("export");
  if (!path) {
    return;
  }
  if (!/\.(cbar|json)$/i.test(path)) {
    path += ".cbar";
  }
  var data = { format: CONFIG_FORMAT, version: 1, exported: new Date().toISOString(), sections: {} };
  var done = [];
  for (var i = 0; i < CONFIG_SECTIONS.length; i++) {
    var sec = CONFIG_SECTIONS[i];
    if (keys.indexOf(sec.key) !== -1) {
      data.sections[sec.key] = sec.exportData();
      done.push(sec.key);
    }
  }
  try {
    api.writeToFile(path, JSON.stringify(data, null, 1), true);
  } catch (e) {
    showMessage("Could not write the file");
    logStatus("Export failed (" + path + "): " + e);
    return;
  }
  showMessage("Config exported");
  logStatus("C-Bar config exported (" + done.join(", ") + "): " + path);
}

function importConfig(keys) {
  var path = chooseConfigFile("import");
  if (!path) {
    return;
  }
  var data = null;
  try { data = JSON.parse(api.readFromFile(path)); } catch (e) {}
  if (!data || data.format !== CONFIG_FORMAT || !data.sections) {
    showMessage(data && data.format === BAR_FORMAT ? "This is a single bar: use Import Bar" : "Not a C-Bar config file");
    return;
  }
  var found = [];
  for (var i = 0; i < CONFIG_SECTIONS.length; i++) {
    if (keys.indexOf(CONFIG_SECTIONS[i].key) !== -1 && data.sections[CONFIG_SECTIONS[i].key]) {
      found.push(CONFIG_SECTIONS[i]);
    }
  }
  if (!found.length) {
    showMessage("Nothing to import from this file");
    return;
  }
  if (!aboveSettings(function () { return new ui.Modal().showConfirmation("C-Bar",
      "Bars and rigs with the same name will be replaced. Continue?"); })) {
    return;
  }
  var report = [];
  for (var j = 0; j < found.length; j++) {
    report.push(found[j].importData(data.sections[found[j].key]));
  }
  onBarsChanged();
  showMessage("Imported: " + report.join(", "));
  logStatus("C-Bar config imported from " + path + ": " + report.join(", ") +
    ". Open bars reload their shortcuts automatically; reopen a bar to apply a new orientation.");
}

var configDialog = null;
var configDialogTitle = null;
var configDialogBtn = null;
var configChecks = {};
var configMode = "export";

function openConfigDialog(mode) {
  configMode = mode;
  if (configDialog) {
    try { configDialog.close(); } catch (e0) {}
  }
  configDialogTitle = sectionTitle("");
  configDialogBtn = new ui.Button("");
  var layout = new ui.VLayout();
  layout.setMargins(10, 10, 10, 10);
  layout.add(configDialogTitle);
  layout.addSpacing(6);
  configChecks = {};
  for (var i = 0; i < CONFIG_SECTIONS.length; i++) {
    var sec = CONFIG_SECTIONS[i];
    configChecks[sec.key] = new ui.Checkbox(true);
    var label = sec.label;
    if (mode === "export") {
      label += "  (" + sec.count() + ")";
    }
    layout.add(rigCheckRow(configChecks[sec.key], label));
  }
  layout.addStretch();
  var cancelBtn = new ui.Button("Cancel");
  cancelBtn.onClick = function () {
    configDialog.close();
  };
  configDialogBtn.onClick = function () {
    var keys = [];
    for (var k in configChecks) {
      if (configChecks[k].getValue()) {
        keys.push(k);
      }
    }
    if (!keys.length) {
      showMessage("Select at least one item");
      return;
    }
    configDialog.close();
    if (configMode === "export") {
      exportConfig(keys);
    } else {
      importConfig(keys);
    }
  };
  var buttons = new ui.HLayout();
  buttons.addStretch();
  buttons.add(cancelBtn, configDialogBtn);
  layout.add(buttons);
  configDialogTitle.setText(mode === "export" ? "Config Export" : "Config Import");
  configDialogBtn.setText(mode === "export" ? "Export…" : "Import…");
  configDialog = new ui.Container();
  configDialog.setMinimumWidth(380);
  configDialog.setMinimumHeight(60 + CONFIG_SECTIONS.length * 28 + 50);
  configDialog.setLayout(layout);
  showOnTop(configDialog);
}

function openFolder(dir) {
  try {
    if (IS_MAC) {
      api.runDetachedProcess("/usr/bin/open", [dir]);
    } else {
      api.runDetachedProcess("explorer", [dir.replace(/\//g, "\\")]);
    }
  } catch (e) {
    logStatus("Folder: " + dir);
  }
}

function openScriptFolder() {
  openFolder(SCRIPT_DIR);
}

function openIconsFolder() {
  openFolder(CUSTOM_ICONS_DIR);
}

// ============================================================
// Right-click menu and launch
// ============================================================

// The window has a single context menu: the "+" button swaps in its own
// short menu, shows it, then puts the right-click menu back.
function buildMainMenu() {
  ui.clearContextMenu();
  // First entry: easy to find with a right-click anywhere on the bar.
  ui.addMenuItem({ name: editMode ? "Done Organizing Layout" : "Organize Layout", onMouseRelease: toggleEditMode });
  ui.addMenuItem({ name: "" });
  addMenuEntries(currentBar.id);
  ui.addMenuItem({ name: "Settings…", onMouseRelease: openManager });
  ui.addMenuItem({ name: "" });
  ui.addMenuItem({ name: "New Bar…", onMouseRelease: openNewBarDialog });
  ui.addMenuItem({ name: "Open Script Icons Folder", onMouseRelease: openIconsFolder });
  ui.addMenuItem({ name: "" });
  ui.addMenuItem({ name: "Unlock Size (resize)", onMouseRelease: freeSize });
  ui.addMenuItem({ name: "Fit Bar to Buttons", onMouseRelease: fitToButtons });
}

// Buttons of the bar (shortcuts, +, ⚙): a press on one of them is not
// a press on an empty part of the bar.
var barItemWidgets = [];

function barItem(widget) {
  barItemWidgets.push(widget);
  return widget;
}

// Converts a press on the bar container (local, y-up) to screen
// coordinates and checks it against the buttons. When the geometry is
// not available, the press counts as being on a button (no long press:
// the right-click menu and Organize Layout stay available).
function pressIsOnBarItem(container, position) {
  var g = null;
  try { g = container.geometry(); } catch (e) {}
  if (!g || !position) {
    return true;
  }
  var h = g.height !== undefined ? g.height : (g.bottom - g.top);
  var x = g.left + position.x;
  var y = g.top + (h - position.y);
  for (var i = 0; i < barItemWidgets.length; i++) {
    var b = null;
    try { b = barItemWidgets[i].geometry(); } catch (e2) {}
    if (b && x >= b.left - 2 && x <= b.right + 2 && y >= b.top - 2 && y <= b.bottom + 2) {
      return true;
    }
  }
  return false;
}

// A Container or ui.Draw with a mouse callback keeps the right-click for
// itself, so the window's own context menu does not open there: the bar
// and its page buttons open it themselves.
function showBarMenu() {
  cancelLongPress();
  buildMainMenu();
  ui.showContextMenu();
}

var menuRestoreTimer = null;
function restoreMainMenuSoon() {
  try {
    if (!menuRestoreTimer) {
      menuRestoreTimer = new api.Timer({
        onTimeout: function () {
          buildMainMenu();
        }
      });
      menuRestoreTimer.setRepeating(false);
      menuRestoreTimer.setInterval(150);
    }
    menuRestoreTimer.start();
  } catch (e) {
    buildMainMenu();
  }
}

// ------------------------------------------------------------
// Alt + click: choose the attribute to drive
// ------------------------------------------------------------
// With one layer selected, Alt + click on a node shortcut opens a menu
// of that layer's numeric attributes. The node is created and linked
// to the chosen one (same rules as a selected attribute).

// Node shortcuts only (no scripts, spacers, shapes or filters).
function canPickAttribute(shortcut) {
  if (shortcut.kind === "script" || shortcut.kind === "spacer" || shortcut.kind === "expression" || shortcut.kind === "rig" || shortcut.kind === "layout" || shortcut.kind === "keys") {
    return false;
  }
  var cat = getShortcutCategory(shortcut);
  return cat !== "shape" && cat !== "effect";
}

var PICKABLE_TYPES = ["double", "int", "double2", "int2", "double3", "int3", "color", "string", "richText"];
// Attributes never offered in the Alt + click menu (layer bookkeeping
// strings: name, notes, label colour…).
var SKIPPED_ATTRS = ["niceName", "userData", "uuid", "notes", "color", "graph"];

// 2D / 3D attributes get Cavalry's own "constrain proportions" chain
// icon; 1D and colour attributes have no icon.
var VECTOR_ICON = api.getAppAssetsPath() + "/Icons/constrainProportionsOn.png";

function typeIconFor(kind) {
  if ((kind === "2d" || kind === "3d") && api.filePathExists(VECTOR_ICON)) {
    return VECTOR_ICON;
  }
  return "";
}

// ------------------------------------------------------------
// Cavalry definitions (Attribute Editor tabs and node outputs)
// ------------------------------------------------------------
// Read once from Cavalry.app/Contents/assets/Definitions:
//   nodeDefinitions.json         → tabs, attribute order, output types
//   nodeStrings_en-GB.source.json → tab names

var nodeDefsByType = null;
var nodeTabNames = null;
var nodeAttrNames = null;

function loadNodeDefinitions() {
  if (nodeDefsByType) {
    return;
  }
  nodeDefsByType = {};
  nodeTabNames = {};
  nodeAttrNames = {};
  try {
    var defs = JSON.parse(api.readFromFile(api.getAppAssetsPath() + "/Definitions/nodeDefinitions.json"));
    for (var i = 0; i < defs.length; i++) {
      if (defs[i] && defs[i].nodeType) {
        nodeDefsByType[defs[i].nodeType] = defs[i];
      }
    }
  } catch (e) {
    logStatus("Could not read Cavalry's node definitions: " + e);
  }
  try {
    var strings = JSON.parse(api.readFromFile(api.getAppAssetsPath() + "/Definitions/Translation/nodeStrings_en-GB.source.json"));
    // Entries hold either one node ("value") or several ("values").
    var nodes = [];
    for (var j = 0; j < strings.length; j++) {
      var e = strings[j] || {};
      if (e.value) { nodes.push(e.value); }
      if (e.values && e.values.length) { nodes = nodes.concat(e.values); }
    }
    for (var n = 0; n < nodes.length; n++) {
      var v = nodes[n];
      if (v && v.nodeType && v.attributes) {
        var names = {};
        for (var an in v.attributes) {
          var av = v.attributes[an] || {};
          names[an] = av["UI-text"] || (av.name && av.name["UI-text"]) || an;
        }
        nodeAttrNames[v.nodeType] = names;
      }
      if (v && v.nodeType && v.tabs) {
        var tabs = {};
        for (var t in v.tabs) {
          tabs[t] = v.tabs[t] && v.tabs[t]["UI-text"] ? v.tabs[t]["UI-text"] : t;
        }
        nodeTabNames[v.nodeType] = tabs;
      }
    }
  } catch (e2) {}
}

// [type, superType, super-superType, …]
function typeChain(type) {
  loadNodeDefinitions();
  var out = [];
  var guard = 0;
  while (type && nodeDefsByType[type] && guard < 30) {
    out.push(type);
    type = nodeDefsByType[type].superType;
    guard++;
  }
  return out;
}

function tabLabel(chain, tabId) {
  for (var i = 0; i < chain.length; i++) {
    var names = nodeTabNames[chain[i]];
    if (names && names[tabId]) {
      return names[tabId];
    }
  }
  return tabId.charAt(0).toUpperCase() + tabId.substr(1);
}

// The Attribute Editor layout of a node type:
// [{ id, label, order: [attrId or "---separator", …] }, …]
// Tabs come from the base type up to the type itself (a sub-type's
// attributes are listed first in a shared tab); attribute lists without
// a tab (transform, opacity…) go to the top of the first tab.
function editorLayout(type) {
  var chain = typeChain(type);
  var tabs = [];
  var byId = {};
  var loose = [];
  for (var c = chain.length - 1; c >= 0; c--) {
    var uiDef = nodeDefsByType[chain[c]].UI;
    if (!uiDef) {
      continue;
    }
    if (uiDef.attributeOrder) {
      loose = loose.concat(uiDef.attributeOrder);
    }
    var defTabs = uiDef.tabs || [];
    for (var t = 0; t < defTabs.length; t++) {
      var dt = defTabs[t];
      var order = dt.attributeOrder || [];
      if (byId[dt.id]) {
        byId[dt.id].order = order.concat(byId[dt.id].order);
      } else {
        var tab = { id: dt.id, order: order.slice() };
        byId[dt.id] = tab;
        if (typeof dt.index === "number" && dt.index <= tabs.length) {
          tabs.splice(dt.index, 0, tab);
        } else {
          tabs.push(tab);
        }
      }
    }
  }
  if (!tabs.length) {
    tabs.push({ id: "attributes", order: [] });
  }
  tabs[0].order = loose.concat(tabs[0].order);
  for (var k = 0; k < tabs.length; k++) {
    tabs[k].label = tabs[k].id === "attributes" ? "Attributes" : tabLabel(chain, tabs[k].id);
  }
  return tabs;
}

// Value types a node can output (from its default output), or null
// when unknown (third-party plugin…): then nothing is filtered.
function nodeOutputTypes(type) {
  var chain = typeChain(type);
  if (!chain.length) {
    return null;
  }
  var outAttr = null;
  for (var i = 0; i < chain.length && !outAttr; i++) {
    outAttr = nodeDefsByType[chain[i]].defaultOutput || null;
  }
  outAttr = outAttr || "out";
  for (var j = 0; j < chain.length; j++) {
    var attrs = nodeDefsByType[chain[j]].attributes || {};
    if (attrs[outAttr] && attrs[outAttr].supportedOutputTypes) {
      return attrs[outAttr].supportedOutputTypes;
    }
  }
  // No list of output types (e.g. Contrasting Color): the type of the
  // output attribute itself.
  for (var k = 0; k < chain.length; k++) {
    var attrs2 = nodeDefsByType[chain[k]].attributes || {};
    if (attrs2[outAttr] && attrs2[outAttr].type) {
      return [attrs2[outAttr].type];
    }
  }
  return null;
}

function shortcutNodeType(shortcut) {
  return shortcut.type || findLayerTypeByName(shortcut.nodeName || shortcut.label);
}

// Static type and display name of an attribute of a node type.
function defAttrType(type, attr) {
  var chain = typeChain(type);
  for (var i = 0; i < chain.length; i++) {
    var attrs = nodeDefsByType[chain[i]].attributes || {};
    if (attrs[attr] && attrs[attr].type) {
      return attrs[attr].type;
    }
  }
  return null;
}

function defAttrName(type, attr) {
  var chain = typeChain(type);
  for (var i = 0; i < chain.length; i++) {
    var names = nodeAttrNames[chain[i]];
    if (names && names[attr]) {
      return names[attr];
    }
  }
  return attr;
}

// Colour attributes only accept colour nodes (Color Array, Color…):
// a node that can also output numbers (Value, Oscillator…) is excluded.
function canDriveColor(outTypes) {
  return !outTypes || (outTypes.indexOf("color") !== -1 && outTypes.indexOf("double") === -1);
}

// Fill and Stroke can be switched off: their attributes are then not on
// the layer. These default sub-nodes are used to list them anyway.
var OFF_SLOT_TYPES = { material: "colorMaterial", stroke: "strokeMaterial" };

function slotIsOff(layerId, slot) {
  try {
    if (slot === "material") { return !api.hasFill(layerId); }
    if (slot === "stroke") { return !api.hasStroke(layerId); }
  } catch (e) {}
  return false;
}

function enableSlot(layerId, slot) {
  try {
    if (slot === "material") { api.setFill(layerId, true); }
    if (slot === "stroke") { api.setStroke(layerId, true); }
  } catch (e) {}
}

// ------------------------------------------------------------
// Attribute entries for the Alt + click menu
// ------------------------------------------------------------

function attrNiceName(layerId, attr) {
  try {
    var n = api.getAttributeNiceName(layerId, attr);
    if (n) {
      return n;
    }
  } catch (e) {}
  return attr;
}

// Entries for one attribute: the whole value, plus X / Y for vectors.
// Position (double3) counts as 2D unless the layer is in 2.5D; rotation
// only offers Z (the 2D rotation). outTypes filters what the node can
// drive (a Value2 only gets 2D attributes, a Color Array only colours…).
function attributeEntries(layerId, attr, type, is3d, outTypes, niceOverride) {
  var nice = niceOverride || attrNiceName(layerId, attr);
  var comp = /^int/.test(type) ? "int" : "double";
  var list = [];
  function add(label, path, connType, kind) {
    if (!outTypes || outTypes.indexOf(connType) !== -1) {
      list.push({ label: label, path: path, kind: kind });
    }
  }
  if (type === "color") {
    if (canDriveColor(outTypes)) {
      add(nice, attr, "color", "color");
    }
    return list;
  }
  if (/3$/.test(type) && /(^|\.)rotation$/.test(attr) && !is3d) {
    add(nice, attr + ".z", comp, "1d");
    return list;
  }
  if (/2$|3$/.test(type)) {
    add(nice, attr, type, /3$/.test(type) && is3d ? "3d" : "2d");
    add(nice + " X", attr + ".x", comp, "1d");
    add(nice + " Y", attr + ".y", comp, "1d");
    if (/3$/.test(type) && is3d) {
      add(nice + " Z", attr + ".z", comp, "1d");
    }
    return list;
  }
  add(nice, attr, type, "1d");
  return list;
}

// Type of the node held by a sub-UI slot (generator, material, stroke…).
// getCurrentGeneratorType is used because these inputs are private.
function slotNodeType(layerId, slot) {
  try {
    var gens = api.getGenerators(layerId) || [];
    if (gens.indexOf(slot) !== -1) {
      return api.getCurrentGeneratorType(layerId, slot) || null;
    }
  } catch (e) {}
  return null;
}

// Menu model for a layer, following the Attribute Editor:
// [{ label, items: [entry | "separator", …] }, …]
function collectPickableAttributes(layerId, outTypes) {
  var attrs = [];
  try { attrs = api.getAttributes(layerId) || []; } catch (e) {}
  var types = {};
  var slotChildren = {};
  var listEntries = {};   // list attribute -> its entries ("array" -> ["array.0", …])
  for (var i = 0; i < attrs.length; i++) {
    var a = attrs[i];
    var d = null;
    try { d = api.getAttributeDefinition(layerId, a); } catch (e2) {}
    // Lists (the entries of a Value / Value 2 / Value 3 Array…): their
    // entries are not returned by getAttributes, only as children.
    if (d && d.isArray && SKIPPED_ATTRS.indexOf(a) === -1) {
      var kids = [];
      try { kids = api.getAttrChildren(layerId, a) || []; } catch (eK) {}
      for (var ki = 0; ki < kids.length; ki++) {
        var kd = null;
        try { kd = api.getAttributeDefinition(layerId, kids[ki]); } catch (eKd) {}
        if (kd && PICKABLE_TYPES.indexOf(kd.type) !== -1) {
          types[kids[ki]] = kd.type;
          (listEntries[a] = listEntries[a] || []).push(kids[ki]);
        }
      }
      continue;
    }
    if (!d || PICKABLE_TYPES.indexOf(d.type) === -1 || SKIPPED_ATTRS.indexOf(a) !== -1) {
      continue;
    }
    types[a] = d.type;
    var dot = a.indexOf(".");
    if (dot !== -1) {
      var slot = a.substr(0, dot);
      (slotChildren[slot] = slotChildren[slot] || []).push(a);
    }
  }
  var is3d = false;
  try { is3d = !!api.get(layerId, "is3d"); } catch (e3) {}
  var used = {};

  function entriesFor(attr) {
    if (listEntries[attr] && !used[attr]) {
      used[attr] = true;
      var all = [];
      for (var le = 0; le < listEntries[attr].length; le++) {
        var path = listEntries[attr][le];
        if (!used[path]) {
          used[path] = true;
          // "Value.0" -> "Value 0"
          var label = attrNiceName(layerId, path).replace(/\.(\d+)$/, " $1");
          all = all.concat(attributeEntries(layerId, path, types[path], is3d, outTypes, label));
        }
      }
      return all;
    }
    if (used[attr] || !types[attr]) {
      return [];
    }
    used[attr] = true;
    return attributeEntries(layerId, attr, types[attr], is3d, outTypes);
  }

  // Children of a sub-UI slot, in the order of the slot node's own layout.
  // Fill / Stroke switched off: list the default sub-node's attributes;
  // picking one switches the Fill / Stroke back on (entry.enable).
  function offSlotEntries(slot) {
    var subType = OFF_SLOT_TYPES[slot];
    if (!subType || used["slot:" + slot] || !slotIsOff(layerId, slot)) {
      return [];
    }
    used["slot:" + slot] = true;
    var out = [];
    var subTabs = editorLayout(subType);
    for (var s = 0; s < subTabs.length; s++) {
      for (var o = 0; o < subTabs[s].order.length; o++) {
        var child = subTabs[s].order[o];
        var ctype = defAttrType(subType, child);
        if (!ctype || PICKABLE_TYPES.indexOf(ctype) === -1) {
          continue;
        }
        var list = attributeEntries(layerId, slot + "." + child, ctype, is3d, outTypes, defAttrName(subType, child));
        for (var l = 0; l < list.length; l++) {
          list[l].enable = slot;
        }
        out = out.concat(list);
      }
    }
    return out;
  }

  function slotEntries(slot) {
    var children = slotChildren[slot];
    if (!children) {
      return offSlotEntries(slot);
    }
    var out = [];
    var subType = slotNodeType(layerId, slot);
    if (subType) {
      var subTabs = editorLayout(subType);
      for (var s = 0; s < subTabs.length; s++) {
        for (var o = 0; o < subTabs[s].order.length; o++) {
          out = out.concat(entriesFor(slot + "." + subTabs[s].order[o]));
        }
      }
    }
    for (var c = 0; c < children.length; c++) {
      out = out.concat(entriesFor(children[c]));
    }
    return out;
  }

  var groups = [];
  var layout = editorLayout(api.getLayerType(layerId));
  for (var t = 0; t < layout.length; t++) {
    var items = [];
    var pendingSep = false;
    for (var k = 0; k < layout[t].order.length; k++) {
      var id = layout[t].order[k];
      if (/^---/.test(id)) {
        pendingSep = items.length > 0;
        continue;
      }
      var add = entriesFor(id).concat(slotEntries(id));
      if (add.length) {
        if (pendingSep) {
          items.push("separator");
          pendingSep = false;
        }
        items = items.concat(add);
      }
    }
    if (items.length) {
      var off = false;
      for (var q = 0; q < items.length; q++) {
        if (items[q] !== "separator" && items[q].enable) {
          off = true;
        }
      }
      groups.push({ label: layout[t].label + (off ? " (off)" : ""), items: items });
    }
  }
  // Anything the layout did not place (dynamic attributes, plugins…).
  var rest = [];
  for (var r = 0; r < attrs.length; r++) {
    var dotR = attrs[r].indexOf(".");
    rest = rest.concat(dotR === -1 ? entriesFor(attrs[r]).concat(slotEntries(attrs[r])) : entriesFor(attrs[r]));
  }
  if (rest.length) {
    groups.push({ label: "Other", items: rest });
  }
  return groups;
}

// Returns false (and lets the normal click happen) when no single
// layer is selected or it has no attribute this node can drive.
function showAttributeMenu(shortcut) {
  var sel = api.getSelection();
  if (!sel || sel.length !== 1) {
    return false;
  }
  var layerId = sel[0];
  var isExpr = shortcut.kind === "expression";
  var nodeType = isExpr ? null : shortcutNodeType(shortcut);
  // Expressions: any numeric attribute (no colours).
  // String nodes: only the text attributes (their output could also
  // drive numbers, but that is not what they are for).
  var outTypes = isExpr ? ["double", "int", "double2", "int2", "double3", "int3"] :
    (nodeType ? (isStringNodeType(nodeType) ? STRING_TYPES : nodeOutputTypes(nodeType)) : null);
  var groups = collectPickableAttributes(layerId, outTypes);
  if (!groups.length) {
    logStatus("No attribute of " + api.getNiceName(layerId) + " can be driven by " + shortcut.label + ".");
    return false;
  }
  function itemFor(entry) {
    var item = {
      name: entry.label,
      onMouseRelease: function () {
        if (entry.enable) {
          enableSlot(layerId, entry.enable);
        }
        if (isExpr) {
          applyExpression(shortcut.expression, [{ layer: layerId, attr: entry.path }], shortcut.label);
        } else {
          createNode(shortcut, { layer: layerId, attr: entry.path });
        }
      }
    };
    var icon = typeIconFor(entry.kind);
    if (icon) {
      item.icon = icon;
    }
    return item;
  }
  ui.clearContextMenu();
  // Title row: kept enabled (a disabled row greys out its icon).
  var title = { name: shortcut.label + " → " + api.getNiceName(layerId), onMouseRelease: function () {} };
  var layerIcon = null;
  try { layerIcon = resolveIcon({ type: api.getLayerType(layerId) }); } catch (eIcon) {}
  if (layerIcon) {
    title.icon = layerIcon;
  }
  ui.addMenuItem(title);
  ui.addMenuItem({ name: "" });
  if (groups.length === 1) {
    for (var i = 0; i < groups[0].items.length; i++) {
      ui.addMenuItem(groups[0].items[i] === "separator" ? { name: "" } : itemFor(groups[0].items[i]));
    }
  } else {
    for (var g = 0; g < groups.length; g++) {
      var sub = new ui.Menu(groups[g].label);
      for (var j = 0; j < groups[g].items.length; j++) {
        sub.addMenuItem(groups[g].items[j] === "separator" ? { name: "" } : itemFor(groups[g].items[j]));
      }
      ui.addSubMenu(sub);
    }
  }
  ui.showContextMenu();
  restoreMainMenuSoon();
  return true;
}

// The "+" menu entries (also used by Settings > Add…), for one bar.
function addMenuEntries(targetId, withSpacer) {
  ui.addMenuItem({ name: "Add Node / Script", onMouseRelease: function () { openPicker(targetId); } });
  ui.addMenuItem({ name: "Add Selected Layer", onMouseRelease: function () { addFavoriteFromSelection(targetId); } });
  ui.addMenuItem({ name: "Add Selected Layers as Rig…", onMouseRelease: function () { openNewRigDialog(targetId); } });
  // From Settings (no Spacer entry), "Save as a shortcut" starts checked.
  var fromSettings = withSpacer === false;
  ui.addMenuItem({ name: "Add Expression…", onMouseRelease: function () { openExpressionDialog(targetId, null, fromSettings); } });
  ui.addMenuItem({ name: "Add Shortcut as Button…", onMouseRelease: function () { openKeysDialog(targetId); } });
  if (withSpacer !== false) {
    ui.addMenuItem({ name: "Spacer", onMouseRelease: function () { addSpacer(targetId); } });
  }
}

// From the bar's "+": every entry. From Settings > Add…: no Spacer
// (Settings has its own Spacer button).
// ============================================================
// Update (latest GitHub Release)
// ============================================================
// Settings checks the latest Release of the repository once per session
// (the request blocks Cavalry for a moment, so it runs only there). The
// "Update" button turns green when a newer version exists; it
// installs that release's C-Bar.js after a confirmation, keeps the
// previous file in C-Bar_assets/backup/ and regenerates the bar scripts.

var UPDATE_GREEN = "#4ffd7a";
var UPDATE_GREY = "#6a6a6a";
var updateInfo = null;   // { status: "uptodate" | "available" | "error", latest, tag, message }
var updateLabel = null;
var updateButton = null;

// Compares "1.2.3" style versions: > 0 when a is newer than b.
function compareVersions(a, b) {
  var pa = String(a).replace(/^v/i, "").split(/[.\-]/);
  var pb = String(b).replace(/^v/i, "").split(/[.\-]/);
  for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
    var x = parseInt(pa[i], 10) || 0;
    var y = parseInt(pb[i], 10) || 0;
    if (x !== y) {
      return x - y;
    }
  }
  return 0;
}

function githubClient(host) {
  var client = new api.WebClient(host);
  try { client.addHeader("User-Agent", "C-Bar/" + CBAR_VERSION); } catch (e) {}
  return client;
}

function checkForUpdate(force) {
  if (updateInfo && !force) {
    return updateInfo;
  }
  var info = { status: "error", latest: null, tag: null, message: "" };
  try {
    var client = githubClient("https://api.github.com");
    try { client.addHeader("Accept", "application/vnd.github+json"); } catch (e0) {}
    client.get("/repos/" + CBAR_REPO + "/releases/latest");
    var status = client.status();
    if (status === 200) {
      var rel = JSON.parse(client.body());
      info.tag = String(rel.tag_name || "");
      info.latest = info.tag.replace(/^v/i, "");
      if (!info.latest) {
        info.message = "The latest release has no version number.";
      } else {
        info.status = compareVersions(info.latest, CBAR_VERSION) > 0 ? "available" : "uptodate";
      }
    } else if (status === 404) {
      info.message = "No release found (the repository may be private, or has no release yet).";
    } else {
      info.message = "GitHub answered " + status + ".";
    }
  } catch (e) {
    info.message = "Could not reach GitHub: " + e;
  }
  updateInfo = info;
  return info;
}

function refreshUpdateButton() {
  if (!updateLabel) {
    return;
  }
  var info = updateInfo;
  var green = info && info.status === "available";
  try { updateLabel.setTextColor(green ? UPDATE_GREEN : UPDATE_GREY); } catch (e) {}
  var tip = "C-Bar v" + CBAR_VERSION;
  if (!info) {
    tip += "\nChecking GitHub for a newer version…";
  } else if (info.status === "available") {
    tip += "\nv" + info.latest + " is available: click to install it";
  } else if (info.status === "uptodate") {
    tip += " is up to date";
  } else {
    tip += "\n" + info.message + "\nClick to check again";
  }
  try { updateButton.setToolTip(tip); } catch (e2) {}
}

// Checks shortly after Settings opens, so the panel shows first.
var updateCheckTimer = null;
function checkForUpdateSoon() {
  if (updateInfo) {
    refreshUpdateButton();
    return;
  }
  try {
    if (!updateCheckTimer) {
      updateCheckTimer = new api.Timer({
        onTimeout: function () {
          updateCheckTimer.stop();
          checkForUpdate(false);
          refreshUpdateButton();
        }
      });
      updateCheckTimer.setRepeating(false);
      updateCheckTimer.setInterval(300);
    }
    updateCheckTimer.start();
  } catch (e) {
    checkForUpdate(false);
    refreshUpdateButton();
  }
}

function onUpdateClicked() {
  var info = updateInfo && updateInfo.status !== "error" ? updateInfo : checkForUpdate(true);
  refreshUpdateButton();
  if (info.status === "error") {
    showMessage("Could not check for updates.\n" + info.message);
    return;
  }
  if (info.status === "uptodate") {
    showMessage("C-Bar is up to date (v" + CBAR_VERSION + ").");
    return;
  }
  var ok = aboveSettings(function () {
    return new ui.Modal().showConfirmation("Update C-Bar",
      "Current version: v" + CBAR_VERSION + "\nNew version: v" + info.latest +
      "\n\nInstall it now? Your bars, rigs and icons are kept.");
  });
  if (ok) {
    installUpdate(info);
  }
}

function installUpdate(info) {
  var client = githubClient("https://raw.githubusercontent.com");
  var src = "";
  try {
    client.get("/" + CBAR_REPO + "/" + info.tag + "/C_Bar/C-Bar.js");
    if (client.status() !== 200) {
      showMessage("Download failed (GitHub answered " + client.status() + "). Nothing was changed.");
      return;
    }
    src = String(client.body() || "");
  } catch (e) {
    showMessage("Download failed: " + e + "\nNothing was changed.");
    return;
  }
  // The file must be a C-Bar script of the announced version.
  var m = src.match(/var CBAR_VERSION = "([^"]+)"/);
  if (!/^var CBAR_ID = "[^"]*";/.test(src) || !m || compareVersions(m[1], info.latest) !== 0) {
    showMessage("The downloaded file is not C-Bar v" + info.latest + ". Nothing was changed.");
    return;
  }
  var backupDir = ASSETS_DIR + "/backup";
  ensureFolder(backupDir);
  try {
    api.writeToFile(backupDir + "/C-Bar_v" + CBAR_VERSION + ".js", api.readFromFile(MAIN_SCRIPT), true);
  } catch (e2) {
    showMessage("Could not back up the current C-Bar.js (" + e2 + "). Nothing was changed.");
    return;
  }
  try {
    api.writeToFile(MAIN_SCRIPT, src, true);
  } catch (e3) {
    showMessage("Could not write C-Bar.js: " + e3);
    return;
  }
  var bars = listBars();
  for (var i = 0; i < bars.length; i++) {
    if (bars[i].id !== "default" && bars[i].script) {
      writeBarScript(bars[i]);
    }
  }
  updateInfo = { status: "uptodate", latest: info.latest, tag: info.tag, message: "" };
  refreshUpdateButton();
  logStatus("C-Bar updated to v" + info.latest + " (previous version in C-Bar_assets/backup/).");
  showMessage("C-Bar updated to v" + info.latest + ".\nClose and reopen your bars to use it.\n" +
    "The previous version is in C-Bar_assets/backup/.");
}

// Text button whose label colour can change (ui.Button has no text
// colour): a Container with a centred Label, drawn like Cavalry's own
// buttons (dark fill, thin darker border, 18 px high).
var BUTTON_FILL = "#2b2b2b";
var BUTTON_BORDER = "#1c1c1c";

function createUpdateButton() {
  updateLabel = new ui.Label("Update");
  updateLabel.setAlignment(1);
  try { updateLabel.setTransparentForMouseEvents(true); } catch (e) {}
  try { updateLabel.setTextColor(UPDATE_GREY); } catch (e1) {}
  var lay = new ui.HLayout();
  lay.setMargins(8, 0, 8, 0);
  lay.add(updateLabel);
  updateButton = new ui.Container();
  updateButton.setLayout(lay);
  updateButton.setFixedHeight(18);
  try { updateButton.setBackgroundColor(BUTTON_FILL); } catch (e2) {}
  try { updateButton.setBorder(BUTTON_BORDER, 1); } catch (e3) {}
  try { updateButton.setRadius(2, 2, 2, 2); } catch (e4) {}
  updateButton.onMouseRelease = function (position, button) {
    if (button === "left") {
      onUpdateClicked();
    }
  };
  refreshUpdateButton();
  return updateButton;
}

// "?" (round): credits, version and the GitHub page.
var CBAR_URL = "https://github.com/" + CBAR_REPO;

// A small window rather than a Modal: a Modal's buttons are always
// Cancel / Okay. "Ok" opens the GitHub page.
var aboutDialog = null;

function openGitHubPage() {
  try {
    if (IS_MAC) {
      api.runDetachedProcess("/usr/bin/open", [CBAR_URL]);
    } else {
      api.runDetachedProcess("explorer", [CBAR_URL]);
    }
  } catch (e) {
    logStatus("C-Bar on GitHub: " + CBAR_URL);
  }
}

function showAbout() {
  if (aboutDialog) {
    try { aboutDialog.close(); } catch (e0) {}
    aboutDialog = null;
  }
  var title = new ui.Label("C-Bar v" + CBAR_VERSION);
  try { title.setFontSize(15); } catch (e1) {}
  var text = new ui.Label("A customisable toolbar for Cavalry, in the spirit of KBar.\n\n" +
    "Created by Darkpulse · MIT licence\n\nOpen the GitHub page?");
  var cancel = new ui.Button("Cancel");
  cancel.onClick = function () {
    aboutDialog.close();
  };
  var ok = new ui.Button("Ok");
  ok.onClick = function () {
    aboutDialog.close();
    openGitHubPage();
  };
  var buttons = new ui.HLayout();
  buttons.addStretch();
  buttons.add(cancel, ok);
  var layout = new ui.VLayout();
  layout.setMargins(16, 14, 16, 12);
  layout.setSpaceBetween(8);
  layout.add(title);
  layout.add(text);
  layout.addStretch();
  layout.add(buttons);
  aboutDialog = new ui.Container();
  aboutDialog.setMinimumWidth(340);
  aboutDialog.setLayout(layout);
  showOnTop(aboutDialog);
}

function createInfoButton() {
  var size = 24;
  var d = new ui.Draw();
  d.setSize(size, size);
  try { d.setBackgroundColor(ui.getThemeColor("Window")); } catch (e) {}
  var ring = new cavalry.Path();
  ring.addEllipse(size / 2, size / 2, 9, 9);
  d.addPath(ring.toObject(), { color: "#8a8a8a", stroke: true, strokeWidth: 1.2 });
  var q = new cavalry.Path();
  q.addText("?", 12, 0, 0);
  var bb = q.boundingBox();
  q.translate(size / 2 - bb.centre.x, size / 2 - bb.centre.y);
  d.addPath(q.toObject(), { color: "#c8c8c8" });
  d.setToolTip("About C-Bar: credits, version, GitHub");
  d.onMouseRelease = function (position, button) {
    if (button === "left") {
      showAbout();
    }
  };
  return d;
}

function showBarActionsMenu() {
  ui.clearContextMenu();
  ui.addMenuItem({ name: "New Bar…", onMouseRelease: openNewBarDialog });
  ui.addMenuItem({ name: "Import Bar…", onMouseRelease: importBar });
  ui.addMenuItem({ name: "Export Bar…", onMouseRelease: function () { exportBar(editedBarId); } });
  ui.addMenuItem({ name: "" });
  ui.addMenuItem({ name: "Update Bars", onMouseRelease: updateAllBarScripts });
  ui.showContextMenu();
  restoreMainMenuSoon();
}

function showConfigMenu() {
  ui.clearContextMenu();
  ui.addMenuItem({ name: "Config Import…", onMouseRelease: function () { openConfigDialog("import"); } });
  ui.addMenuItem({ name: "Config Export…", onMouseRelease: function () { openConfigDialog("export"); } });
  ui.addMenuItem({ name: "Open Folder", onMouseRelease: openScriptFolder });
  ui.showContextMenu();
  restoreMainMenuSoon();
}

function showAddMenu(targetId) {
  ui.clearContextMenu();
  var fromSettings = typeof targetId === "string";
  addMenuEntries(fromSettings ? targetId : currentBar.id, !fromSettings);
  ui.showContextMenu();
  restoreMainMenuSoon();
}

// ------------------------------------------------------------
// Secondary windows and other applications
// ------------------------------------------------------------
// Cavalry shows script windows opened with Container.show() above every
// application (on macOS at least), so Settings stayed in front after a
// Cmd + Tab. They are hidden while Cavalry is not the active
// application and shown again when it comes back.
var hiddenWhileInactive = [];

function secondaryWindows() {
  return [managerContainer, pickerContainer, exprDialog, keysDialog, iconDialog, rigDialog, barDialog, configDialog, aboutDialog];
}

function onCavalryActiveChanged(state) {
  if (state === "inactive") {
    var wins = secondaryWindows();
    for (var i = 0; i < wins.length; i++) {
      if (wins[i] && isShown(wins[i]) && hiddenWhileInactive.indexOf(wins[i]) === -1) {
        hiddenWhileInactive.push(wins[i]);
        try { wins[i].close(); } catch (e) {}
      }
    }
    // One line per switch, only when something was hidden (helps tell
    // whether this callback runs at all on a given system).
    if (hiddenWhileInactive.length) {
      logStatus(hiddenWhileInactive.length + " window(s) hidden while Cavalry is in the background.");
    }
  } else if (state === "active") {
    var back = hiddenWhileInactive;
    hiddenWhileInactive = [];
    // Settings first, so the window that was in front of it ends on top.
    back.sort(function (a, b) {
      return (a === managerContainer ? 0 : 1) - (b === managerContainer ? 0 : 1);
    });
    for (var j = 0; j < back.length; j++) {
      try { back[j].show(); } catch (e2) {}
    }
  }
}

try {
  ui.addCallbackObject({ onAppStateChanged: onCavalryActiveChanged });
} catch (eCb) {}

buildMainMenu();
ui.showContextMenuOnRightClick();

ui.onClose = function () {
  // Secondary windows (Settings, Add, Expression…) run this window's
  // code: left open after the bar closes, a click in them would call a
  // script that no longer exists. They are closed with it.
  var wins = [];
  try { wins = secondaryWindows(); } catch (eW) {}
  for (var w = 0; w < wins.length; w++) {
    if (wins[w]) {
      try { wins[w].close(); } catch (eC) {}
    }
  }
  try {
    if (syncTimer) {
      syncTimer.stop();
    }
    if (menuRestoreTimer) {
      menuRestoreTimer.stop();
    }
    if (resizeTimer) {
      resizeTimer.stop();
    }
    if (longPressTimer) {
      longPressTimer.stop();
    }
    if (updateCheckTimer) {
      updateCheckTimer.stop();
    }
  } catch (e) {}
};

// The bar is added straight to the window (no wrapper) so that it fills
// the whole length: this is what pins the tools to the bottom / right.
mainBar = makeBar(isVertical());
applyBarSize();
ui.setTitle("C-Bar · " + currentBar.name);
ui.setMargins(0, 0, 0, 0);
ui.setSpaceBetween(0);
ui.add(mainBar.root);
applySizeLimits();
// Opening size: the window is first made long enough to show every
// button, then left free to be resized (or docked).
openAtFullLength();
ui.show();
startResizeWatch();
try { syncBarScripts(); } catch (eSync) {}
