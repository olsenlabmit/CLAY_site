import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { strFromU8, unzipSync } from "npm:fflate@0.8.2";
import { buildCanonicalArchive } from "./canonical_export.ts";

Deno.test("canonical export uses deterministic folder and Index.svg paths", () => {
  const archive = buildCanonicalArchive(
    [
      { entryIndex: "2", svg: "<svg>two</svg>" },
      { entryIndex: "10", svg: "<svg>ten</svg>" },
    ],
    new Date("2026-07-28T15:04:05.678Z"),
  );

  assertEquals(archive.folderName, "canonical-20260728T150405Z");
  assertEquals(archive.filename, "canonical-20260728T150405Z.zip");
  assertEquals(Array.from(archive.bytes.slice(8, 10)), [0, 0]);

  const files = unzipSync(archive.bytes);
  const two = files["canonical-20260728T150405Z/2.svg"];
  const ten = files["canonical-20260728T150405Z/10.svg"];
  assertExists(two);
  assertExists(ten);
  assertEquals(Object.keys(files).sort(), [
    "canonical-20260728T150405Z/10.svg",
    "canonical-20260728T150405Z/2.svg",
  ]);
  assertEquals(strFromU8(two), "<svg>two</svg>");
  assertEquals(strFromU8(ten), "<svg>ten</svg>");
});
