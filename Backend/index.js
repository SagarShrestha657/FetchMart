import express from "express";
import cors from "cors";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import randomUseragent from "random-useragent";

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://fetch-mart.vercel.app"
    ]
}));
app.use(express.json());

const PORT = process.env.PORT || 5001;

// --- Scraper Helper ---
async function scrapeWithProxyAndUserAgent(url, pageEvaluateFunc) {
    const userAgent = randomUseragent.getRandom();

    const isProduction = process.env.NODE_ENV === "production";
    const launchOptions = {
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox"
        ]
        // Do NOT set executablePath at all!
    };

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    if (userAgent) {
        await page.setUserAgent(userAgent);
    }

    await page.setViewport({ width: 1280, height: 800 });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Log the HTML for debugging
    const html = await page.content();

    console.log(`Loaded URL: ${url}\nPage length: ${html.length}`);

    const products = await pageEvaluateFunc(page);

    await browser.close();
    return products;
}

// Helper: Retry a function up to n times until it returns a non-empty result
async function retryFetch(fn, maxTries = 3, delayMs = 0) { // set delayMs to 0
    let lastResult, lastError;
    for (let i = 0; i < maxTries; i++) {
        try {
            lastResult = await fn();
            // Check for Flipkart: .items or array, for others: array
            if (
                (lastResult && Array.isArray(lastResult) && lastResult.length > 0) ||
                (lastResult && lastResult.items && lastResult.items.length > 0)
            ) {
                return lastResult;
            }
        } catch (err) {
            lastError = err;
        }
        if (i < maxTries - 1 && delayMs > 0) await new Promise(res => setTimeout(res, delayMs));
    }
    if (lastError) throw lastError;
    return lastResult;
}

