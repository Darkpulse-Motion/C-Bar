var CBAR_ID = "default"; // CBAR_ID — do not edit this line (it is replaced in every generated bar)
// ============================================================
// C-Bar — Cavalry shortcut bars (nodes, favourites, scripts)
// ============================================================
// Install:
//   Scripts/C_Bar/C-Bar.js            ← "Default" bar (the only file to maintain)
//   Scripts/C_Bar/C-Bar_assets/
//       bars/<id>.json                ← settings and shortcuts of each bar
//       icons/<script name>.png       ← custom script icons
//
// Each bar created from ⚙ > "New Bar…" generates a "C-Bar_<Name>.js"
// file next to this one: a copy of C-Bar.js where only the first line
// (CBAR_ID) changes. After editing C-Bar.js, ⚙ > "Update Bars"
// regenerates those copies.
//
// Orientation: chosen when a bar is created (or duplicated). Every bar
// is a clean Cavalry toolbar, without a docking tab.
//
// ⚙ Settings: at the top, the shortcuts of the bar selected below;
// at the bottom, the list of bars ("..." menu: Open, Duplicate, Rename,
// Delete).
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

var SCRIPT_DIR = "";
try {
  SCRIPT_DIR = String(ui.scriptLocation || "");
} catch (eLoc) {}
if (!SCRIPT_DIR) {
  SCRIPT_DIR = getScriptsRoot() + "/C_Bar";
}
SCRIPT_DIR = SCRIPT_DIR.replace(/[\/\\]+$/, "");

var MAIN_SCRIPT = SCRIPT_DIR + "/C-Bar.js";
var ASSETS_DIR = SCRIPT_DIR + "/C-Bar_assets";
var BARS_DIR = ASSETS_DIR + "/bars";
var ICONS_DIR = ASSETS_DIR + "/icons";

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
  if (!shortcut || !shortcut.label) {
    return null;
  }
  var names = [String(shortcut.label)];
  var safe = fileSafeName(shortcut.label);
  if (safe && safe !== names[0]) {
    names.push(safe);
  }
  for (var i = 0; i < names.length; i++) {
    var path = ICONS_DIR + "/" + names[i] + ".png";
    try {
      if (api.filePathExists(path)) {
        return path;
      }
    } catch (e) {}
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
    return findScriptIcon(shortcut.path);
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
  if (!api.filePathExists(shortcut.path)) {
    logStatus("Script not found: " + shortcut.path);
    return;
  }
  try {
    ui.runFileScript(shortcut.path);
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
    return isColorNode(nodeId);
  } catch (e) {
    return false;
  }
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
  var paths = find();
  if (!paths.length) {
    try { api.addArrayIndex(nodeId, "array"); } catch (e2) {}
    paths = find();
  }
  return paths;
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
    if (!paths.length) {
      paths = ["array.0"];
    }
  }
  for (var i = 0; i < paths.length; i++) {
    try {
      var o = {};
      o[paths[i]] = value;
      api.set(nodeId, o);
    } catch (e) {
      continue;
    }
    var back = null;
    try { back = api.get(nodeId, paths[i]); } catch (e2) {}
    if (sameValue(back, value)) {
      return true;
    }
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
  var name = attr;
  try { name = api.getAttributeNiceName(layerId, attr) || attr; } catch (e) {}
  return ATTRIBUTE_SHORT_NAMES.hasOwnProperty(name) ? ATTRIBUTE_SHORT_NAMES[name] : name;
}

