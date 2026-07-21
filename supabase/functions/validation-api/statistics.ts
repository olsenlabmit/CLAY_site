export const STATISTICS_CATEGORIES = [
  { id: "atom_overlap", name: "Atom overlap", abbreviation: "A.O." },
  { id: "invalid_valence", name: "Invalid valence", abbreviation: "I.V." },
  { id: "backbone_misplace", name: "Backbone misplace", abbreviation: "Ba.M." },
  { id: "bracket_misplace", name: "Bracket misplace", abbreviation: "Br. M." },
  { id: "miscellaneous", name: "Miscellaneous", abbreviation: "Misc." },
  {
    id: "suboptimal_bigsmiles",
    name: "Suboptimal BIGSMILES",
    abbreviation: "Sub.B.",
  },
  { id: "acceptable", name: "Acceptable", abbreviation: "Acceptable" },
] as const;

const RECOGNIZED_ERROR_MODES = new Set<string>(
  STATISTICS_CATEGORIES
    .filter((category) => category.id !== "acceptable")
    .map((category) => category.id),
);

export type StatisticsRow = {
  checked?: boolean | null;
  error_modes?: unknown;
};

export type StatisticsCategory = {
  id: string;
  name: string;
  abbreviation: string;
  count: number;
  percentage: number;
};

export type Statistics = {
  generatedAt: string;
  totalEntries: number;
  classifiedEntries: number;
  categories: StatisticsCategory[];
};

export function recognizedErrorModes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter((mode) => RECOGNIZED_ERROR_MODES.has(mode)),
    ),
  );
}

export function buildStatistics(
  rows: StatisticsRow[],
  generatedAt = new Date().toISOString(),
): Statistics {
  const counts = new Map<string, number>(
    STATISTICS_CATEGORIES.map((category) => [category.id, 0]),
  );
  let classifiedEntries = 0;

  for (const row of rows) {
    const modes = recognizedErrorModes(row.error_modes);
    const acceptable = Boolean(row.checked);
    if (acceptable || modes.length > 0) classifiedEntries += 1;
    if (acceptable) {
      counts.set("acceptable", (counts.get("acceptable") || 0) + 1);
    }
    for (const mode of modes) counts.set(mode, (counts.get(mode) || 0) + 1);
  }

  return {
    generatedAt,
    totalEntries: rows.length,
    classifiedEntries,
    categories: STATISTICS_CATEGORIES.map((category) => {
      const count = counts.get(category.id) || 0;
      return {
        ...category,
        count,
        percentage: classifiedEntries ? (count / classifiedEntries) * 100 : 0,
      };
    }),
  };
}

export function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function statisticsToCsv(statistics: Statistics): string {
  const header = [
    "generated_at",
    "total_entries",
    "classified_entries",
    "category_id",
    "category_name",
    "abbreviation",
    "count",
    "percentage",
  ];
  const rows = statistics.categories.map((category) => [
    statistics.generatedAt,
    statistics.totalEntries,
    statistics.classifiedEntries,
    category.id,
    category.name,
    category.abbreviation,
    category.count,
    category.percentage,
  ]);
  return [header, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n") + "\n";
}