// --- Flipkart ---
async function scrapeFlipkart(query, page = 1, limit = 10) {
    const url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
    return scrapeWithProxyAndUserAgent(url, async (pageObj) => {
        // Scroll further based on page
        for (let i = 0; i < page * 6; i++) {
            await pageObj.evaluate(() => window.scrollBy(0, window.innerHeight));
            await new Promise(res => setTimeout(res, 300));
        }
        return pageObj.evaluate((limit, page) => {
            const items = [];
            // Desktop cards
            document.querySelectorAll("div.LFEi7Z").forEach(card => {
                // Brand
                const brandEl = card.querySelector("div.syl9yP");
                const brand = brandEl ? brandEl.innerText.trim() : "";

                // Name
                const nameEl = card.querySelector("a.WKTcLC");
                const name = nameEl ? nameEl.title || nameEl.innerText.trim() : "";

                // Price
                const priceEl = card.querySelector("div.Nx9bqj");
                const price = priceEl ? Number(priceEl.innerText.replace(/[₹,]/g, "").trim()) : null;

                // Link
                const linkEl = card.querySelector("a.WKTcLC");
                const href = linkEl ? linkEl.getAttribute("href") : "";
                const link = href.startsWith("http") ? href : "https://www.flipkart.com" + href;

                // Image
                const imgEl = card.querySelector("img._53J4C-");
                const image = imgEl ? imgEl.src : "";

                // Discount
                let discount = "";
                const discountEl = card.querySelector("div.UkUFwK span, span._3Ay6Sb");
                if (discountEl) discount = discountEl.innerText.replace(/[()]/g, "").trim();

                // Reviews and Rating
                let reviews = "";
                let reviewRating = null;
                let reviewCount = null;
                const ratingEl = card.querySelector("div.XQDdHH");
                if (ratingEl) {
                    const ratingText = ratingEl.innerText.trim();
                    if (!isNaN(Number(ratingText))) reviewRating = Number(ratingText);
                }
                // Review count: not always present on desktop cards, but try to find
                const reviewCountEl = card.querySelector("span.Wphh3N");
                if (reviewCountEl) {
                    const match = reviewCountEl.innerText.match(/([\d,]+)\s+Ratings/);
                    if (match) reviewCount = Number(match[1].replace(/,/g, ""));
                }
                if (reviewRating !== null && reviewCount !== null) {
                    reviews = `${reviewRating} (${reviewCount.toLocaleString()} reviews)`;
                } else if (reviewRating !== null) {
                    reviews = `${reviewRating}`;
                } else if (reviewCount !== null) {
                    reviews = `${reviewCount.toLocaleString()} reviews`;
                }


                items.push({
                    name,
                    price,
                    link,
                    image,
                    brand,
                    discount,
                    reviews,        // e.g., "4.1 (5,012 reviews)"
                    reviewRating,   // e.g., 4.1 (number)
                    platform: "Flipkart"
                });

            });

            // ...inside your Flipkart page.evaluate()...
            document.querySelectorAll("div.slAVV4").forEach(card => {
                // Name
                const nameEl = card.querySelector("a.wjcEIp");
                const name = nameEl ? (nameEl.title || nameEl.innerText.trim()) : "";

                // Price
                const priceEl = card.querySelector("div.Nx9bqj");
                const price = priceEl ? Number(priceEl.innerText.replace(/[₹,]/g, "").trim()) : null;

                // Link
                const linkEl = card.querySelector("a.wjcEIp");
                const href = linkEl ? linkEl.getAttribute("href") : "";
                const link = href.startsWith("http") ? href : "https://www.flipkart.com" + href;

                // Image
                const imgEl = card.querySelector("img.DByuf4");
                const image = imgEl ? imgEl.src : "";

                // Discount
                let discount = "";
                const discountEl = card.querySelector("div.UkUFwK span, span._3Ay6Sb");
                if (discountEl) discount = discountEl.innerText.replace(/[()]/g, "").trim();

                // Reviews and Rating
                let reviews = "";
                let reviewRating = null;
                let reviewCount = null;
                const ratingEl = card.querySelector("div.XQDdHH");
                if (ratingEl) {
                    const ratingText = ratingEl.innerText.trim();
                    if (!isNaN(Number(ratingText))) reviewRating = Number(ratingText);
                }
                const reviewCountEl = card.querySelector("span.Wphh3N");
                if (reviewCountEl) {
                    // e.g. "(623)"
                    const countText = reviewCountEl.innerText.replace(/[^\d]/g, "");
                    if (countText) reviewCount = Number(countText);
                }
                if (reviewRating !== null && reviewCount !== null) {
                    reviews = `${reviewRating} (${reviewCount.toLocaleString()} reviews)`;
                } else if (reviewRating !== null) {
                    reviews = `${reviewRating}`;
                } else if (reviewCount !== null) {
                    reviews = `${reviewCount.toLocaleString()} reviews`;
                }


                items.push({
                    name,
                    price,
                    link,
                    image,
                    discount,
                    reviews,        // e.g., "4.1 (5,012 reviews)"
                    reviewRating,   // e.g., 4.1 (number)
                    platform: "Flipkart"
                });

            });

            // Mobile cards (new selectors, May 2025)
            document.querySelectorAll("div.tUxRFH").forEach(card => {
                // Name
                const nameEl = card.querySelector("div.KzDlHZ");
                const name = nameEl ? nameEl.innerText.trim() : "";

                // Price
                const priceEl = card.querySelector("div.Nx9bqj");
                const price = priceEl ? Number(priceEl.innerText.replace(/[₹,]/g, "").trim()) : null;

                // Link
                const linkEl = card.querySelector("a.CGtC98");
                const href = linkEl ? linkEl.getAttribute("href") : "";
                const link = href.startsWith("http") ? href : "https://www.flipkart.com" + href;

                // Image
                const imgEl = card.querySelector("img.DByuf4");
                const image = imgEl ? imgEl.src : "";

                // Discount
                let discount = "";
                const discountEl = card.querySelector("div.UkUFwK span, span._3Ay6Sb");
                if (discountEl) discount = discountEl.innerText.replace(/[()]/g, "").trim();

                // Reviews and Rating
                let reviews = "";
                let reviewRating = null;
                let reviewCount = null;
                const ratingEl = card.querySelector("div.XQDdHH");
                if (ratingEl) {
                    const ratingText = ratingEl.innerText.trim();
                    if (!isNaN(Number(ratingText))) reviewRating = Number(ratingText);
                }
                const reviewCountEl = card.querySelector("span.Wphh3N");
                if (reviewCountEl) {
                    // e.g. "(623)"
                    const countText = reviewCountEl.innerText.replace(/[^\d]/g, "");
                    if (countText) reviewCount = Number(countText);
                }
                if (reviewRating !== null && reviewCount !== null) {
                    reviews = `${reviewRating} (${reviewCount.toLocaleString()} reviews)`;
                } else if (reviewRating !== null) {
                    reviews = `${reviewRating}`;
                } else if (reviewCount !== null) {
                    reviews = `${reviewCount.toLocaleString()} reviews`;
                }


                items.push({
                    name,
                    price,
                    link,
                    image,
                    discount,
                    reviews,        // e.g., "4.1 (5,012 reviews)"
                    reviewRating,   // e.g., 4.1 (number)
                    platform: "Flipkart"
                });

            });

            // Flipkart mobile accessories cards (new selectors, May 2025)
            document.querySelectorAll("div.slAVV4").forEach(card => {
                // Name
                const nameEl = card.querySelector("a.wjcEIp");
                const name = nameEl ? (nameEl.title || nameEl.innerText.trim()) : "";

                // Price
                const priceEl = card.querySelector("div.Nx9bqj");
                const price = priceEl ? Number(priceEl.innerText.replace(/[₹,]/g, "").trim()) : null;

                // Link
                const linkEl = card.querySelector("a.wjcEIp");
                const href = linkEl ? linkEl.getAttribute("href") : "";
                const link = href.startsWith("http") ? href : "https://www.flipkart.com" + href;

                // Image
                const imgEl = card.querySelector("img.DByuf4");
                const image = imgEl ? imgEl.src : "";

                // Discount
                let discount = "";
                const discountEl = card.querySelector("div.UkUFwK span, span._3Ay6Sb");
                if (discountEl) discount = discountEl.innerText.replace(/[()]/g, "").trim();

                // Reviews and Rating
                let reviews = "";
                let reviewRating = null;
                let reviewCount = null;
                const ratingEl = card.querySelector("div.XQDdHH");
                if (ratingEl) {
                    const ratingText = ratingEl.innerText.trim();
                    if (!isNaN(Number(ratingText))) reviewRating = Number(ratingText);
                }
                const reviewCountEl = card.querySelector("span.Wphh3N");
                if (reviewCountEl) {
                    // e.g. "(1,69,906)"
                    const countText = reviewCountEl.innerText.replace(/[^\d]/g, "");
                    if (countText) reviewCount = Number(countText);
                }
                if (reviewRating !== null && reviewCount !== null) {
                    reviews = `${reviewRating} (${reviewCount.toLocaleString()} reviews)`;
                } else if (reviewRating !== null) {
                    reviews = `${reviewRating}`;
                } else if (reviewCount !== null) {
                    reviews = `${reviewCount.toLocaleString()} reviews`;
                }


                items.push({
                    name,
                    price,
                    link,
                    image,
                    discount,
                    reviews,        // e.g., "4.3 (1,69,906 reviews)"
                    reviewRating,   // e.g., 4.3 (number)
                    platform: "Flipkart"
                });

            });

            // Pagination logic
            const start = (page - 1) * limit;
            // Only return the paginated array, not an object
            return items.slice(start, start + limit);
        }, limit, page);
    });
}

