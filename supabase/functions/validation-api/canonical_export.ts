import { strToU8, zipSync } from "npm:fflate@0.8.2";

export interface CanonicalSvg {
  entryIndex: string;
  svg: string;
}

export interface CanonicalArchive {
  bytes: Uint8Array;
  filename: string;
  folderName: string;
}

export function canonicalFolderName(now: Date): string {
  if (Number.isNaN(now.getTime())) {
    throw new Error("Invalid archive timestamp.");
  }
  return `canonical-${
    now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
  }`;
}

function validateEntryIndex(value: string): string {
  const index = String(value || "");
  if (
    !index ||
    index === "." ||
    index === ".." ||
    /[\/\\\x00-\x1f]/.test(index)
  ) {
    throw new Error(
      `Unsafe entry index for ZIP path: ${JSON.stringify(index)}`,
    );
  }
  return index;
}

export function buildCanonicalArchive(
  entries: CanonicalSvg[],
  now = new Date(),
): CanonicalArchive {
  const folderName = canonicalFolderName(now);
  const files: Record<string, Uint8Array> = {};
  const seen = new Set<string>();

  for (const entry of entries) {
    const index = validateEntryIndex(entry.entryIndex);
    if (seen.has(index)) throw new Error(`Duplicate entry index: ${index}`);
    seen.add(index);
    files[`${folderName}/${index}.svg`] = strToU8(String(entry.svg || ""));
  }

  return {
    bytes: zipSync(files, { level: 0 }),
    filename: `${folderName}.zip`,
    folderName,
  };
}
