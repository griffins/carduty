/**
 * Prod static page generator — uses the same renderer as dev SSR.
 * Writes all pages into dist/ after Vite build.
 *
 * Run: node scripts/generate_pages.js
 * Called by: npm run build (after vite build)
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { resolve } from "path";
import { slugify, renderUrl, relatedVehiclesCrossMake } from "../plugins/render.js";

const ROOT       = new URL("..", import.meta.url).pathname;
const OUT_DIR    = resolve(ROOT, "dist");
const CURR_YEAR  = new Date().getFullYear(); // keep in sync with render.js CURRENT_YEAR
const MAX_AGE    = 8;
const BASE_URL   = "https://www.dutycheck.co.ke";
const LASTMOD    = resolveLastmod(); // see below — data change date, NOT build date

// Load CRSP data
const crsp = JSON.parse(readFileSync(resolve(ROOT, "data/crsp_cascade.json"), "utf-8"));

/**
 * Sitemap <lastmod> must reflect when the DATA changed, not when we deployed.
 * Previously this was the build date, so every deploy told search engines that
 * all ~57k URLs had changed — triggering a full recrawl each time and driving
 * a large share of the hosting bill.
 *
 * File mtimes can't be used: git does not preserve them, so Vercel's fresh
 * clone would reset them to build time. Instead we read a committed date and
 * verify it still matches the data's content hash. If the data changed without
 * `npm run data:version` being run, we fail safe to today and warn loudly.
 */
function resolveLastmod() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const v = JSON.parse(readFileSync(resolve(ROOT, "data/data-version.json"), "utf-8"));
    const actual = createHash("sha256")
      .update(readFileSync(resolve(ROOT, "data/crsp_cascade.json")))
      .digest("hex");
    if (actual !== v.sha256) {
      console.warn(
        `WARN: crsp_cascade.json changed but data-version.json was not regenerated.\n` +
        `      Falling back to today's date (causes a full recrawl).\n` +
        `      Fix with: npm run data:version`
      );
      return today;
    }
    return v.lastmod;
  } catch (err) {
    console.warn(`WARN: could not read data/data-version.json (${err.message}); using today.`);
    return today;
  }
}

function buildModelIndex(models) {
  const seen = {};
  return models.map((m, i) => {
    let slug = slugify(m.model) || `model-${i}`;
    if (seen[slug] !== undefined) slug = `${slug}-${i}`;
    seen[slug] = i;
    return { ...m, slug };
  });
}

let count = 0;

// ── Sitemap helpers ──────────────────────────────────────────────────────────

