import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const envPath = resolve(root, ".env.local");
const sqlPath = resolve(root, "database", "001_initial_schema.sql");

const requiredPublicVars = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET"
];

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

      const key = trimmed.slice(0, equalsIndex).trim();
      const value = trimmed.slice(equalsIndex + 1).trim();
      values[key] = value;
      return values;
    }, {});
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const env = parseEnvFile(envPath);
const failures = [];
const warnings = [];

if (!env) {
  failures.push(".env.local does not exist.");
} else {
  for (const key of requiredPublicVars) {
    if (!env[key]) {
      failures.push(`${key} is empty.`);
    }
  }

  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseKey) {
    failures.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is empty.");
  }

  if (env.NEXT_PUBLIC_SITE_URL && !isValidUrl(env.NEXT_PUBLIC_SITE_URL)) {
    failures.push("NEXT_PUBLIC_SITE_URL is not a valid http(s) URL.");
  }

  if (env.NEXT_PUBLIC_SUPABASE_URL && !isValidUrl(env.NEXT_PUBLIC_SUPABASE_URL)) {
    failures.push("NEXT_PUBLIC_SUPABASE_URL is not a valid http(s) URL.");
  }

  if (supabaseKey && supabaseKey.length < 40) {
    warnings.push("Supabase publishable/anon key looks unusually short.");
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    warnings.push("SUPABASE_SERVICE_ROLE_KEY is empty. This is OK until Netlify Functions are implemented.");
  }
}

if (!existsSync(sqlPath)) {
  failures.push("database/001_initial_schema.sql does not exist.");
}

if (failures.length > 0) {
  console.error("Setup check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  if (warnings.length > 0) {
    console.error("");
    console.error("Warnings:");
    for (const warning of warnings) {
      console.error(`- ${warning}`);
    }
  }

  process.exit(1);
}

console.log("Setup check passed.");

if (warnings.length > 0) {
  console.log("");
  console.log("Warnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}
