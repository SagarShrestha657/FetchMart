import express from "express";
import cors from "cors";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import randomUseragent from "random-useragent";
import { EventEmitter } from 'events';

// Increase max listeners limit
EventEmitter.defaultMaxListeners = 50;

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

// Global request tracking
let currentRequest = {
    controller: null,
    browsers: [],
    cleanup: null
};

// Function to abort current request and cleanup
async function abortCurrentRequest() {
    if (currentRequest.controller) {
        console.log("Aborting previous request...");
        currentRequest.controller.abort();
        if (currentRequest.cleanup) {
            try {
                await currentRequest.cleanup();
            } catch (err) {
                console.error("Error during cleanup:", err.message);
            }
        }
        // Force kill any remaining browser processes
        if (process.platform === 'win32') {
            try {
                require('child_process').execSync('taskkill /F /IM chrome.exe /T');
            } catch (err) {
                // Ignore errors if no chrome processes found
            }
        }
        currentRequest.controller = null;
        currentRequest.browsers = [];
        currentRequest.cleanup = null;
    }
}

// --- Scraper Helper ---
async function scrapeWithProxyAndUserAgent(url, pageEvaluateFunc, trackBrowser, abortSignal) {
    const userAgent = randomUseragent.getRandom();
    const isProduction = process.env.NODE_ENV === "production";

    const launchOptions = {
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--disable-extensions",
            "--single-process",
            "--no-zygote"
        ],
        ...(isProduction && {
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/google-chrome"
        })
    };

    let browser;
    let abortListener;
    try {
        browser = await puppeteer.launch(launchOptions);
        if (typeof trackBrowser === "function") trackBrowser(browser);

        if (abortSignal.aborted) {
            await browser.close();
            throw new Error("Aborted before navigation");
        }

        // Create a single abort listener that will be properly cleaned up
        abortListener = async () => {
            console.log("Abort signal received, closing browser");
            try {
                if (browser) {
                    const pages = await browser.pages();
                    await Promise.all(pages.map(page => page.close().catch(() => {})));
                    await browser.close();
                }
            } catch (err) {
                console.error("Error closing browser:", err.message);
            }
        };

        // Add the listener and store it for cleanup
        abortSignal.addEventListener("abort", abortListener, { once: true });

        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(30000);
        await page.setDefaultTimeout(30000);

        if (userAgent) await page.setUserAgent(userAgent);
        await page.setViewport({ width: 1280, height: 800 });

        // Add error handling for navigation
        try {
            await page.goto(url, {
                waitUntil: "networkidle2",
                timeout: 30000,
                signal: abortSignal
            });
        } catch (err) {
            if (err.name === 'AbortError' || err.message.includes('aborted')) {
                throw err;
            }
            console.error("Navigation error:", err.message);
            throw err;
        }

        const html = await page.content();
        console.log(`Loaded URL: ${url}\nPage length: ${html.length}`);

        // Add retry logic for page evaluation
        let retries = 3;
        while (retries > 0) {
            try {
                const products = await pageEvaluateFunc(page);
                return products;
            } catch (err) {
                if (err.message.includes("Execution context was destroyed")) {
                    retries--;
                    if (retries === 0) throw err;
                    await new Promise(res => setTimeout(res, 1000));
                    continue;
                }
                throw err;
            }
        }
    } catch (error) {
        if (error.name === "AbortError" || error.message.includes("aborted")) {
            console.log("Navigation aborted");
            throw error;
        }
        console.error("Scraping error:", error);
        return null;
    } finally {
        // Clean up the abort listener
        if (abortListener && abortSignal) {
            abortSignal.removeEventListener("abort", abortListener);
        }
        if (browser) {
            try {
                const pages = await browser.pages();
                await Promise.all(pages.map(page => page.close().catch(() => {})));
                await browser.close();
            } catch (err) {
                console.error("Error closing browser:", err.message);
            }
        }
    }
}

