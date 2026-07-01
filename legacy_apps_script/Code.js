// ============================================================
//  Code.gs  —  Server-side logic
// ============================================================

const ENTRIES_SHEET = "Entries";
const COMMENTS_SHEET = "Comments";
const IMAGES_FOLDER = "BigSMILES_Images";

// ── Serve the web app ─────────────────────────────────────────
function doGet() {
  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("BigSMILES Viewer")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

// ── One-time setup — run manually once from the IDE ───────────
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const entriesHeaders = [
    "Index",
    "BIGSMILES",
    "SVG",
    "Annotations",
    "Checked",
  ];

  const entriesSheet =
    ss.getSheetByName(ENTRIES_SHEET) || ss.insertSheet(ENTRIES_SHEET);
  _ensureHeaders(entriesSheet, entriesHeaders);
  entriesSheet.setFrozenRows(1);

  if (!ss.getSheetByName(COMMENTS_SHEET)) {
    const s = ss.insertSheet(COMMENTS_SHEET);
    s.appendRow([
      "EntryIndex",
      "Email",
      "Name",
      "Timestamp",
      "Text",
      "ImageURL",
    ]);
    s.setFrozenRows(1);
  }
  return "Sheets ready ✓";
}

// ── Get current user ──────────────────────────────────────────
function getCurrentUser() {
  const email = Session.getActiveUser().getEmail();
  return { email: email, name: email.split("@")[0] };
}

function _ensureHeaders(sheet, headers) {
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const existing = headerRange.getValues()[0];
  let changed = false;
  const next = headers.map((header, i) => {
    if (existing[i] === header) return existing[i];
    changed = true;
    return header;
  });
  if (changed) headerRange.setValues([next]);
}

// ── Get all entries (index + BIGSMILES only, for the list) ────
function getEntries() {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ENTRIES_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  return rows.map((r) => ({ index: String(r[0]), bigsmiles: String(r[1]) }));
}

function getCommentedEntryIndices() {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COMMENTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const indices = new Set();
  rows.forEach((r) => {
    const idx = String(r[0]).trim();
    if (idx) indices.add(idx);
  });
  return Array.from(indices);
}

// Checked APIs retain the legacy bookmark function names used by the client.
function getBookmarks() {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ENTRIES_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  return rows
    .filter((r) => _isEntryChecked(r[4]))
    .map((r) => String(r[0]));
}

function toggleBookmark(idx) {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ENTRIES_SHEET);
  if (!sheet) return { ok: false };

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(idx)) continue;

    const checked = _isEntryChecked(data[i][4]);
    sheet.getRange(i + 1, 5).setValue(checked ? "" : "TRUE");
    return { ok: true, bookmarked: !checked };
  }
  return { ok: false };
}

function _isEntryChecked(value) {
  if (value === true) return true;
  if (!value) return false;

  const text = String(value).trim();
  if (!text) return false;
  if (text.toLowerCase() === "true") return true;

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.length > 0;
    return parsed === true;
  } catch (e) {
    return false;
  }
}

// ── Get one full entry (with SVG + annotations) ───────────────
function getEntry(idx) {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ENTRIES_SHEET);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(idx)) {
      return {
        index: String(data[i][0]),
        bigsmiles: String(data[i][1]),
        svg: String(data[i][2] || ""),
        annotations: String(data[i][3] || "[]"),
      };
    }
  }
  return null;
}

// ── Save drawing annotations for an entry ────────────────────
function saveAnnotations(idx, json) {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ENTRIES_SHEET);
  if (!sheet) return { ok: false };
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(idx)) {
      sheet.getRange(i + 1, 4).setValue(json);
      return { ok: true };
    }
  }
  return { ok: false };
}

// ── Get all comments for an entry ────────────────────────────
function getComments(idx) {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COMMENTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  return data
    .slice(1)
    .filter((r) => String(r[0]) === String(idx))
    .map((r) => ({
      entryIndex: String(r[0]),
      email: String(r[1]),
      name: String(r[2]),
      timestamp: String(r[3]),
      text: String(r[4]),
      imageUrl: String(r[5] || ""),
    }));
}

// ── Post a new comment (with optional image) ──────────────────
function addComment(idx, text, displayName, imgB64, imgMime, imgName) {
  const sheet =
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COMMENTS_SHEET);
  if (!sheet) return { ok: false };

  if (arguments.length === 5) {
    imgName = imgMime;
    imgMime = imgB64;
    imgB64 = displayName;
    displayName = "";
  }

  const email = Session.getActiveUser().getEmail();
  const defaultName = email.split("@")[0];
  const name = String(displayName || "").trim() || defaultName;
  const ts = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd HH:mm",
  );

  let url = "";
  if (imgB64)
    url = _saveImage(imgB64, imgMime || "image/png", imgName || "img.png");

  sheet.appendRow([idx, email, name, ts, text, url]);
  return { ok: true };
}

// ── Save an image to Drive, return a public URL ───────────────
function _saveImage(b64, mime, name) {
  try {
    const it = DriveApp.getFoldersByName(IMAGES_FOLDER);
    const folder = it.hasNext()
      ? it.next()
      : DriveApp.createFolder(IMAGES_FOLDER);
    const blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, name);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return "https://drive.google.com/uc?id=" + file.getId();
  } catch (e) {
    Logger.log("Image save error: " + e);
    return "";
  }
}
