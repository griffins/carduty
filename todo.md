# Duty Check — Todo

## In Progress / Recent
- [x] Vite + Tailwind v4 calculator setup
- [x] CRSP cascade data (11 categories, 5,683 entries)
- [x] Dark/light mode
- [x] Cascading category → make → model → year flow with chips
- [x] Collapsible sections (auto-collapse on next step)
- [x] Auto-calculate on year click (no button)
- [x] Real URL paths via pushState (/suv/toyota/harrier/2022/)
- [x] Dev SSR via Vite middleware, prod static generation
- [x] Year pages: /suv/toyota/harrier/2022/ (SEO + shareable)
- [x] SVG icons fix (DOMParser "text/html" mode)
- [x] Human-readable formula section

## Pending Features

### High priority
- [x] Insurance estimate widget — leadGenHtml() on year pages: 4-6% of CRSP/year estimate + "Get insurance quotes" CTA (WhatsApp enquiry; swap for Britam/Jubilee/CIC partner deep-link once signed)
- [x] Finance pre-qualification CTA — leadGenHtml() shows asset-finance CTA when crsp+duty > KES 3M, passes vehicle + all-in cost (WhatsApp enquiry; swap for Stanbic/NCBA/I&M link once signed)
- [x] Turbolinks-style navigation — @hotwired/turbo (vendored to public/vendor/turbo.min.js, auto-starts); GA page_view on turbo:load via public/turbo-init.js; calculator + theme re-init idempotently on turbo:load
- [x] Fix external links — CRSP Excel + KRA duty page 200 OK; Finance Act URL corrected to /akn/ke/act/2025/9/eng (old @2025-07-01 point-in-time 404'd)

### Medium priority
- [x] Model page — fully clickable year-by-year duty table (each row → full breakdown); trim distinction is per-model CRSP row. (Interactive JS year picker deferred as redundant with the table.)
- [x] Compare feature — /compare/{comboA}/{comboB}/ side-by-side (renderComparePage)
- [x] Prod build test — npm run build generates all pages, exit 0

### SEO / Content
- [x] Canonical domain fix: ALL refs (canonical, og:url, JSON-LD, sitemap, robots) now use www (matches DNS naked→www 301). Fixes GSC www/apex split.
- [x] JSON-LD structured data: BreadcrumbList + FAQPage on generated pages (render.js); WebApplication + WebSite on homepage
- [x] Fix GSC "Missing field 'item' (in 'itemListElement')" — every BreadcrumbList ListItem now emits `item`; trailing self-crumb uses the page canonical URL (render.js breadcrumbJsonLd)
- [x] Sitemap.xml generation in build script (sitemap-index.xml + sitemap.xml + 11 per-category sitemaps)
- [x] robots.txt with Sitemap (public/robots.txt, now www)
- [x] Title/description intent tuning toward "price in kenya" — year page title now "... Import Duty & Price in Kenya", desc leads with "{year} {make} {model} price in Kenya"; model page already "Price & CRSP"
- [x] og:image / twitter:image — branded 1200x630 card (public/og-image.png, source scripts/og-card.svg); summary_large_image on homepage + generated pages
- [x] Product/Vehicle schema on model/year pages — vehicleJsonLd() (schema.org Car) wired into model, year & compare pages with brand, CRSP offer & duty PropertyValue

### Hosting cost (Vercel)
- [x] Cache headers — was `max-age=0, must-revalidate` on everything (Vercel static default), so browsers cached nothing and every navigation re-fetched turbo.min.js (217KB) + crsp_cascade.json (476KB). Now tiered in vercel.json: hashed /assets immutable 1y, /css /vendor images 30d, /data 7d, HTML 14d, sitemaps 1d.
- [x] Sitemap `<lastmod>` was the build date on all 77k URLs → told search engines the whole site changed on every deploy → full recrawl each time. Now read from data/data-version.json, verified against the CRSP SHA-256 (git does not preserve mtimes, so a fresh Vercel clone would reset them to build time). `npm run data` chains `data:version`; build warns and fails safe if the data changes without it.
- [x] robots.txt — 21 AI/SEO scrapers disallowed; Crawl-delay 10 for bingbot + Yandex. Googlebot, Bingbot and social preview bots (facebookexternalhit, WhatsApp) untouched.
- [ ] **Confirm the saving.** Needs `npx vercel login`, then read Observability → Edge Requests grouped by User Agent. Compare against GA4 (G-VT7S4F6QJG) sessions: the gap between GA4 users and Vercel edge requests IS the bot traffic. Baseline was taken before the 2026-08-23 deploy.
- [ ] Watch Search Console crawl stats for a drop over the next 2-4 weeks (lastmod change is the main lever; Googlebot ignores Crawl-delay).
- Decision: compare pages (20,012 pages, 4.5MB sitemap-compare.xml, linked 5x from every model/year page) reviewed and **deliberately kept** — do not drop without Search Console data.

## Notes

### Architecture
- Dev: Vite middleware intercepts routes, renders on the fly
- Prod: `npm run build` → vite build + generate_pages.js writes ~50,000+ static HTML pages
- CSS: @tailwindcss/cli compiles to public/css/styles.css (fixed path for static pages)
- Data: data/crsp_cascade.json (CRSP July 2025, 11 categories)

### Revenue streams identified
1. Clearing agent referral (primary)
2. Insurance lead gen — Britam/Jubilee/CIC partnership
3. Vehicle finance referral — Stanbic/NCBA/I&M asset finance

### Key URLs
- CRSP: https://www.kra.go.ke/images/publications/New-CRSP---July-2025.xlsx
- Finance Act: https://new.kenyalaw.org/akn/ke/act/2025/9/eng@2025-07-01
- KRA Duty: https://www.kra.go.ke/14-motor-vehicle-import-duty