async function retryFetch(fn, maxTries = 3, delayMs = 0) {
    let lastResult, lastError;
    for (let i = 0; i < maxTries; i++) {
        try {
            lastResult = await fn();
            if (lastResult === null) {
                throw new Error("Scraping returned null");
            }
            if (
                (lastResult && Array.isArray(lastResult) && lastResult.length > 0) ||
                (lastResult && lastResult.items && lastResult.items.length > 0)
            ) {
                return lastResult;
            }
        } catch (err) {
            if (err.name === "AbortError" || err.message.includes("aborted")) {
                console.log("Aborted during retry, no further retries.");
                throw err;
            }
            if (err.message.includes("Execution context was destroyed")) {
                console.log("Context destroyed, retrying...");
                lastError = err;
                continue;
            }
            lastError = err;
        }
        if (i < maxTries - 1 && delayMs > 0) {
            await new Promise(res => setTimeout(res, delayMs));
        }
    }
    if (lastError) throw lastError;
    return lastResult;
}

// --- Flipkart ---
async function scrapeFlipkart(query, page = 1, limit = 10, trackBrowser, abortSignal) {
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
    }, trackBrowser, abortSignal);
}

// --- Amazon ---
async function scrapeAmazon(query, page = 1, limit = 10, trackBrowser, abortSignal) {
    const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
    return scrapeWithProxyAndUserAgent(url, async (pageObj) => {
        await pageObj.waitForSelector("div.s-result-item[data-component-type='s-search-result']", { timeout: 15000 }).catch(() => { });
        const found = await pageObj.$("div.s-result-item[data-component-type='s-search-result']");
        if (!found) {
            console.warn("No products found");
            return [];
        }
        for (let i = 0; i < page * 6; i++) {
            await pageObj.evaluate(() => window.scrollBy(0, window.innerHeight));
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
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
    }, trackBrowser, abortSignal);
}

// --- Meesho ---
async function scrapeMeesho(query, page = 1, limit = 10, trackBrowser, abortSignal) {
    const url = `https://www.meesho.com/search?q=${encodeURIComponent(query)}`;
    return scrapeWithProxyAndUserAgent(url, async (pageObj) => {
        await pageObj.waitForSelector("a[href*='/p/']", { timeout: 15000 }).catch(() => { });
        const found = await pageObj.$("a[href*='/p/']");
        if (!found) {
            console.warn("No products found");
            return [];
        }
        for (let i = 0; i < page * 6; i++) {
            await pageObj.evaluate(() => window.scrollBy(0, window.innerHeight));
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        await new Promise(resolve => setTimeout(resolve, 1500));

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
    }, trackBrowser, abortSignal);
}

// --- Myntra ---
async function scrapeMyntra(query, page = 1, limit = 10, trackBrowser, abortSignal) {
    const url = `https://www.myntra.com/${encodeURIComponent(query.trim().toLowerCase())}?rawQuery=${encodeURIComponent(query)}`;
    return scrapeWithProxyAndUserAgent(url, async (pageObj) => {
        try {
            // Set a more realistic viewport
            await pageObj.setViewport({ width: 1366, height: 768 });

            // Function to analyze page content
            const analyzePageContent = async () => {
                return await pageObj.evaluate(() => {
                    const content = {
                        title: document.title,
                        url: window.location.href,
                        bodyLength: document.body.innerText.length,
                        hasProductGrid: !!document.querySelector('div.product-grid-base'),
                        hasProductCards: !!document.querySelector('li.product-base, div.product-base'),
                        hasSearchResults: !!document.querySelector('div[class*="search"], div[class*="results"]'),
                        hasFilters: !!document.querySelector('div[class*="filter"], div[class*="facet"]'),
                        hasPagination: !!document.querySelector('div[class*="pagination"], div[class*="page"]'),
                        hasError: !!document.querySelector('div[class*="error"], div[class*="not-found"]'),
                        hasMaintenance: !!document.querySelector('div[class*="maintenance"], div[class*="down"]'),
                        hasCaptcha: !!document.querySelector('iframe[src*="captcha"], div[class*="captcha"]'),
                        hasBlock: !!document.querySelector('div[class*="block"], div[class*="access-denied"]'),
                        hasRedirect: window.location.href.includes('block') || window.location.href.includes('verify'),
                        hasEmptyContent: document.body.innerText.length < 1000,
                        hasDynamicContent: !!document.querySelector('div[class*="skeleton"], div[class*="loading"]'),
                        hasNoResults: !!document.querySelector('div[class*="no-results"], div[class*="empty-state"]'),
                        hasSearchBox: !!document.querySelector('input[type="search"], input[placeholder*="search"]'),
                        hasNavigation: !!document.querySelector('nav, header, div[class*="header"]'),
                        hasFooter: !!document.querySelector('footer, div[class*="footer"]'),
                        hasScripts: document.scripts.length,
                        hasStyles: document.styleSheets.length,
                        hasImages: document.images.length,
                        hasLinks: document.links.length
                    };
                    console.log('Page content analysis:', content);
                    return content;
                });
            };

            // Function to check for blocking/detection
            const checkForBlocking = async () => {
                const content = await analyzePageContent();
                
                if (content.hasCaptcha) {
                    console.log('Detected: CAPTCHA page');
                    return 'CAPTCHA';
                }
                if (content.hasBlock) {
                    console.log('Detected: Block page');
                    return 'BLOCKED';
                }
                if (content.hasError) {
                    console.log('Detected: Error page');
                    return 'ERROR';
                }
                if (content.hasMaintenance) {
                    console.log('Detected: Maintenance page');
                    return 'MAINTENANCE';
                }
                if (content.hasRedirect) {
                    console.log('Detected: Redirect to blocking page');
                    return 'REDIRECTED';
                }
                if (content.hasEmptyContent) {
                    console.log('Detected: Empty or minimal content');
                    return 'EMPTY_CONTENT';
                }
                if (content.hasNoResults) {
                    console.log('Detected: No results page');
                    return 'NO_RESULTS';
                }
                if (!content.hasProductGrid && !content.hasProductCards && content.bodyLength > 1000) {
                    console.log('Detected: Page loaded but no product elements found');
                    return 'NO_PRODUCTS';
                }

                return null;
            };

            // Set additional headers to appear more like a real browser
            await pageObj.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            });

            // Enable JavaScript and cookies
            await pageObj.setJavaScriptEnabled(true);

            // Set a realistic user agent
            const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
            await pageObj.setUserAgent(userAgent);

            // Add random mouse movements
            await pageObj.evaluate(() => {
                const moveMouse = () => {
                    const x = Math.floor(Math.random() * window.innerWidth);
                    const y = Math.floor(Math.random() * window.innerHeight);
                    const event = new MouseEvent('mousemove', {
                        view: window,
                        bubbles: true,
                        cancelable: true,
                        clientX: x,
                        clientY: y
                    });
                    document.dispatchEvent(event);
                };
                setInterval(moveMouse, 1000);
            });

            // Add random scrolling behavior
            await pageObj.evaluate(() => {
                const randomScroll = () => {
                    const scrollAmount = Math.floor(Math.random() * 100);
                    window.scrollBy(0, scrollAmount);
                };
                setInterval(randomScroll, 2000);
            });

            // Wait for the product grid with a more natural delay
            await pageObj.waitForSelector("div.product-grid-base", { timeout: 15000 }).catch(() => { });
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
            
            // Initial content analysis
            const initialContent = await analyzePageContent();
            console.log('Initial page content:', initialContent);
            
            // Check for blocking after initial load
            const blockingStatus = await checkForBlocking();
            if (blockingStatus) {
                console.log(`Myntra blocking detected: ${blockingStatus}`);
                return [];
            }

            // Wait for any product card to appear
            await pageObj.waitForSelector("li.product-base, div.product-base", { timeout: 15000 }).catch(() => { });
            const found = await pageObj.$("li.product-base, div.product-base");
            if (!found) {
                console.warn("No products found");
                return [];
            }

            // More natural scrolling behavior
            for (let i = 0; i < page * 6; i++) {
                if (abortSignal?.aborted) {
                    console.log("Scroll aborted");
                    return [];
                }
                // Random scroll amount
                const scrollAmount = Math.floor(Math.random() * 300) + 200;
                await pageObj.evaluate((amount) => window.scrollBy(0, amount), scrollAmount);
                // Random delay between scrolls
                await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 300));

                // Check for blocking during scrolling
                const scrollBlockingStatus = await checkForBlocking();
                if (scrollBlockingStatus) {
                    console.log(`Myntra blocking detected during scroll: ${scrollBlockingStatus}`);
                    return [];
                }
            }

            // Random wait after scrolling
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 1000));

            // Final content analysis
            const finalContent = await analyzePageContent();
            console.log('Final page content:', finalContent);

            // Final check for blocking
            const finalBlockingStatus = await checkForBlocking();
            if (finalBlockingStatus) {
                console.log(`Myntra blocking detected after scrolling: ${finalBlockingStatus}`);
                return [];
            }

            return pageObj.evaluate((limit, page) => {
                const items = [];
                // Try both possible product card selectors
                document.querySelectorAll("li.product-base, div.product-base").forEach(card => {
                    // Brand
                    const brandEl = card.querySelector("h3.product-brand, div.product-brand");
                    const brand = brandEl ? brandEl.innerText.trim() : "";

                    // Name
                    const nameEl = card.querySelector("h4.product-product, div.product-product");
                    const name = nameEl ? nameEl.innerText.trim() : "";

                    // Price
                    let price = null;
                    const priceEl = card.querySelector("div.product-price span, span.product-price");
                    if (priceEl) {
                        const priceText = priceEl.innerText.replace(/[^\d]/g, "");
                        price = Number(priceText);
                    }

                    // Link
                    const linkEl = card.querySelector("a[data-refreshpage='true'], a[href*='/buy/']");
                    const href = linkEl ? linkEl.getAttribute("href") : "";
                    const link = href.startsWith("http") ? href : "https://www.myntra.com/" + href;

                    // Image
                    const imgEl = card.querySelector("picture.img-responsive img, img.img-responsive");
                    const image = imgEl ? imgEl.src : "";

                    // Discount (if available)
                    let discount = "";
                    const discountEl = card.querySelector("div.product-price span.product-discountedPrice, span.product-discountPercentage");
                    if (discountEl) {
                        discount = discountEl.innerText.trim();
                    }

                    // Reviews and Rating
                    let reviews = "";
                    let reviewRating = null;
                    let reviewCount = null;
                    const ratingEl = card.querySelector("div.product-ratingsContainer span, span.product-ratingsContainer");
                    if (ratingEl) {
                        reviewRating = parseFloat(ratingEl.innerText.trim());
                    }
                    const reviewCountEl = card.querySelector("div.product-ratingsCount, span.product-ratingsCount");
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
                            reviews,
                            reviewRating,
                            platform: "Myntra"
                        });
                    }
                });

                const start = (page - 1) * limit;
                return items.slice(start, start + limit);
            }, limit, page);
        } catch (error) {
            console.error('Myntra scraping error:', error.message);
            if (error.message.includes('ERR_HTTP2_PROTOCOL_ERROR')) {
                console.log('Detected HTTP2 protocol error - Myntra might be blocking the request');
            }
            return [];
        }
    }, trackBrowser, abortSignal);
}

