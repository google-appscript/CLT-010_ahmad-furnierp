import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktree sesi lain berada di dalam repositori ini dan membawa salinan
    // kodenya sendiri; melintasinya hanya menghasilkan temuan ganda.
    ".claude/**",
  ]),
]);

export default eslintConfig;
