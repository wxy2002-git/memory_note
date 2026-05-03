import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");

function parseEnvFile(path) {
  if (!existsSync(path)) {
    return null;
  }

  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .reduce((values, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        return values;
      }

      const equalsIndex = trimmed.indexOf("=");

      if (equalsIndex === -1) {
        return values;
      }

      values[trimmed.slice(0, equalsIndex).trim()] = trimmed.slice(equalsIndex + 1).trim();
      return values;
    }, {});
}

const env = parseEnvFile(envPath);

let exitCode = 0;

if (!env) {
  console.error(".env.local does not exist.");
  process.exit(1);
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and Supabase publishable/anon key are required.");
  process.exit(1);
}

const endpoint = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/questions?select=id&limit=1`;
const headers = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`
};

const response = await fetch(endpoint, {
  headers
});
const body = await response.text();

const checks = [
  { kind: "table", name: "profiles", path: "/rest/v1/profiles?select=id&limit=1" },
  { kind: "table", name: "questions", path: "/rest/v1/questions?select=id&limit=1" },
  { kind: "table", name: "answer_articles", path: "/rest/v1/answer_articles?select=id&limit=1" },
  { kind: "table", name: "documents", path: "/rest/v1/documents?select=id&limit=1" },
  { kind: "table", name: "derived_question_links", path: "/rest/v1/derived_question_links?select=id&limit=1" },
  { kind: "table", name: "flowcharts", path: "/rest/v1/flowcharts?select=id&limit=1" },
  { kind: "table", name: "assets", path: "/rest/v1/assets?select=id&limit=1" },
  { kind: "view", name: "question_stats", path: "/rest/v1/question_stats?select=question_id&limit=1" },
  { kind: "view", name: "article_overview", path: "/rest/v1/article_overview?select=article_id&limit=1" },
  { kind: "view", name: "document_overview", path: "/rest/v1/document_overview?select=document_id&limit=1" }
];

function isExpectedRestrictedResponse(status, text) {
  return status === 401 || status === 403 || /permission denied|row-level security|not authorized/i.test(text);
}

function isMissingObject(text) {
  return /PGRST205|could not find|does not exist|not found/i.test(text);
}

async function checkObject(check) {
  const checkResponse = await fetch(`${supabaseUrl.replace(/\/$/, "")}${check.path}`, {
    headers
  });
  const checkBody = await checkResponse.text();

  if (checkResponse.ok || isExpectedRestrictedResponse(checkResponse.status, checkBody)) {
    return { ...check, ok: true };
  }

  return {
    ...check,
    ok: false,
    status: checkResponse.status,
    body: checkBody
  };
}

const results = await Promise.all(checks.map(checkObject));
const failed = results.filter((result) => !result.ok);

for (const result of results) {
  console.log(`${result.ok ? "OK" : "FAIL"} ${result.kind}: ${result.name}`);
}

if (failed.length > 0) {
  console.error("");
  console.error("Supabase object checks failed:");
  for (const failure of failed) {
    const hint =
      failure.name === "note-assets"
        ? "Run database/002_fix_storage_bucket.sql in this Supabase project."
        : isMissingObject(failure.body)
          ? "Re-run database/001_initial_schema.sql in this Supabase project."
          : "Check Supabase API settings and SQL execution output.";
    console.error(`- ${failure.kind} ${failure.name}: HTTP ${failure.status}. ${hint}`);
  }
  process.exit(1);
}

console.log("");
console.log("Supabase schema objects look ready.");
console.log("Storage bucket note-assets cannot be fully verified with the publishable key before login; confirm it in the Supabase Storage UI if image upload fails.");

const legacyResponse = response;
const legacyBody = body;

if (legacyResponse.ok) {
  console.log("Supabase API reachable. questions table can be queried with the current session.");
} else if (isExpectedRestrictedResponse(legacyResponse.status, legacyBody)) {
  console.log("Supabase API reachable. questions table exists, and access is restricted as expected before login.");
} else if (/PGRST205|could not find.*questions/i.test(legacyBody)) {
  console.error("Supabase is reachable, but public.questions was not found. Re-run database/001_initial_schema.sql in this project.");
  exitCode = 1;
} else {
  console.error("Supabase check failed:");
  console.error(`- HTTP ${legacyResponse.status}`);
  console.error(`- ${legacyBody}`);
  exitCode = 1;
}

process.exitCode = exitCode;