// Returns true if the node was linked to the attribute.
function linkToSelectedAttribute(nodeId, target, baseName) {
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
  if (VALUE_NODE_TYPES.indexOf(nodeTypeId) !== -1 || BLEND_NODE_TYPES.indexOf(nodeTypeId) !== -1 ||
      nodeTypeId === "colorArray") {
    seedNodeValue(nodeId, nodeTypeId, currentValue);
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
function layoutKindFor(type) {
  if (type === "layoutGroup") { return "layout"; }
  if (type === "gridLayoutGroup") { return "grid"; }
  if (type === "gridLayoutRow") { return "row"; }
  return null;
}

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

  // Layouts: like Create > Layout > Embed selected in … Layout.
  var layoutKind = null; // plain Layout nodes: created alone (see the "Embed in … Layout" shortcuts)
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

  if (layoutKind) {
    if (fullSelection.length) {
      embedInLayout(nodeId, fullSelection, layoutKind, shortcut);
    } else if (layoutKind === "layout") {
      setLayoutDirection(nodeId, shortcut);
    }
    api.select([nodeId]);
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
function createColorArray(shortcut, fromPalette) {
  var pal = null;
  if (fromPalette) {
    pal = activePalette();
    if (!pal) {
      showMessage("No active palette in the Color window");
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
    if (list[i].kind === "script" && list[i].path === script.path) {
      logStatus("'" + script.name + "' is already in the bar.");
      return;
    }
  }
  mutateBarShortcuts(id, function (l) {
    l.push({ kind: "script", path: script.path, label: script.name, uid: makeUid("script_" + script.name) });
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
  mutateBarShortcuts(typeof targetId === "string" ? targetId : currentBar.id, function (l) {
    l.push({ type: type, label: name, preset: preset, uid: makeUid("fav_" + type) });
  });
  logStatus("Favourite added: " + name + " (" + type + ", " + Object.keys(preset.values).length + " settings)");
}

function createFromFavorite(shortcut, forcedTarget) {
  var p = shortcut.preset || {};
  var attrTarget = forcedTarget || getSelectedAttributeTarget();
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
  linkToSelectedAttribute(nodeId, attrTarget, shortcut.label);
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
function categoryFromSuperTypes(superTypes) {
  var s = (superTypes || []).join(" ").toLowerCase();
  if (/filter/.test(s)) { return "effect"; }
  if (/deformer/.test(s)) { return "deformer"; }
  if (/shape/.test(s)) { return "shape"; }
  return "utility";
}

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
  if (s.kind === "spacer" || s.kind === "expression" || s.kind === "rig" || s.kind === "script") {
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
    if (button !== "left") {
      return;
    }
    var alt = false;
    try { alt = api.isAltHeld(); } catch (e3) {}
    runExpressionShortcut(shortcut, alt);
  };
  return d;
}

function createToolbarButton(shortcut) {
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
    shortcut.kind === "script" ? "Script: " + shortcut.label :
    shortcut.kind === "layout" ? shortcut.label + "\nWith layers selected: they become its children" :
    (shortcut.preset ? "♥ " + shortcut.label + " (favourite with its settings)" : "Create a " + shortcut.label + " node");
  var altType = (shortcut.kind || shortcut.preset) ? null : shortcutNodeType(shortcut);
  if (altType === "colorArray") {
    tip += "\nWith a layer selected: connected to its Fill, as a child of the layer" +
      "\nShift + click: from the active palette of the Color window" +
      "\nAlt + click with a layer selected: choose the colour to drive";
  } else if (isFilterType(altType)) {
    tip += "\nAlt + click with a layer selected: add it to the layer's filters";
  } else if (canPickAttribute(shortcut)) {
    tip += "\nAlt + click with a layer selected: choose the attribute to drive";
  }
  btn.setToolTip(tip);
  btn.onClick = function () {
    var alt = false;
    try { alt = api.isAltHeld(); } catch (e) {}
    var shift = false;
    try { shift = api.isShiftHeld(); } catch (eS) {}
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
// under a dragged shortcut (Edit Layout) is highlighted.
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
    "\nHold 1.5 s on the bar: edit its layout"));
  // The page changes on release: changing it on press would rebuild the
  // bar under the mouse, and the release (which stops the long press)
  // would be lost.
  d.onMousePress = function (position, button) {
    if (button === "left") {
      startLongPress();
    }
  };
  d.onMouseRelease = function (position, button) {
    var wasPending = longPressPending();
    cancelLongPress();
    // Normal mode: only when the long press did not fire. Edit Layout:
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
      layout.add(centeredCell(vertical, createToolbarButton(shown[i])));
    }
  }
  // Built-in gap before "+" (not a shortcut, not listed in Settings).
  layout.add(centeredCell(vertical, createSpacerWidget(vertical)));
  layout.add(centeredCell(vertical, createUtilityButton(
    "addIcon.png", "+", "Add a node, a script, the selected layer, an expression, a rig or a spacer", showAddMenu)));
  layout.add(centeredCell(vertical, createUtilityButton(
    "settings.png", "⚙", "Settings: shortcuts and bars", openManager)));
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
// Edit Layout mode
// ============================================================
// Hold the mouse 1.5 s on the bar (an empty part or a page button), or
// right-click > Edit Layout. The shortcuts stop working and can be
// dragged: drop one on another to take its place, or on a page button
// (1 2 3 4) to move it to that page. "+" adds a spacer at the end of
// the page, "OK" leaves the mode (a long press does too).

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
  logStatus(editMode ? "Edit Layout: drag the shortcuts, drop on 1 2 3 4 to change page, OK when done." :
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

// Right-click on a shortcut in Edit Layout: move it one step (Up / Down
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

// Edit Layout "+": a dotted frame with a small "+", to show that it
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
    var cell = createEditCell(shown[i], i, vertical);
    editCells.push({ cell: cell, shortcut: shown[i] });
    layout.add(centeredCell(vertical, cell));
  }
  var lastGap = createGap(vertical);
  editGaps.push(lastGap);
  layout.add(centeredCell(vertical, lastGap));
  layout.add(centeredCell(vertical, createSpacerWidget(vertical)));
  layout.add(centeredCell(vertical, createSpacerTile()));
  layout.addSpacing(4);
  var done = new ui.Button("OK");
  done.setSize(24, 24);
  try { done.setFontSize(9); } catch (eF) {}
  done.setToolTip("Done: leave Edit Layout");
  done.onClick = toggleEditMode;
  layout.add(centeredCell(vertical, done));
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
  // Hold 1.5 s on an empty part of the bar: Edit Layout mode.
  container.onMousePress = function (position, button) {
    if (button === "left") {
      startLongPress();
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
  // Edit Layout would start by itself (e.g. after a click on Hide page
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
      label: (s.preset ? "♥ " : "") + (s.kind === "expression" ? " π  " : "") + s.label,
      tooltip: (s.preset ? "Favourite — " : "") + (s.kind === "script" ? s.path :
        (s.kind === "expression" ? "Expression: " + s.expression :
          (s.kind === "rig" ? "Rig — " + (s.description || s.label) :
          s.kind === "layout" ? "Shelf action" :
            (s.type || s.nodeName || "")))),
      threeDotsMenu: true
    };
    var icon = s.kind === "expression" ? null :
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

    var newBarBtn = new ui.Button("New Bar…");
    newBarBtn.onClick = openNewBarDialog;
    var importBarBtn = new ui.Button("Import Bar…");
    importBarBtn.setToolTip("Adds a bar exported with \"...\" > Export Bar… (with its rigs, scripts and icons)");
    importBarBtn.onClick = importBar;
    var updateBtn = new ui.Button("Update Bars");
    updateBtn.setToolTip("Regenerates the C-Bar_<Name>.js files from C-Bar.js");
    updateBtn.onClick = updateAllBarScripts;
    var barButtons = new ui.HLayout();
    // "Config…": Config Import… / Config Export… / Open Folder.
    var configBtn = new ui.Button("Config…");
    configBtn.setToolTip("Import or export the whole configuration (bars and rigs), open the C-Bar folder");
    configBtn.onClick = showConfigMenu;
    var exportBarBtn = new ui.Button("Export Bar…");
    exportBarBtn.setToolTip("Exports the bar selected in the list (with its rigs, scripts and icons)");
    exportBarBtn.onClick = function () {
      exportBar(editedBarId);
    };
    barButtons.add(newBarBtn, importBarBtn, exportBarBtn, updateBtn);
    barButtons.addStretch();
    barButtons.add(configBtn);

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
    if (s.kind === "script" && s.path && !pack.scripts[s.path] && api.filePathExists(s.path)) {
      try { pack.scripts[s.path] = api.readFromFile(s.path); } catch (e) {}
    }
    var icon = null;
    try { icon = resolveIcon(s); } catch (e2) {}
    if (icon && isInFolder(icon, ICONS_DIR)) {
      var iconName = String(icon).split(/[\/\\]/).pop();
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
  var nRigs = 0, nScripts = 0;
  for (var r in pack.rigs) { nRigs++; }
  for (var sc in pack.scripts) { nScripts++; }
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
    if (api.filePathExists(sp)) {
      scriptPaths[sp] = sp;
      continue;
    }
    ensureFolder(SCRIPTS_COPY_DIR);
    var copy = SCRIPTS_COPY_DIR + "/" + String(sp).split(/[\/\\]/).pop();
    if (!api.filePathExists(copy)) {
      try { api.writeToFile(copy, pack.scripts[sp], true); } catch (e2) {}
    }
    scriptPaths[sp] = copy;
  }

  // Icons: added to C-Bar_assets/icons when missing.
  for (var iconName in (pack.icons || {})) {
    var iconPath = ICONS_DIR + "/" + iconName;
    if (!api.filePathExists(iconPath)) {
      try { api.writeEncodedToBinaryFile(iconPath, pack.icons[iconName]); } catch (e3) {}
    }
  }

  for (var i = 0; i < shortcuts.length; i++) {
    var s = shortcuts[i];
    if (s.kind === "rig" && rigIds[s.rig]) {
      s.rig = rigIds[s.rig];
    }
    if (s.kind === "script" && scriptPaths[s.path]) {
      s.path = scriptPaths[s.path];
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
var configCountLabels = {};
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
  openFolder(ICONS_DIR);
}

// ============================================================
// Right-click menu and launch
// ============================================================

// The window has a single context menu: the "+" button swaps in its own
// short menu, shows it, then puts the right-click menu back.
function buildMainMenu() {
  ui.clearContextMenu();
  addMenuEntries(currentBar.id);
  ui.addMenuItem({ name: "Settings…", onMouseRelease: openManager });
  ui.addMenuItem({ name: editMode ? "Done Editing Layout" : "Edit Layout", onMouseRelease: toggleEditMode });
  ui.addMenuItem({ name: "" });
  ui.addMenuItem({ name: "New Bar…", onMouseRelease: openNewBarDialog });
  ui.addMenuItem({ name: "Open Script Icons Folder", onMouseRelease: openIconsFolder });
  ui.addMenuItem({ name: "" });
  ui.addMenuItem({ name: "Unlock Size (resize)", onMouseRelease: freeSize });
  ui.addMenuItem({ name: "Fit Bar to Buttons", onMouseRelease: fitToButtons });
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
  if (shortcut.kind === "script" || shortcut.kind === "spacer" || shortcut.kind === "expression" || shortcut.kind === "rig" || shortcut.kind === "layout") {
    return false;
  }
  var cat = getShortcutCategory(shortcut);
  return cat !== "shape" && cat !== "effect";
}

var PICKABLE_TYPES = ["double", "int", "double2", "int2", "double3", "int3", "color"];
var SKIPPED_ATTRS = []; // attributes never offered in the Alt + click menu

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
  for (var i = 0; i < attrs.length; i++) {
    var a = attrs[i];
    var d = null;
    try { d = api.getAttributeDefinition(layerId, a); } catch (e2) {}
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
  var outTypes = isExpr ? ["double", "int", "double2", "int2", "double3", "int3"] :
    (nodeType ? nodeOutputTypes(nodeType) : null);
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
  if (withSpacer !== false) {
    ui.addMenuItem({ name: "Spacer", onMouseRelease: function () { addSpacer(targetId); } });
  }
}

// From the bar's "+": every entry. From Settings > Add…: no Spacer
// (Settings has its own Spacer button).
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

buildMainMenu();
ui.showContextMenuOnRightClick();

ui.onClose = function () {
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