// --- Ajio ---
async function scrapeAjio(query, page = 1, limit = 10, trackBrowser, abortSignal) {
    const url = `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`;
    return scrapeWithProxyAndUserAgent(url, async (pageObj) => {
        await pageObj.waitForSelector("div.item.rilrtl-products-list__item", { timeout: 15000 }).catch(() => { });
        const found = await pageObj.$("div.item.rilrtl-products-list__item");
        if (!found) {
            console.warn("No products found");
            return [];
        }
        for (let i = 0; i < page * 6; i++) {
            if (abortSignal?.aborted) {
                console.log("Scroll aborted");
                return [];
            }
            await pageObj.evaluate(() => window.scrollBy(0, window.innerHeight));
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        await new Promise(resolve => setTimeout(resolve, 1500)); // give time for images/data

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
    }, trackBrowser, abortSignal);
}

// --- API Route ---
app.post("/api/search", async (req, res) => {
    const { query, platforms, page = 1, limit = 10 } = req.body;

    if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Query is required" });
    }

    // Abort any existing request
    await abortCurrentRequest();

    // Setup new request tracking
    const abortController = new AbortController();
    const activeBrowsers = [];
    
    currentRequest.controller = abortController;
    currentRequest.browsers = activeBrowsers;

    // Track browser helper
    const trackBrowser = browser => {
        activeBrowsers.push(browser);
        currentRequest.browsers = activeBrowsers;
    };

    // Improved abort handling
    const cleanup = async () => {
        console.log("Cleaning up resources...");
        abortController.abort();
        const closePromises = activeBrowsers.map(browser =>
            browser.close().catch(err => console.error("Failed to close browser:", err.message))
        );
        await Promise.all(closePromises);
        activeBrowsers.length = 0;
        if (currentRequest.controller === abortController) {
            currentRequest.controller = null;
            currentRequest.browsers = [];
            currentRequest.cleanup = null;
        }
    };

    currentRequest.cleanup = cleanup;

    // Handle request abort
    req.on("aborted", cleanup);
    req.on("close", cleanup);

    // Your platform functions updated to pass abortController.signal
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

    // Map platform to its code with improved abort handling
    const platformFns = {
        flipkart: async () => {
            if (abortController.signal.aborted) return [];
            const flipkartData = await retryFetch(() => scrapeFlipkart(query, page, limit, trackBrowser, abortController.signal), 3, 0);
            if (abortController.signal.aborted) return [];
            const items = flipkartData.items ?? flipkartData;
            cardCounts.Flipkart = flipkartData.cardCount ?? items.length;
            console.log("Flipkart card count:", cardCounts.Flipkart);
            return items;
        },
        amazon: async () => {
            if (abortController.signal.aborted) return [];
            const amazonData = await retryFetch(() => scrapeAmazon(query, page, limit, trackBrowser, abortController.signal), 3, 0);
            if (abortController.signal.aborted) return [];
            cardCounts.Amazon = amazonData.length;
            console.log("Amazon card count:", cardCounts.Amazon);
            return amazonData;
        },
        meesho: async () => {
            if (abortController.signal.aborted) return [];
            const meeshoData = await retryFetch(() => scrapeMeesho(query, page, limit, trackBrowser, abortController.signal), 3, 0);
            if (abortController.signal.aborted) return [];
            cardCounts.Meesho = meeshoData.length;
            console.log("Meesho card count:", cardCounts.Meesho);
            return meeshoData;
        },
        myntra: async () => {
            if (abortController.signal.aborted) return [];
            const myntraData = await retryFetch(() => scrapeMyntra(query, page, limit, trackBrowser, abortController.signal), 3, 0);
            if (abortController.signal.aborted) return [];
            cardCounts.Myntra = myntraData.length;
            console.log("Myntra card count:", cardCounts.Myntra);
            return myntraData;
        },
        ajio: async () => {
            if (abortController.signal.aborted) return [];
            const ajioData = await retryFetch(() => scrapeAjio(query, page, limit, trackBrowser, abortController.signal), 3, 0);
            if (abortController.signal.aborted) return [];
            cardCounts.Ajio = ajioData.length;
            console.log("Ajio card count:", cardCounts.Ajio);
            return ajioData;
        }
    };

    try {
        const promises = selected.map(platform =>
            platformFns[platform]?.().catch(err => {
                if (abortController.signal.aborted) return [];
                cardCounts[platform.charAt(0).toUpperCase() + platform.slice(1)] = 0;
                console.error(`${platform.charAt(0).toUpperCase() + platform.slice(1)} error:`, err.message);
                return [];
            })
        );

        const allResults = await Promise.all(promises);
        if (abortController.signal.aborted) {
            res.status(499).json({ error: "Client closed request" });
            return;
        }
        allResults.forEach(items => results.push(...items));
        shuffle(results);

        res.status(200).json(results);
    } catch (err) {
        if (abortController.signal.aborted) {
            res.status(499).json({ error: "Client closed request" });
            return;
        }
        console.error("Unexpected error:", err.message);
        res.status(500).json({ error: "Internal Server Error" });
    } finally {
        await cleanup();
    }
});

// Handle process termination
process.on("SIGTERM", async () => {
    await abortCurrentRequest();
    process.exit(0);
});

process.on("SIGINT", async () => {
    await abortCurrentRequest();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});