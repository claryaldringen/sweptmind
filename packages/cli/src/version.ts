import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// package.json is one level up from both src/ and dist/
export const VERSION: string = (require("../package.json") as { version: string }).version;