function urlEntry(loc, priority = "0.5", changefreq = "yearly") {
  return `  <url>\n    <loc>${BASE_URL}${loc}</loc>\n    <lastmod>${LASTMOD}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

function writeSitemap(filename, entries) {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
  ].join("\n");
  writeFileSync(`${OUT_DIR}/${filename}`, xml);
}

// Sitemap index entries (one per category sitemap + the main sitemap)
const sitemapIndexEntries = [];

// ── Page + sitemap generation ────────────────────────────────────────────────

// Main sitemap: homepage + category pages
const mainUrls = [urlEntry("/", "1.0", "monthly")];

for (const category of crsp.categories) {
  const catSlug = slugify(category);
  const catDir  = `${OUT_DIR}/${catSlug}`;
  mkdirSync(catDir, { recursive: true });

  const html = renderUrl(`/${catSlug}/`);
  if (html) { writeFileSync(`${catDir}/index.html`, html); count++; }

  mainUrls.push(urlEntry(`/${catSlug}/`, "0.8", "yearly"));

  // Per-category sitemap: make + model + year pages
  const catUrls = [];

  for (const [make, models] of Object.entries(crsp.data[category])) {
    const makeSlug = slugify(make);
    const makeDir  = `${catDir}/${makeSlug}`;
    mkdirSync(makeDir, { recursive: true });

    const makeHtml = renderUrl(`/${catSlug}/${makeSlug}/`);
    if (makeHtml) {
      writeFileSync(`${makeDir}/index.html`, makeHtml);
      count++;
      catUrls.push(urlEntry(`/${catSlug}/${makeSlug}/`, "0.7", "yearly"));
    }

    for (const m of buildModelIndex(models)) {
      const modelDir = `${makeDir}/${m.slug}`;
      mkdirSync(modelDir, { recursive: true });

      const modelHtml = renderUrl(`/${catSlug}/${makeSlug}/${m.slug}/`);
      if (modelHtml) {
        writeFileSync(`${modelDir}/index.html`, modelHtml);
        count++;
        catUrls.push(urlEntry(`/${catSlug}/${makeSlug}/${m.slug}/`, "0.6", "yearly"));
      }

      // Year pages: one per valid import year
      for (let yr = CURR_YEAR; yr >= CURR_YEAR - MAX_AGE; yr--) {
        const yearDir = `${modelDir}/${yr}`;
        mkdirSync(yearDir, { recursive: true });
        const yearHtml = renderUrl(`/${catSlug}/${makeSlug}/${m.slug}/${yr}/`);
        if (yearHtml) {
          writeFileSync(`${yearDir}/index.html`, yearHtml);
          count++;
          catUrls.push(urlEntry(`/${catSlug}/${makeSlug}/${m.slug}/${yr}/`, "0.5", "yearly"));
        }
      }
    }
  }

  const sitemapName = `sitemap-${catSlug}.xml`;
  writeSitemap(sitemapName, catUrls);
  sitemapIndexEntries.push(
    `  <sitemap>\n    <loc>${BASE_URL}/${sitemapName}</loc>\n    <lastmod>${LASTMOD}</lastmod>\n  </sitemap>`
  );
}

// ── Compare pages ──────────────────────────────────────────────────────────
// Each model vs its related vehicles only (not the full cartesian product),
// deduplicated so A-vs-B is emitted once (when comboA < comboB lexically).
const compareUrls = [];
let compareCount = 0;
const seenPairs = new Set();

for (const category of crsp.categories) {
  const catSlug = slugify(category);
  for (const [make, models] of Object.entries(crsp.data[category])) {
    const makeSlug = slugify(make);
    const indexed  = buildModelIndex(models);
    for (const m of indexed) {
      const comboA = `${makeSlug}-${m.slug}`;
      // Cross-make: pair with the closest-CRSP models across the whole
      // category (any make), so /compare/ covers cross-brand queries too.
      const related = relatedVehiclesCrossMake(category, make, m, 6);
      for (const r of related) {
        const comboB = `${r.makeSlug}-${r.slug}`;
        if (comboA === comboB) continue;
        const [lo, hi] = comboA < comboB ? [comboA, comboB] : [comboB, comboA];
        const key = `${lo}|${hi}`;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);

        const html = renderUrl(`/compare/${lo}/${hi}/`);
        if (html) {
          const dir = `${OUT_DIR}/compare/${lo}/${hi}`;
          mkdirSync(dir, { recursive: true });
          writeFileSync(`${dir}/index.html`, html);
          count++;
          compareCount++;
          compareUrls.push(urlEntry(`/compare/${lo}/${hi}/`, "0.4", "yearly"));
        }
      }
    }
  }
}

writeSitemap("sitemap-compare.xml", compareUrls);
sitemapIndexEntries.push(
  `  <sitemap>\n    <loc>${BASE_URL}/sitemap-compare.xml</loc>\n    <lastmod>${LASTMOD}</lastmod>\n  </sitemap>`
);
console.log(`Generated ${compareCount} compare pages`);

// Write main sitemap
writeSitemap("sitemap.xml", mainUrls);

// Write sitemap index
const sitemapIndex = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  `  <sitemap>\n    <loc>${BASE_URL}/sitemap.xml</loc>\n    <lastmod>${LASTMOD}</lastmod>\n  </sitemap>`,
  ...sitemapIndexEntries,
  "</sitemapindex>",
].join("\n");
writeFileSync(`${OUT_DIR}/sitemap-index.xml`, sitemapIndex);

console.log(`Generated ${count} pages + ${1 + sitemapIndexEntries.length + 1} sitemaps → dist/`);
