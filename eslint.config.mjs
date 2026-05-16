import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores([
    ".netlify/**",
    ".next/**",
    ".playwright-mcp/**",
    "out/**",
    "node_modules/**",
    "netlify-static/**",
    "*.tsbuildinfo"
  ]),
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn"
    }
  }
]);
