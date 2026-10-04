# shopify-catalog-export

Export any Shopify store's public product catalog to CSV: one row per variant with SKU, price,
compare-at ("was") price, on-sale flag, stock flag, vendor, type, tags, image and URL.
One file, no dependencies, Node 18+.

```bash
node shopify-catalog.mjs https://www.allbirds.com > allbirds.csv
node shopify-catalog.mjs https://kith.com/collections/sale > sale.csv   # just one collection
```

```
product_id,title,handle,vendor,product_type,tags,variant_id,variant,sku,price,compare_at_price,on_sale,available,currency,image,url,created_at,updated_at
6756917837879,Crossbones Klean Kanteen Mug,klean-kanteen-camp-mug,Klean Kanteen,On-The-Go Drinkware,Classics|Gifting|Merch|Mug|OTG,40064390660151,Default Title,UMKKCM23,25,,false,true,USD,https://cdn.shopify.com/...,https://www.deathwishcoffee.com/products/klean-kanteen-camp-mug,...
```

## How it works

Shopify storefronts publish their catalog at `/products.json` (and `/collections/<handle>/products.json`),
250 products per page. The script pages through it one request at a time with a short pause,
backs off when the store answers 429, and reads the store's main currency from `/meta.json`.

Gotchas it handles:

- **Prices are strings** (`"87.50"`). Comparing them as strings gets sale detection wrong.
- **"On sale" = `compare_at_price` > `price`.** A compare-at price of `0.00` means "no previous price".
- **Stock is a yes/no flag.** There are no quantities in this data.

One it can't fix: stores selling internationally (Shopify Markets) may **localize prices to your
location**, so a run from Japan can return yen for a US store. Run it from the market you care
about, and check one known product.

Be a good citizen: keep the pause, identify yourself in the User-Agent, and respect each store's terms.

## Need more?

The hosted version handles many stores per run, nested or flat variants, "only new products" for
daily alerts, product descriptions, and a free per-store summary (price range and median, share on
sale, top vendors, new products in the last 30 days). It runs on Apify:
**[Shopify Store Products Scraper](https://apify.com/swiftkit/shopify-products)**.

## License

MIT.
