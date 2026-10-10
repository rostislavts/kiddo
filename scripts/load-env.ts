import { createRequire } from "node:module";
// @next/env is CommonJS; require works both in tsx ESM and drizzle-kit's CJS loader.
const { loadEnvConfig } = createRequire(`${process.cwd()}/package.json`)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