// --- Amazon ---
async function scrapeAmazon(query, page = 1, limit = 10) {
    const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
    return scrapeWithProxyAndUserAgent(url, async (pageObj) => {
        await pageObj.waitForSelector("div.s-result-item[data-component-type='s-search-result']", { timeout: 15000 }).catch(() => { });
        for (let i = 0; i < page * 6; i++) {
            await pageObj.evaluate(() => window.scrollBy(0, window.innerHeight));
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        return pageObj.evaluate((limit, page) => {
            const items = [];
            const cards = document.querySelectorAll("div.s-result-item[data-component-type='s-search-result']");
            cards.forEach((card) => {
                // Product name
                const nameEl = card.querySelector("h2 span");
                const name = nameEl ? nameEl.innerText.trim() : "";

                // Product link
                const linkEl = card.querySelector("a.a-link-normal.s-no-outline, h2 a.a-link-normal");
                const link = linkEl
                    ? (linkEl.href.startsWith("http") ? linkEl.href : "https://www.amazon.in" + linkEl.getAttribute("href"))
                    : "";

                // Product image
                const imgEl = card.querySelector("img.s-image");
                const image = imgEl ? imgEl.src : "";

                // Product price
                const priceWholeEl = card.querySelector("span.a-price-whole");
                const priceFractionEl = card.querySelector("span.a-price-fraction");
                let price = null;
                if (priceWholeEl) {
                    const priceStr =
                        priceWholeEl.innerText.replace(/[₹,]/g, "") +
                        (priceFractionEl ? "." + priceFractionEl.innerText : "");
                    price = Number(priceStr);
                }

                // Brand name (from data-asin or title, fallback to empty)
                let brand = "";
                const brandEl = card.querySelector("h5.s-line-clamp-1 span, span.a-size-base-plus.a-color-base");
                if (brandEl) brand = brandEl.innerText.trim();
                if (!brand && name) {
                    // Try to extract brand from name (first word)
                    brand = name.split(" ")[0];
                }

                // Discount (percent or price off)
                let discount = "";
                const discountEl = card.querySelector("span.a-letter-space + span");
                if (discountEl) {
                    const txt = discountEl.innerText.trim();
                    if (/% off/i.test(txt) || /off/i.test(txt)) discount = txt;
                }
                // Sometimes discount is in a badge
                const badgeEl = card.querySelector("span.a-badge-text");
                if (!discount && badgeEl && /deal|off/i.test(badgeEl.innerText)) {
                    discount = badgeEl.innerText.trim();
                }

                // Reviews (star rating and review count)
                let reviews = "";
                let reviewBar = "";
                let reviewRating = null;
                let reviewCount = null;

                // Star rating (e.g., "4.2 out of 5 stars")
                const starEl = card.querySelector("span.a-icon-alt");
                if (starEl) {
                    reviews = starEl.innerText.trim();
                    // Extract numeric rating (e.g., 4.2)
                    const match = reviews.match(/^([\d.]+)\s+out of 5/);
                    if (match) reviewRating = parseFloat(match[1]);
                }

                // Review count (e.g., "1,352")
                const countEl = card.querySelector("span.a-size-base.s-underline-text, span.a-size-base.s-underline-text.s-link-style");
                if (countEl) {
                    // Extract number from text (e.g., "1,352" -> 1352)
                    const countMatch = countEl.innerText.trim().replace(/,/g, "");
                    if (!isNaN(Number(countMatch))) reviewCount = Number(countMatch);
                    // Combine for display if needed
                    reviews = reviews
                        ? `${reviews.split(' ')[0]} (${countEl.innerText.trim()} reviews)`
                        : `${countEl.innerText.trim()} reviews`;
                }

                // Review bar (e.g., "4.2 out of 5 stars, rating details")
                const reviewBarEl = card.querySelector("a[aria-label*='out of 5 stars']");
                if (reviewBarEl) reviewBar = reviewBarEl.getAttribute("aria-label") || "";

                items.push({
                    name,
                    price,
                    link,
                    image,
                    brand,
                    discount,
                    reviews,        // e.g., "4.2 (1,352 reviews)"
                    reviewRating,   // e.g., 4.2 (number)
                    platform: "Amazon"
                });
            });
            const start = (page - 1) * limit;
            return items.slice(start, start + limit);
        }, limit, page);
    });
}

// --- Meesho ---
async function scrapeMeesho(query, page = 1, limit = 10) {
    const url = `https://www.meesho.com/search?q=${encodeURIComponent(query)}`;
    return scrapeWithProxyAndUserAgent(url, async (pageObj) => {
        await pageObj.waitForSelector("a[href*='/p/']", { timeout: 15000 }).catch(() => { });
        for (let i = 0; i < page * 6; i++) {
            await pageObj.evaluate(() => window.scrollBy(0, window.innerHeight));
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        return pageObj.evaluate((limit, page) => {
            const items = [];
            const cards = document.querySelectorAll("a[href*='/p/']");
            cards.forEach((card) => {
                // Name
                const nameEl = card.querySelector("p[class*='StyledDesktopProductTitle']");
                const name = nameEl ? nameEl.innerText.trim() : "";

                // Price
                const priceEl = card.querySelector("h5");
                const price = priceEl ? Number(priceEl.innerText.replace(/[₹,]/g, "").trim()) : null;

                // Link
                const link = card.href.startsWith("http") ? card.href : "https://www.meesho.com" + card.getAttribute("href");

                // Image
                const imgEl = card.querySelector("img");
                const image = imgEl ? imgEl.src : "";

                // Discount
                let discount = "";
                const discountEl = card.querySelector("span[class*='StyledDesktopSubtitle']");
                if (discountEl) discount = discountEl.innerText.trim();

                // Brand (Meesho usually doesn't show brand, set to empty string)
                let brand = "";

                // Rating (e.g., 3.8)
                let reviewRating = null;
                const ratingEl = card.querySelector("span.Rating__StyledPill-sc-12htng8-1");
                if (ratingEl) {
                    const ratingText = ratingEl.innerText.trim();
                    if (!isNaN(Number(ratingText))) reviewRating = Number(ratingText);
                }

                // Review count (e.g., "5025 Reviews")
                let reviews = "";
                const reviewCountEl = card.querySelector("span.NewProductCardstyled__RatingCount-sc-6y2tys-22");
                let reviewCount = null;
                if (reviewCountEl) {
                    const countText = reviewCountEl.innerText.replace(/[^\d]/g, "");
                    if (countText) {
                        reviewCount = Number(countText);
                        reviews = reviewRating !== null
                            ? `${reviewRating} (${reviewCount.toLocaleString()} reviews)`
                            : `${reviewCount.toLocaleString()} reviews`;
                    } else if (reviewRating !== null) {
                        reviews = `${reviewRating}`;
                    }
                } else if (reviewRating !== null) {
                    reviews = `${reviewRating}`;
                }


                items.push({
                    name,
                    price,
                    link,
                    image,
                    brand,
                    discount,
                    reviews,        // e.g., "3.8 (22,389 reviews)"
                    reviewRating,   // e.g., 3.8 (number)
                    platform: "Meesho"
                });

            });
            const start = (page - 1) * limit;
            return items.slice(start, start + limit);
        }, limit, page);
    });
}

// --- Myntra ---
async function scrapeMyntra(query, page = 1, limit = 10) {
    // Use the query as the category path and as rawQuery
    const category = encodeURIComponent(query.trim().toLowerCase());
    const url = `https://www.myntra.com/${category}?rawQuery=${encodeURIComponent(query)}`;
    return scrapeWithProxyAndUserAgent(url, async (pageObj) => {
        // Remove timeout and wait for any product card or image to appear (no timeout)
        await pageObj.waitForSelector("li.product-base img, li.item img").catch(() => { });

        // Aggressively scroll to load more products (increase scrolls and delay)
        for (let i = 0; i < page * 6; i++) {
            await pageObj.evaluate(() => window.scrollBy(0, window.innerHeight));
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Extra: Wait a bit after scrolling to allow lazy-loaded images to appear
        await new Promise(resolve => setTimeout(resolve, 2000));

        return pageObj.evaluate((limit, page) => {
            const items = [];

            document.querySelectorAll("li.product-base").forEach(card => {
                // Brand
                const brandEl = card.querySelector("h3.product-brand");
                const brand = brandEl ? brandEl.innerText.trim() : "";

                // Name
                const nameEl = card.querySelector("h4.product-product");
                const name = nameEl ? nameEl.innerText.trim() : "";

                // Price
                let price = null;
                const priceEl = card.querySelector("span.product-discountedPrice") || card.querySelector("span.product-strike");
                if (priceEl) {
                    const priceMatch = priceEl.innerText.match(/[\d,]+/);
                    price = priceMatch ? Number(priceMatch[0].replace(/,/g, "")) : null;
                }

                // Link
                const linkEl = card.querySelector("a[data-refreshpage='true'], a[target='_blank']");
                const href = linkEl ? linkEl.getAttribute("href") : "";
                const link = href.startsWith("http") ? href : "https://www.myntra.com/" + href.replace(/^\//, "");

                // Image
                let imgEl = card.querySelector("picture img.img-responsive");
                if (!imgEl) imgEl = card.querySelector("img.img-responsive");
                const image = imgEl ? (imgEl.src.startsWith("http") ? imgEl.src : "https:" + imgEl.src) : "";

                // Discount
                let discount = "";
                const discountEl = card.querySelector("span.product-discountPercentage");
                if (discountEl) discount = discountEl.innerText.replace(/[()]/g, "").trim();

                // Reviews and Rating
                let reviews = "";
                let reviewRating = null;
                let reviewCount = null;
                // Rating (e.g., 4.7)
                const ratingEl = card.querySelector(".product-ratingsContainer > span");
                if (ratingEl) {
                    reviewRating = parseFloat(ratingEl.innerText.trim());
                }
                // Review count (e.g., 35 or 56.6k)
                const reviewCountEl = card.querySelector(".product-ratingsCount");
                if (reviewCountEl) {
                    const countText = reviewCountEl.innerText.replace(/[^\d.k]/gi, "").toLowerCase();
                    if (countText.endsWith("k")) {
                        reviewCount = Math.round(parseFloat(countText) * 1000);
                    } else {
                        reviewCount = Number(countText.replace(/,/g, ""));
                    }
                }
                if (reviewRating !== null && reviewCount !== null) {
                    reviews = `${reviewRating} (${reviewCount.toLocaleString()} reviews)`;
                } else if (reviewRating !== null) {
                    reviews = `${reviewRating}`;
                } else if (reviewCount !== null) {
                    reviews = `${reviewCount.toLocaleString()} reviews`;
                }

                if (name && price && link && image) {
                    items.push({
                        name,
                        price,
                        link,
                        image,
                        brand,
                        discount,
                        reviews,        // e.g., "4.7 (35 reviews)"
                        reviewRating,   // e.g., 4.7
                        platform: "Myntra"
                    });
                }
            });

            // New structure (May 2025)
            // document.querySelectorAll("li.item").forEach(card => {
            //     const nameEl = card.querySelector("h4.description");
            //     const priceEl = card.querySelector("span.price-value");
            //     const linkEl = card.querySelector("a[href]");
            //     let imgEl = card.querySelector("picture img.img-responsive.preLoad.loaded");
            //     if (!imgEl) imgEl = card.querySelector("img.img-responsive.preLoad.loaded");
            //     if (nameEl && priceEl && linkEl && imgEl) {
            //         const name = nameEl.innerText.trim();
            //         const priceMatch = priceEl.innerText.match(/[\d,]+/);
            //         const price = priceMatch ? Number(priceMatch[0].replace(/,/g, "")) : null;
            //         const href = linkEl.getAttribute("href");
            //         const link = href.startsWith("http") ? href : "https://www.myntra.com" + href;
            //         const image = imgEl.src.startsWith("http") ? imgEl.src : "https:" + imgEl.src;

            //         items.push({ name, price, link, image, platform: "Myntra" });

            //     }
            // });

            // // Fallback: anchor tags with product links (for future-proofing)
            // document.querySelectorAll("a[href*='/buy/'], a[href*='/shop/']").forEach(card => {
            //     const nameEl = card.querySelector("h4, div");
            //     const priceEl = card.querySelector("span, div");
            //     const imgEl = card.querySelector("img");
            //     if (nameEl && priceEl && imgEl) {
            //         const name = nameEl.innerText.trim();
            //         const priceMatch = priceEl.innerText.match(/[\d,]+/);
            //         const price = priceMatch ? Number(priceMatch[0].replace(/,/g, "")) : null;
            //         const href = card.getAttribute("href");
            //         const link = href.startsWith("http") ? href : "https://www.myntra.com" + href;
            //         const image = imgEl.src.startsWith("http") ? imgEl.src : "https:" + imgEl.src;

            //         items.push({ name, price, link, image, platform: "Myntra" });

            //     }
            // });

            const start = (page - 1) * limit;
            return items.slice(start, start + limit);
        }, limit, page);
    });
}

// --- Ajio ---
async function scrapeAjio(query, page = 1, limit = 10) {
    const url = `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`;
    return scrapeWithProxyAndUserAgent(url, async (pageObj) => {
        await pageObj.waitForSelector("div.item.rilrtl-products-list__item", { timeout: 15000 }).catch(() => { });
        for (let i = 0; i < page * 6; i++) {
            await pageObj.evaluate(() => window.scrollBy(0, window.innerHeight));
            await new Promise(resolve => setTimeout(resolve, 600));
        }
        return pageObj.evaluate((limit, page) => {
            const items = [];
            document.querySelectorAll("div.item.rilrtl-products-list__item").forEach(card => {
                // Name
                const nameEl = card.querySelector("div.nameCls") || card.querySelector("div.name-center") || card.querySelector("div.name");
                const name = nameEl ? nameEl.innerText.trim() : "";

                // Brand
                const brandEl = card.querySelector("div.brand strong");
                const brand = brandEl ? brandEl.innerText.trim() : "";

                // Price
                let price = null;
                const priceEl = card.querySelector("span.price strong") || card.querySelector("span.price #price-value");
                if (priceEl) {
                    price = Number(priceEl.innerText.replace(/[₹,]/g, ""));
                } else {
                    // fallback: aria-label or textContent
                    const priceAria = card.querySelector("span.price");
                    if (priceAria) {
                        const aria = priceAria.getAttribute("aria-label");
                        if (aria) price = Number(aria.replace(/[₹,]/g, ""));
                        else price = Number(priceAria.textContent.replace(/[₹,]/g, ""));
                    }
                }

                // Link
                const linkEl = card.querySelector("a.rilrtl-products-list__link.desktop") || card.querySelector("a.rilrtl-products-list__link");
                const href = linkEl ? linkEl.getAttribute("href") : "";
                const link = href.startsWith("http") ? href : "https://www.ajio.com" + href;

                // Image
                const imgEl = card.querySelector("img.rilrtl-lazy-img");
                const image = imgEl ? (imgEl.src.startsWith("http") ? imgEl.src : "https:" + imgEl.src) : "";

                // Discount
                let discount = "";
                const discountEl = card.querySelector("span.discount");
                if (discountEl) discount = discountEl.innerText.replace(/[()]/g, "").trim();

                // Reviews and Rating
                let reviews = "";
                let reviewRating = null;
                let reviewCount = null;
                const ratingEl = card.querySelector("p._3I65V[aria-label]");
                if (ratingEl) {
                    reviewRating = parseFloat(ratingEl.getAttribute("aria-label") || ratingEl.innerText.trim());
                }
                // Review count (e.g., | 568)
                const reviewCountEl = card.querySelector("p[aria-label]:not(._3I65V)");
                if (reviewCountEl) {
                    const countText = reviewCountEl.getAttribute("aria-label") || reviewCountEl.innerText;
                    const match = countText.match(/\d+/);
                    if (match) reviewCount = Number(match[0]);
                }
                // Compose reviews string
                if (reviewRating !== null && reviewCount !== null) {
                    reviews = `${reviewRating} (${reviewCount.toLocaleString()} reviews)`;
                } else if (reviewRating !== null) {
                    reviews = `${reviewRating}`;
                } else if (reviewCount !== null) {
                    reviews = `${reviewCount.toLocaleString()} reviews`;
                }
                items.push({
                    name,
                    price,
                    link,
                    image,
                    brand,
                    discount,
                    reviews,        // e.g., "4.3 (568 reviews)"
                    reviewRating,   // e.g., 4.3
                    platform: "Ajio"
                });
            }
            );
            const start = (page - 1) * limit;
            return items.slice(start, start + limit);
        }, limit, page);
    });
}

// --- API Route ---
app.post("/api/search", async (req, res) => {
    const { query, platforms, page = 1, limit = 10 } = req.body;
    if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Query is required" });
    }

    const selected = Array.isArray(platforms) && platforms.length > 0
        ? platforms.map(p => p.toLowerCase())
        : ["flipkart", "amazon", "meesho", "myntra", "ajio"];

    const results = [];
    const cardCounts = {};

    // Helper to shuffle array
    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Map platform to its code
    const platformFns = {
        flipkart: async () => {
            const flipkartData = await retryFetch(() => scrapeFlipkart(query, page, limit), 3, 1500);
            const items = flipkartData.items ?? flipkartData;
            cardCounts.Flipkart = flipkartData.cardCount ?? items.length;
            console.log("Flipkart card count:", cardCounts.Flipkart);
            return items;
        },
        amazon: async () => {
            const amazonData = await retryFetch(() => scrapeAmazon(query, page, limit), 3, 0);
            cardCounts.Amazon = amazonData.length;
            console.log("Amazon card count:", cardCounts.Amazon);
            return amazonData;
        },
        meesho: async () => {
            const meeshoData = await retryFetch(() => scrapeMeesho(query, page, limit), 3, 0);
            cardCounts.Meesho = meeshoData.length;
            console.log("Meesho card count:", cardCounts.Meesho);
            return meeshoData;
        },
        myntra: async () => {
            const myntraData = await retryFetch(() => scrapeMyntra(query, page, limit), 3, 0);
            cardCounts.Myntra = myntraData.length;
            console.log("Myntra card count:", cardCounts.Myntra);
            return myntraData;
        },
        ajio: async () => {
            const ajioData = await retryFetch(() => scrapeAjio(query, page, limit), 3, 0);
            cardCounts.Ajio = ajioData.length;
            console.log("Ajio card count:", cardCounts.Ajio);
            return ajioData;
        }
    };

    // Run all selected platform scrapers in parallel
    const promises = selected.map(platform =>
        platformFns[platform]?.().catch(err => {
            cardCounts[platform.charAt(0).toUpperCase() + platform.slice(1)] = 0;
            console.error(`${platform.charAt(0).toUpperCase() + platform.slice(1)} error:`, err.message);
            return [];
        })
    );

    const allResults = await Promise.all(promises);
    allResults.forEach(items => results.push(...items));

    // Shuffle the results if you want (or comment out to keep order)
    shuffle(results);

    res.status(200).json(results);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
