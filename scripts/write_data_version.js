/**
 * Records the CRSP data's content hash + the date it changed.
 * generate_pages.js reads this to stamp an honest <lastmod> in the sitemaps,
 * instead of the build date (which caused a full search-engine recrawl on
 * every deploy). File mtimes can't be used: git does not preserve them, so a
 * fresh Vercel clone would reset them to build time.
 *
 * Run: npm run data:version   (after any change to data/crsp_cascade.json)
 */
import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const ROOT = new URL("..", import.meta.url).pathname;
const DATA = resolve(ROOT, "data/crsp_cascade.json");
const OUT = resolve(ROOT, "data/data-version.json");

const sha256 = createHash("sha256").update(readFileSync(DATA)).digest("hex");
const lastmod = new Date().toISOString().slice(0, 10);

writeFileSync(OUT, JSON.stringify({
  _comment: "Drives <lastmod> in all sitemaps. Regenerate with: npm run data:version",
  lastmod,
  sha256,
}, null, 2) + "\n");

console.log(`data-version.json -> lastmod ${lastmod}, sha256 ${sha256.slice(0, 12)}…`);
