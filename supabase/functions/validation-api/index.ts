import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildStatistics, statisticsToCsv } from "./statistics.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const reviewKey = Deno.env.get("VALIDATION_REVIEW_KEY") || "";
const imageBucket =
  Deno.env.get("VALIDATION_COMMENT_IMAGE_BUCKET") || "validation-comment-images";
const allowedOrigin = Deno.env.get("VALIDATION_CORS_ORIGIN") || "*";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

type JsonBody = Record<string, unknown>;

const allowedErrorModes = new Set([
  "atom_overlap",
  "invalid_valence",
  "backbone_misplace",
  "bracket_misplace",
  "miscellaneous",
  "suboptimal_bigsmiles",
]);

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS",
    "access-control-allow-headers":
      "authorization,apikey,content-type,x-validation-key,x-reviewer-name",
  };
}

function json(
  payload: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

function error(
  message: string,
  status = 400,
  extraHeaders: Record<string, string> = {},
): Response {
  return json({ ok: false, error: message }, status, extraHeaders);
}

function requireWriteKey(req: Request): Response | null {
  if (!reviewKey) return error("VALIDATION_REVIEW_KEY is not configured.", 500);
  if (req.headers.get("x-validation-key") !== reviewKey) {
    return error("Invalid validation key.", 401);
  }
  return null;
}

async function readBody(req: Request): Promise<JsonBody> {
  if (!req.body) return {};
  return (await req.json()) as JsonBody;
}

function parseAnnotations(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function annotationString(value: unknown): string {
  return JSON.stringify(Array.isArray(value) ? value : parseAnnotations(value));
}

function normalizeErrorModes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const modes: string[] = [];
  for (const item of value) {
    const mode = String(item || "").trim();
    if (!allowedErrorModes.has(mode)) continue;
    if (!modes.includes(mode)) modes.push(mode);
  }
  return modes;
}

function parseErrorModes(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const modes: string[] = [];
  for (const item of value) {
    const mode = String(item || "").trim();
    if (!allowedErrorModes.has(mode)) return null;
    if (!modes.includes(mode)) modes.push(mode);
  }
  return modes;
}

function rowToEntry(row: {
  entry_index: string;
  bigsmiles: string;
  svg?: string;
  mol?: string;
  mol_file_name?: string;
  annotations?: unknown;
  checked?: boolean;
  error_modes?: unknown;
  updated_at?: string;
}) {
  return {
    index: String(row.entry_index),
    bigsmiles: String(row.bigsmiles || ""),
    svg: String(row.svg || ""),
    mol: String(row.mol || ""),
    molFileName: String(row.mol_file_name || ""),
    annotations: annotationString(row.annotations || []),
    checked: Boolean(row.checked),
    errorModes: normalizeErrorModes(row.error_modes),
    updatedAt: String(row.updated_at || ""),
  };
}

function rowToComment(row: {
  entry_index: string;
  reviewer_email: string | null;
  reviewer_name: string;
  created_at: string;
  text: string;
  image_url: string | null;
}) {
  return {
    entryIndex: String(row.entry_index),
    email: String(row.reviewer_email || ""),
    name: String(row.reviewer_name || ""),
    timestamp: formatTimestamp(row.created_at),
    text: String(row.text || ""),
    imageUrl: String(row.image_url || ""),
  };
}

function compareEntryIndex(a: string, b: string): number {
  const aNum = Number(a);
  const bNum = Number(b);
  if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
    return aNum - bNum;
  }
  return a.localeCompare(b, undefined, { numeric: true });
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function decodeBase64(value: string): Uint8Array {
  const raw = atob(value);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function safeName(value: unknown): string {
  return String(value || "image.png")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120) || "image.png";
}

async function uploadImage(
  entryIndex: string,
  body: JsonBody,
): Promise<string> {
  const imgB64 = String(body.imgB64 || "");
  if (!imgB64) return "";

  const mime = String(body.imgMime || "image/png");
  const name = safeName(body.imgName);
  const path = `${entryIndex}/${Date.now()}-${crypto.randomUUID()}-${name}`;
  const { error: uploadError } = await supabase.storage
    .from(imageBucket)
    .upload(path, decodeBase64(imgB64), {
      contentType: mime,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(imageBucket).getPublicUrl(path);
  return data.publicUrl;
}

async function handleEntries(): Promise<Response> {
  const { data, error: queryError } = await supabase
    .from("entries")
    .select("entry_index,bigsmiles,checked,error_modes,updated_at")
    .order("entry_index", { ascending: true });
  if (queryError) return error(queryError.message, 500);
  return json(
    (data || [])
      .sort((a, b) => compareEntryIndex(String(a.entry_index), String(b.entry_index)))
      .map((row) => ({
        index: String(row.entry_index),
        bigsmiles: String(row.bigsmiles || ""),
        checked: Boolean(row.checked),
        errorModes: normalizeErrorModes(row.error_modes),
        updatedAt: String(row.updated_at || ""),
      })),
  );
}

async function handleStatistics(format: "json" | "csv"): Promise<Response> {
  const noStoreHeaders = { "cache-control": "no-store" };
  const { data, error: queryError } = await supabase
    .from("entries")
    .select("checked,error_modes");
  if (queryError) return error(queryError.message, 500, noStoreHeaders);

  const statistics = buildStatistics(data || []);
  if (format === "json") return json(statistics, 200, noStoreHeaders);
  return new Response(statisticsToCsv(statistics), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="validation-statistics.csv"',
      ...corsHeaders(),
      ...noStoreHeaders,
    },
  });
}

async function handleCheckedEntries(): Promise<Response> {
  const { data, error: queryError } = await supabase
    .from("entries")
    .select("entry_index")
    .eq("checked", true);
  if (queryError) return error(queryError.message, 500);
  return json(
    (data || [])
      .map((row) => String(row.entry_index))
      .sort(compareEntryIndex),
  );
}

async function handleCommentedEntries(): Promise<Response> {
  const { data, error: queryError } = await supabase
    .from("comments")
    .select("entry_index");
  if (queryError) return error(queryError.message, 500);
  return json(
    Array.from(new Set((data || []).map((row) => String(row.entry_index))))
      .sort(compareEntryIndex),
  );
}

async function handleEntry(entryIndex: string): Promise<Response> {
  const { data, error: queryError } = await supabase
    .from("entries")
    .select("entry_index,bigsmiles,svg,mol,mol_file_name,annotations,checked,error_modes,updated_at")
    .eq("entry_index", entryIndex)
    .maybeSingle();
  if (queryError) return error(queryError.message, 500);
  return json(data ? rowToEntry(data) : null);
}

async function handleCheckedPatch(req: Request, entryIndex: string): Promise<Response> {
  const keyError = requireWriteKey(req);
  if (keyError) return keyError;
  const body = await readBody(req);
  const checked = Boolean(body.checked);
  const update = checked ? { checked, error_modes: [] } : { checked };
  const { data, error: updateError } = await supabase
    .from("entries")
    .update(update)
    .eq("entry_index", entryIndex)
    .select("entry_index,checked,error_modes,updated_at")
    .maybeSingle();
  if (updateError) return error(updateError.message, 500);
  if (!data) return json({ ok: false, bookmarked: false });
  return json({
    ok: true,
    bookmarked: Boolean(data.checked),
    checked: Boolean(data.checked),
    errorModes: normalizeErrorModes(data.error_modes),
    updatedAt: String(data.updated_at || ""),
  });
}

async function handleErrorModesPatch(req: Request, entryIndex: string): Promise<Response> {
  const keyError = requireWriteKey(req);
  if (keyError) return keyError;
  const body = await readBody(req);
  const errorModes = parseErrorModes(body.errorModes);
  if (!errorModes) return error("errorModes must contain only allowed error mode ids.", 400);
  const checked = false;
  const { data, error: updateError } = await supabase
    .from("entries")
    .update({ error_modes: errorModes, checked })
    .eq("entry_index", entryIndex)
    .select("entry_index,checked,error_modes,updated_at")
    .maybeSingle();
  if (updateError) return error(updateError.message, 500);
  if (!data) return json({ ok: false, errorModes: [], checked: false });
  return json({
    ok: true,
    errorModes: normalizeErrorModes(data.error_modes),
    checked: Boolean(data.checked),
    updatedAt: String(data.updated_at || ""),
  });
}

async function handleAnnotationsPut(req: Request, entryIndex: string): Promise<Response> {
  const keyError = requireWriteKey(req);
  if (keyError) return keyError;
  const body = await readBody(req);
  const annotations = parseAnnotations(body.annotations);
  const { data, error: updateError } = await supabase
    .from("entries")
    .update({ annotations })
    .eq("entry_index", entryIndex)
    .select("entry_index,updated_at")
    .maybeSingle();
  if (updateError) return error(updateError.message, 500);
  if (!data) return json({ ok: false });
  return json({ ok: true, updatedAt: String(data.updated_at || "") });
}

async function handleComments(entryIndex: string): Promise<Response> {
  const { data, error: queryError } = await supabase
    .from("comments")
    .select("entry_index,reviewer_email,reviewer_name,created_at,text,image_url")
    .eq("entry_index", entryIndex)
    .order("created_at", { ascending: true });
  if (queryError) return error(queryError.message, 500);
  return json((data || []).map(rowToComment));
}

async function handleCommentPost(req: Request, entryIndex: string): Promise<Response> {
  const keyError = requireWriteKey(req);
  if (keyError) return keyError;
  const body = await readBody(req);
  const reviewerName = String(
    body.displayName || req.headers.get("x-reviewer-name") || "",
  ).trim();
  if (!reviewerName) return error("Reviewer name is required.", 400);

  let imageUrl = "";
  try {
    imageUrl = await uploadImage(entryIndex, body);
  } catch (uploadError) {
    return error(`Image upload failed: ${(uploadError as Error).message}`, 500);
  }

  const { error: insertError } = await supabase.from("comments").insert({
    entry_index: entryIndex,
    reviewer_name: reviewerName,
    reviewer_email: null,
    text: String(body.text || ""),
    image_url: imageUrl || null,
  });
  if (insertError) return error(insertError.message, 500);
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });

  const url = new URL(req.url);
  const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const apiIndex = parts.lastIndexOf("validation-api");
  const route = apiIndex >= 0 ? parts.slice(apiIndex + 1) : parts;

  try {
    if (req.method === "GET" && route.length === 1 && route[0] === "me") {
      const keyError = requireWriteKey(req);
      if (keyError) return keyError;
      return json({
        email: "",
        name: req.headers.get("x-reviewer-name") || "",
      });
    }
    if (req.method === "GET" && route.length === 1 && route[0] === "entries") {
      return await handleEntries();
    }
    if (req.method === "GET" && route.length === 1 && route[0] === "statistics") {
      return await handleStatistics("json");
    }
    if (req.method === "GET" && route.length === 1 && route[0] === "statistics.csv") {
      return await handleStatistics("csv");
    }
    if (
      req.method === "GET" &&
      route.length === 2 &&
      route[0] === "entries" &&
      route[1] === "commented"
    ) {
      return await handleCommentedEntries();
    }
    if (
      req.method === "GET" &&
      route.length === 2 &&
      route[0] === "entries" &&
      route[1] === "checked"
    ) {
      return await handleCheckedEntries();
    }
    if (route.length >= 2 && route[0] === "entries") {
      const entryIndex = decodeURIComponent(route[1]);
      if (req.method === "GET" && route.length === 2) return await handleEntry(entryIndex);
      if (req.method === "PATCH" && route[2] === "checked") {
        return await handleCheckedPatch(req, entryIndex);
      }
      if (req.method === "PATCH" && route[2] === "error-modes") {
        return await handleErrorModesPatch(req, entryIndex);
      }
      if (req.method === "PUT" && route[2] === "annotations") {
        return await handleAnnotationsPut(req, entryIndex);
      }
      if (req.method === "GET" && route[2] === "comments") {
        return await handleComments(entryIndex);
      }
      if (req.method === "POST" && route[2] === "comments") {
        return await handleCommentPost(req, entryIndex);
      }
    }
  } catch (caught) {
    return error((caught as Error).message || String(caught), 500);
  }

  return error("Not found.", 404);
});
