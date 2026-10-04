#!/usr/bin/env node
// Export a Shopify store's public product catalog to CSV (one row per variant). No dependencies, Node 18+.
//
//   node shopify-catalog.mjs https://www.allbirds.com > allbirds.csv
//   node shopify-catalog.mjs https://kith.com/collections/sale > sale.csv
//
// Uses the storefront's public /products.json (the data every visitor's browser gets). One request
// at a time with a pause, backs off on 429. Respect each store's terms.

const UA = 'shopify-catalog-export/1.0 (+https://github.com/swiftkit-dev/shopify-catalog-export)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
    for (let attempt = 0; attempt < 5; attempt++) {
        const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
        if (res.status === 429 || res.status >= 500) {
            const wait = Number(res.headers.get('retry-after')) || 5 * (attempt + 1);
            console.error(`HTTP ${res.status}, waiting ${wait}s`);
            await res.body?.cancel();
            await sleep(wait * 1000);
            continue;
        }
        if (!res.ok || !/json/.test(res.headers.get('content-type') || '')) { await res.body?.cancel(); return null; }
        return res.json();
    }
    throw new Error('Store keeps answering "too many requests"; try later.');
}

const arg = process.argv[2];
if (!arg) { console.error('Usage: node shopify-catalog.mjs <store or collection URL>'); process.exit(1); }
const u = new URL(/^https?:\/\//.test(arg) ? arg : `https://${arg}`);
const coll = u.pathname.match(/\/collections\/([^/?#]+)/)?.[1];
const base = coll ? `${u.origin}/collections/${coll}/products.json` : `${u.origin}/products.json`;

// /meta.json has the store's name and main currency. Note: stores selling internationally may
// localize prices to YOUR country (Shopify Markets), so run it from the market you care about.
const meta = (await getJson(`${u.origin}/meta.json`)) || {};

const products = [];
for (let page = 1; ; page++) {
    const j = await getJson(`${base}?limit=250&page=${page}`);
    if (!j) { if (page === 1) { console.error('No public product data (not Shopify, or switched off).'); process.exitCode = 1; } break; }
    products.push(...j.products);
    console.error(`page ${page}: ${j.products.length} products`);
    if (j.products.length < 250) break;
    await sleep(800);
}

const csv = (v) => (v === null || v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
const cols = ['product_id', 'title', 'handle', 'vendor', 'product_type', 'tags', 'variant_id', 'variant', 'sku', 'price', 'compare_at_price', 'on_sale', 'available', 'currency', 'image', 'url', 'created_at', 'updated_at'];
if (products.length) console.log(cols.join(','));
for (const p of products) {
    for (const v of p.variants || []) {
        // Prices are strings ("87.50"): convert before comparing.
        const price = Number(v.price);
        const was = Number(v.compare_at_price) > 0 ? Number(v.compare_at_price) : null;
        const row = {
            product_id: p.id, title: p.title, handle: p.handle, vendor: p.vendor, product_type: p.product_type,
            tags: Array.isArray(p.tags) ? p.tags.join('|') : p.tags, variant_id: v.id, variant: v.title, sku: v.sku,
            price, compare_at_price: was, on_sale: was !== null && was > price, available: v.available,
            currency: meta.currency || '', image: (v.featured_image || p.images?.[0])?.src || '',
            url: `${u.origin}/products/${p.handle}`, created_at: p.created_at, updated_at: p.updated_at,
        };
        console.log(cols.map((c) => csv(row[c])).join(','));
    }
}
console.error(`${meta.name || u.host}: ${products.length} products`);
