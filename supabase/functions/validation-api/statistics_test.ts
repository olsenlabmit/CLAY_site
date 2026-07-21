import {
  buildStatistics,
  escapeCsv,
  STATISTICS_CATEGORIES,
  statisticsToCsv,
} from "./statistics.ts";

function assert(
  condition: unknown,
  message = "Assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(
    actualJson === expectedJson,
    `Expected ${expectedJson}, received ${actualJson}`,
  );
}

function assertAlmostEquals(
  actual: number,
  expected: number,
  tolerance = 1e-12,
): void {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${expected} +/- ${tolerance}, received ${actual}`,
  );
}

function categoryCounts(rows: Parameters<typeof buildStatistics>[0]): number[] {
  return buildStatistics(rows, "2026-07-21T12:00:00.000Z")
    .categories.map((category) => category.count);
}

Deno.test("statistics handles zero entries", () => {
  const statistics = buildStatistics([], "2026-07-21T12:00:00.000Z");
  assertEquals(statistics.totalEntries, 0);
  assertEquals(statistics.classifiedEntries, 0);
  assertEquals(statistics.categories.map((category) => category.percentage), [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);
});

Deno.test("statistics handles zero classified entries and ignores unknown modes", () => {
  const statistics = buildStatistics([
    { checked: false, error_modes: [] },
    { checked: false, error_modes: ["unknown_mode"] },
  ]);
  assertEquals(statistics.totalEntries, 2);
  assertEquals(statistics.classifiedEntries, 0);
  assertEquals(statistics.categories.map((category) => category.count), [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);
});

Deno.test("acceptable entries are classified and counted", () => {
  const statistics = buildStatistics([{ checked: true, error_modes: [] }]);
  assertEquals(statistics.classifiedEntries, 1);
  assertEquals(categoryCounts([{ checked: true, error_modes: [] }]), [
    0,
    0,
    0,
    0,
    0,
    0,
    1,
  ]);
  assertEquals(statistics.categories.at(-1)?.percentage, 100);
});

Deno.test("unchecked entries without recognized errors remain unclassified", () => {
  const statistics = buildStatistics([{ checked: false }, {
    error_modes: null,
  }]);
  assertEquals(statistics.classifiedEntries, 0);
});

Deno.test("multiple errors on one entry contribute to multiple categories", () => {
  const statistics = buildStatistics([
    { checked: false, error_modes: ["atom_overlap", "invalid_valence"] },
  ]);
  assertEquals(statistics.classifiedEntries, 1);
  assertEquals(
    statistics.categories.slice(0, 2).map((category) => category.count),
    [1, 1],
  );
  assertEquals(
    statistics.categories.slice(0, 2).map((category) => category.percentage),
    [100, 100],
  );
});

Deno.test("duplicate error modes count once per entry", () => {
  assertEquals(
    categoryCounts([
      { error_modes: ["atom_overlap", "atom_overlap", " atom_overlap "] },
    ]),
    [1, 0, 0, 0, 0, 0, 0],
  );
});

Deno.test("percentages use classified entries as their denominator", () => {
  const statistics = buildStatistics([
    { error_modes: ["atom_overlap"] },
    { error_modes: ["atom_overlap", "miscellaneous"] },
    { checked: true },
    {},
  ]);
  assertEquals(statistics.classifiedEntries, 3);
  assertAlmostEquals(statistics.categories[0].percentage, 200 / 3);
  assertAlmostEquals(statistics.categories[4].percentage, 100 / 3);
  assertAlmostEquals(statistics.categories[6].percentage, 100 / 3);
});

Deno.test("statistics categories keep the public order and abbreviations", () => {
  assertEquals(
    STATISTICS_CATEGORIES.map(({ id, abbreviation }) => ({ id, abbreviation })),
    [
      { id: "atom_overlap", abbreviation: "A.O." },
      { id: "invalid_valence", abbreviation: "I.V." },
      { id: "backbone_misplace", abbreviation: "Ba.M." },
      { id: "bracket_misplace", abbreviation: "Br. M." },
      { id: "miscellaneous", abbreviation: "Misc." },
      { id: "suboptimal_bigsmiles", abbreviation: "Sub.B." },
      { id: "acceptable", abbreviation: "Acceptable" },
    ],
  );
});

Deno.test("CSV escaping and shape are stable", () => {
  assertEquals(escapeCsv('a,"b"\nc'), '"a,""b""\nc"');
  const csv = statisticsToCsv(buildStatistics(
    [{ checked: true }],
    "2026-07-21T12:00:00.000Z",
  ));
  const lines = csv.trimEnd().split("\n");
  assertEquals(lines.length, 8);
  assertEquals(
    lines[0],
    "generated_at,total_entries,classified_entries,category_id,category_name,abbreviation,count,percentage",
  );
  assertEquals(
    lines.at(-1),
    "2026-07-21T12:00:00.000Z,1,1,acceptable,Acceptable,Acceptable,1,100",
  );
});
