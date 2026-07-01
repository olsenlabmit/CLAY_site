/**
 * Manual batch-upload utilities for the Apps Script IDE.
 *
 * These functions are intentionally not called by the web app. Run them from
 * the editor when importing generated SVG layouts into the Entries sheet.
 */

function uploadFromFolder(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  const rows = [];
  let nextIndex = _nextBatchEntryIndex_();

  while (files.hasNext()) {
    const file = files.next();
    if (!_isSvgFile_(file)) continue;

    const svg = DriveApp.getFileById(file.getId())
      .getBlob()
      .getDataAsString();
    rows.push([
      nextIndex++,
      _bigsmilesFromSvgFileName_(file.getName()),
      svg,
      "[]",
      "[]",
    ]);
  }

  _appendBatchEntryRows_(rows);
  return { ok: true, added: rows.length };
}

function uploadFromCSV(fileId) {
  const csvFile = DriveApp.getFileById(fileId);
  const csv = csvFile.getBlob().getDataAsString();
  const records = Utilities.parseCsv(csv);
  const rows = [];

  for (let i = _firstCsvDataRow_(records); i < records.length; i++) {
    const record = records[i] || [];
    const index = String(record[0] || "").trim();
    const bigsmiles = String(record[1] || "").trim();
    const svgFileName = String(record[2] || "").trim();
    if (!index || !svgFileName) continue;

    const svgFile = _findSiblingDriveFile_(csvFile, svgFileName);
    const svg = DriveApp.getFileById(svgFile.getId())
      .getBlob()
      .getDataAsString();
    rows.push([index, bigsmiles, svg, "[]", "[]"]);
  }

  _appendBatchEntryRows_(rows);
  return { ok: true, added: rows.length };
}

function _appendBatchEntryRows_(rows) {
  if (!rows.length) return;

  const sheet = _batchEntriesSheet_();
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
}

function _batchEntriesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("No active spreadsheet is available.");

  let sheet = ss.getSheetByName(ENTRIES_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(ENTRIES_SHEET);
  }
  _ensureHeaders(sheet, ["Index", "BIGSMILES", "SVG", "Annotations", "Bookmarks"]);
  sheet.setFrozenRows(1);
  return sheet;
}

function _nextBatchEntryIndex_() {
  const sheet = _batchEntriesSheet_();
  if (sheet.getLastRow() < 2) return 1;

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const maxIndex = values.reduce((max, row) => {
    const value = Number(row[0]);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  return maxIndex + 1;
}

function _isSvgFile_(file) {
  const name = String(file.getName() || "").toLowerCase();
  const contentType = String(file.getMimeType() || "").toLowerCase();
  return name.endsWith(".svg") || contentType === "image/svg+xml";
}

function _bigsmilesFromSvgFileName_(name) {
  return String(name || "").replace(/\.svg$/i, "");
}

function _firstCsvDataRow_(records) {
  if (!records.length) return 0;

  const first = records[0].map((cell) =>
    String(cell || "").trim().toLowerCase(),
  );
  if (
    first[0] === "index" &&
    first[1] === "bigsmiles" &&
    (first[2] === "svg-file-name" ||
      first[2] === "svg file name" ||
      first[2] === "svg_file_name" ||
      first[2] === "svg")
  ) {
    return 1;
  }
  return 0;
}

function _findSiblingDriveFile_(csvFile, fileName) {
  const parents = csvFile.getParents();
  while (parents.hasNext()) {
    const folder = parents.next();
    const files = folder.getFilesByName(fileName);
    if (files.hasNext()) return files.next();
  }

  const files = DriveApp.getFilesByName(fileName);
  if (files.hasNext()) return files.next();
  throw new Error("Could not find SVG file named: " + fileName);
}

/*
 * Local validation_manifest.csv generation recipe.
 *
 * This is intentionally documented here, rather than executed by Apps Script:
 * the manifest is built from local repository files and the generated local SVG
 * directory before uploadFromCSV(fileId) imports it from Drive.
 *
 * PowerShell:
 *
 * conda activate rdkit-env
 * @'
 * import csv
 * import json
 * import re
 * from pathlib import Path
 *
 * repo = Path(r"C:\Users\ChemEGrad2025\Documents\MIT\Research\BIGSMILES_clay")
 * data_path = repo / "data" / "cleanDatasetLayout.json"
 * svg_dir = repo / "validation_site" / "validation_svgs_v1"
 * csv_path = repo / "validation_site" / "validation_manifest.csv"
 *
 * invalid_filename_chars = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
 *
 * def safe_filename_component(value):
 *     name = invalid_filename_chars.sub("_", str(value)).strip(" .")
 *     return name or "unnamed"
 *
 * def validation_svg_name(entry):
 *     return f"{safe_filename_component(entry['index'])} - {safe_filename_component(entry.get('name', 'unnamed'))}.svg"
 *
 * entries = json.loads(data_path.read_text(encoding="utf-8"))
 * svg_names = {path.name for path in svg_dir.glob("*.svg")}
 *
 * rows = []
 * missing_bigsmiles = []
 * for entry in entries:
 *     svg_name = validation_svg_name(entry)
 *     if svg_name not in svg_names:
 *         continue
 *     bigsmiles = entry.get("bigsmiles")
 *     if bigsmiles is None:
 *         missing_bigsmiles.append(svg_name)
 *         continue
 *     rows.append([entry["index"], bigsmiles, svg_name])
 *
 * if missing_bigsmiles:
 *     raise SystemExit("Entries with SVGs are missing bigsmiles: " + ", ".join(missing_bigsmiles))
 *
 * with csv_path.open("w", newline="", encoding="utf-8") as handle:
 *     writer = csv.writer(handle)
 *     writer.writerow(["index", "BIGSMILES", "SVG-file-name"])
 *     writer.writerows(rows)
 *
 * missing_rows = svg_names - {row[2] for row in rows}
 * if missing_rows:
 *     raise SystemExit("SVG files without CSV rows: " + ", ".join(sorted(missing_rows)[:20]))
 *
 * print(f"Wrote {len(rows)} rows to {csv_path}")
 * '@ | python -
 */
