import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";
import randomUseragent from "random-useragent";
import { EventEmitter } from 'events';
import { chromium } from 'playwright-core';
import dotenv from 'dotenv';
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

// Load environment variables
dotenv.config();

// Increase max listeners limit
EventEmitter.defaultMaxListeners = 50;

// Use stealth plugin
puppeteer.use(StealthPlugin());

// RapidAPI Configuration
// const RAPIDAPI_KEY = '8aed390357msh1f69d2669c16bd8p14b341jsnf7dd53f46116';
// const RAPIDAPI_HOST = 'real-time-meesho-api.p.rapidapi.com';

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

// Helper function to make HTTP requests with abort support
const makeRequest = async (url, signal, retries = 3) => {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            // Check if request was aborted
            if (signal?.aborted) {
                throw new Error('Request aborted');
            }

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': randomUseragent.getRandom(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
                    'Sec-Ch-Ua-Mobile': '?0',
                    'Sec-Ch-Ua-Platform': '"Windows"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1',
                    'Referer': 'https://www.google.com/'
                },
                timeout: 20000,
                signal
            });
            return response.data;
        } catch (error) {
            lastError = error;

            // If request was aborted, don't retry
            if (error.name === 'AbortError' || error.message === 'Request aborted') {
                throw error;
            }

            // If it's the last attempt, throw the error
            if (attempt === retries) {
                throw error;
            }

            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, attempt * 3000));
        }
    }
    throw lastError;
};

// Helper function to retry operations
async function retryOperation(operation, maxRetries = 3, signal, platformName) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            // Check if request was aborted before each attempt
            if (signal?.aborted) {
                throw new Error('Request aborted');
            }

            console.log(`${platformName} attempt ${i + 1} of ${maxRetries}`);
            const result = await operation();

            // Check if request was aborted after operation
            if (signal?.aborted) {
                throw new Error('Request aborted');
            }

            if (result && result.length > 0) {
                return result;
            }
            throw new Error('No results found');
        } catch (error) {
            lastError = error;

            // If request was aborted, don't retry
            if (error.name === 'AbortError' || error.message === 'Request aborted') {
                throw error;
            }

            // If it's the last attempt, throw the error
            if (i === maxRetries - 1) {
                throw error;
            }

            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000));
        }
    }
    throw lastError;
}

// Helper function to scrape with Playwright
async function scrapeWithPlaywright(url, pageEvaluateFunc, trackBrowser, abortSignal) {
    const userAgent = randomUseragent.getRandom();
    const isProduction = process.env.NODE_ENV === "production";

    const launchOptions = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--single-process',
            '--no-zygote'
        ],
        executablePath: process.env.CHROME_PATH || undefined
    };

    let browser;
    let abortListener;
    try {
        browser = await chromium.launch(launchOptions);
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
                    await Promise.all(pages.map(page => page.close().catch(() => { })));
                    await browser.close();
                }
            } catch (err) {
                console.error("Error closing browser:", err.message);
            }
        };

        // Add the listener and store it for cleanup
        abortSignal.addEventListener("abort", abortListener, { once: true });

        const context = await browser.newContext({
            userAgent: userAgent,
            viewport: { width: 1280, height: 800 },
            ignoreHTTPSErrors: true
        });

        const page = await context.newPage();
        await page.setDefaultTimeout(30000);

        // Add error handling for navigation
        try {
            await page.goto(url, {
                waitUntil: "networkidle",
                timeout: 30000
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
                await Promise.all(pages.map(page => page.close().catch(() => { })));
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

// Scrape Flipkart
async function scrapeFlipkart(query, page = 1, limit = 10, signal) {
    return retryOperation(async () => {
        try {
            const url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}&page=${page}`;
            const html = await makeRequest(url, signal);
            const $ = cheerio.load(html);
            const items = [];

            // Desktop cards
            $('div._1AtVbE, div.LFEi7Z, div.slAVV4, div.tUxRFH').each((_, element) => {
                if (signal.aborted) return false;

                // Try different selectors for name
                const name = $(element).find('div._4rR01T, a.WKTcLC, div.KzDlHZ, a.wjcEIp').text().trim();

                // Try different selectors for price
                const price = $(element).find('div._30jeq3, div.Nx9bqj').text().replace(/[₹,]/g, '');

                // Try different selectors for link
                const link = $(element).find('a._1fQZEK, a.WKTcLC, a.CGtC98, a.wjcEIp').attr('href');

                // Try different selectors for image
                const image = $(element).find('img._396cs4, img.DByuf4, img._53J4C-').attr('src');

                // Try different selectors for brand
                const brand = $(element).find('div._2WkVRV, div.syl9yP').text().trim();

                // Try different selectors for discount
                const discount = $(element).find('div._3Ay6Sb, div.UkUFwK span, span._3Ay6Sb').text().trim();

                if (name && price) {
                    items.push({
                        name,
                        price: Number(price),
                        link: link ? `https://www.flipkart.com${link}` : '',
                        image: image || '',
                        brand: brand || '',
                        discount: discount || '',
                        reviews: '',
                        reviewRating: null,
                        platform: 'Flipkart'
                    });
                }
            });

            // Apply pagination first
            const start = (page - 1) * limit;
            const paginatedItems = items.slice(start, start + limit);

            // Process reviews and ratings only for paginated items
            paginatedItems.forEach(item => {
                const element = $(`div._1AtVbE:contains("${item.name}"), div.LFEi7Z:contains("${item.name}"), div.slAVV4:contains("${item.name}"), div.tUxRFH:contains("${item.name}")`).first();

                // Rating
                const rating = element.find('div._3LWZlK, div.XQDdHH').text().trim();
                if (rating) {
                    item.reviewRating = parseFloat(rating);
                }

                // Reviews
                const reviewsText = element.find('span._2_R_DZ, span.Wphh3N').text().trim();
                if (reviewsText) {
                    const match = reviewsText.match(/(\d+(?:,\d+)*)/);
                    if (match) {
                        const reviewCount = parseInt(match[1].replace(/,/g, ''));
                        item.reviews = item.reviewRating !== null
                            ? `${item.reviewRating} (${reviewCount.toLocaleString()} reviews)`
                            : `${reviewCount.toLocaleString()} reviews`;
                    }
                } else if (item.reviewRating !== null) {
                    item.reviews = `${item.reviewRating}`;
                }
            });

            return paginatedItems;
        } catch (error) {
            if (error.message === 'Request aborted') {
                console.log('Flipkart scraping aborted');
                return [];
            }
            console.error('Flipkart scraping error:', error.message);
            throw error;
        }
    }, 3, signal, 'Flipkart');
}

// Scrape Amazon
async function scrapeAmazon(query, page = 1, limit = 10, signal) {
    return retryOperation(async () => {
        try {
            const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}&page=${page}`;
            const html = await makeRequest(url, signal);
            const $ = cheerio.load(html);
            const items = [];

            // Find all product cards using the new selector
            $('div.s-result-item[data-component-type="s-search-result"]').each((_, element) => {
                if (signal.aborted) return false;

                const card = $(element);

                // Product name
                const name = card.find('h2 span').text().trim();

                // Product link
                const linkEl = card.find('a.a-link-normal.s-no-outline, h2 a.a-link-normal');
                const href = linkEl.attr('href') || '';
                const link = href.startsWith('http') ? href : `https://www.amazon.in${href}`;

                // Product image
                const image = card.find('img.s-image').attr('src') || '';

                // Product price with fraction
                const priceWhole = card.find('span.a-price-whole').text().replace(/[₹,]/g, '');
                const priceFraction = card.find('span.a-price-fraction').text();
                let price = null;
                if (priceWhole) {
                    const priceStr = priceWhole + (priceFraction ? '.' + priceFraction : '');
                    price = Number(priceStr);
                }

                // Brand name
                let brand = '';
                const brandEl = card.find('h5.s-line-clamp-1 span, span.a-size-base-plus.a-color-base');
                if (brandEl.length) {
                    brand = brandEl.text().trim();
                } else if (name) {
                    // Try to extract brand from name (first word)
                    brand = name.split(' ')[0];
                }

                // Discount
                let discount = '';
                const discountEl = card.find('span.a-letter-space + span');
                if (discountEl.length) {
                    const txt = discountEl.text().trim();
                    if (/% off/i.test(txt) || /off/i.test(txt)) {
                        // Extract only the percentage off part
                        const match = txt.match(/(\d+%)\s*off/i);
                        if (match) {
                            discount = `[${match[1]} off]`;
                        }
                    }
                }
                // Check for discount in badge
                const badgeEl = card.find('span.a-badge-text');
                if (!discount && badgeEl.length && /deal|off/i.test(badgeEl.text())) {
                    const txt = badgeEl.text().trim();
                    const match = txt.match(/(\d+%)\s*off/i);
                    if (match) {
                        discount = `[${match[1]} off]`;
                    }
                }

                if (name && price) {
                    items.push({
                        name,
                        price,
                        link,
                        image,
                        brand,
                        discount,
                        reviews: '',
                        reviewRating: null,
                        platform: 'Amazon'
                    });
                }
            });

            // Apply pagination first
            const start = (page - 1) * limit;
            const paginatedItems = items.slice(start, start + limit);

            // Process reviews and ratings only for paginated items
            paginatedItems.forEach(item => {
                const card = $(`div.s-result-item[data-component-type="s-search-result"]:contains("${item.name}")`).first();

                // Star rating
                const starEl = card.find('span.a-icon-alt');
                if (starEl.length) {
                    const ratingText = starEl.text().trim();
                    const match = ratingText.match(/^([\d.]+)\s+out of 5/);
                    if (match) {
                        item.reviewRating = parseFloat(match[1]);
                    }
                }

                // Review count
                const countEl = card.find('span.a-size-base.s-underline-text, span.a-size-base.s-underline-text.s-link-style');
                if (countEl.length) {
                    const countText = countEl.text().trim().replace(/,/g, '');
                    if (!isNaN(Number(countText))) {
                        const reviewCount = Number(countText);
                        item.reviews = item.reviewRating !== null
                            ? `${item.reviewRating} (${reviewCount.toLocaleString()} reviews)`
                            : `${reviewCount.toLocaleString()} reviews`;
                    }
                } else if (item.reviewRating !== null) {
                    item.reviews = `${item.reviewRating}`;
                }
            });

            return paginatedItems;
        } catch (error) {
            if (error.message === 'Request aborted') {
                console.log('Amazon scraping aborted');
                return [];
            }
            console.error('Amazon scraping error:', error.message);
            throw error;
        }
    }, 3, signal, 'Amazon');
}

// Scrape Meesho using Puppeteer
async function scrapeMeesho(query, page = 1, limit = 10, signal) {
    return retryFetch(async () => {
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

                    if (name && price) {
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
                    }
                });
                const start = (page - 1) * limit;
                return items.slice(start, start + limit);
            }, limit, page);
        }, (browser) => {
            if (currentRequest.browsers) {
                currentRequest.browsers.push(browser);
            }
        }, signal);
    }, 3, 1000);
}

// Scrape Myntra
async function scrapeMyntra(query, page = 1, limit = 10, signal) {
    return retryFetch(async () => {
        const url = `https://www.myntra.com/${encodeURIComponent(query.trim().toLowerCase())}?rawQuery=${encodeURIComponent(query)}&p=${page}`;
        return scrapeWithPlaywright(url, async (pageObj) => {
            await pageObj.waitForSelector('li.product-base, div.product-base', { timeout: 15000 }).catch(() => { });
            const found = await pageObj.$('li.product-base, div.product-base');
            if (!found) {
                console.warn("No products found");
                return [];
            }

            return pageObj.evaluate((limit) => {
                const items = [];
                const cards = document.querySelectorAll('li.product-base, div.product-base');
                console.log('Myntra found cards:', cards.length);

                cards.forEach((card) => {
                    const brand = card.querySelector('h3.product-brand, div.product-brand')?.textContent.trim() || '';
                    const name = card.querySelector('h4.product-product, div.product-product')?.textContent.trim() || '';
                    const priceText = card.querySelector('div.product-price span, span.product-price')?.textContent || '';
                    const price = Number(priceText.replace(/[^\d]/g, ''));
                    const linkEl = card.querySelector('a[data-refreshpage="true"], a[href*="/buy/"]');
                    const link = linkEl ? (linkEl.href.startsWith('http') ? linkEl.href : `https://www.myntra.com${linkEl.getAttribute('href')}`) : '';
                    const image = card.querySelector('picture.img-responsive img, img.img-responsive')?.src || '';
                    const discount = card.querySelector('div.product-price span.product-discountedPrice, span.product-discountPercentage')?.textContent.trim() || '';
                    const rating = card.querySelector('div.product-ratingsContainer span, span.product-ratingsContainer')?.textContent.trim() || '';
                    const reviews = card.querySelector('div.product-ratingsCount, span.product-ratingsCount')?.textContent.trim() || '';

                    if (name && price) {
                        items.push({
                            name,
                            price,
                            link,
                            image,
                            brand,
                            discount,
                            reviews,
                            reviewRating: rating ? Number(rating) : null,
                            platform: 'Myntra'
                        });
                    }
                });

                return items.slice(0, limit);
            }, limit);
        }, (browser) => {
            if (currentRequest.browsers) {
                currentRequest.browsers.push(browser);
            }
        }, signal);
    }, 3, 1000);
}

// Scrape Ajio using Puppeteer
async function scrapeAjio(query, page = 1, limit = 10, signal) {
    return retryFetch(async () => {
        const url = `https://www.ajio.com/search/?text=${encodeURIComponent(query)}`;
        return scrapeWithProxyAndUserAgent(url, async (pageObj) => {
            await pageObj.waitForSelector("div.item.rilrtl-products-list__item", { timeout: 15000 }).catch(() => { });
            const found = await pageObj.$("div.item.rilrtl-products-list__item");
            if (!found) {
                console.warn("No products found");
                return [];
            }

            // Get initial HTML length
            const initialHtml = await pageObj.content();
            console.log('Ajio initial HTML length:', initialHtml.length);

            // Scroll to load more products
            for (let i = 0; i < page * 6; i++) {
                if (signal?.aborted) {
                    console.log("Ajio scroll aborted");
                    return [];
                }
                await pageObj.evaluate(() => window.scrollBy(0, window.innerHeight));
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Get final HTML after scrolling
            const finalHtml = await pageObj.content();
            console.log('Ajio final HTML length:', finalHtml.length);

            return pageObj.evaluate((limit, page) => {
                const items = [];
                const cards = document.querySelectorAll("div.item.rilrtl-products-list__item");
                console.log('Ajio found cards:', cards.length);

                cards.forEach((card) => {
                    // Name
                    const name = card.querySelector("div.nameCls, div.name-center, div.name")?.textContent.trim() || "";

                    // Brand
                    const brand = card.querySelector("div.brand strong")?.textContent.trim() || "";

                    // Price
                    let price = null;
                    const priceEl = card.querySelector("span.price strong, span.price #price-value");
                    if (priceEl) {
                        price = Number(priceEl.textContent.replace(/[₹,]/g, ""));
                    } else {
                        const priceAria = card.querySelector("span.price");
                        if (priceAria) {
                            const aria = priceAria.getAttribute("aria-label");
                            if (aria) price = Number(aria.replace(/[₹,]/g, ""));
                            else price = Number(priceAria.textContent.replace(/[₹,]/g, ""));
                        }
                    }

                    // Link
                    const href = card.querySelector("a.rilrtl-products-list__link.desktop, a.rilrtl-products-list__link")?.getAttribute("href") || "";
                    const link = href.startsWith("http") ? href : "https://www.ajio.com" + href;

                    // Image
                    const imgSrc = card.querySelector("img.rilrtl-lazy-img")?.getAttribute("src") || "";
                    const image = imgSrc.startsWith("http") ? imgSrc : "https:" + imgSrc;

                    // Discount
                    const discount = card.querySelector("span.discount")?.textContent.replace(/[()]/g, "").trim() || "";

                    // Reviews and Rating
                    let reviews = "";
                    let reviewRating = null;
                    let reviewCount = null;

                    const ratingEl = card.querySelector("p._3I65V[aria-label]");
                    if (ratingEl) {
                        reviewRating = parseFloat(ratingEl.getAttribute("aria-label") || ratingEl.textContent.trim());
                    }

                    const reviewCountEl = card.querySelector("p[aria-label]:not(._3I65V)");
                    if (reviewCountEl) {
                        const countText = reviewCountEl.getAttribute("aria-label") || reviewCountEl.textContent;
                        const match = countText.match(/\d+/);
                        if (match) reviewCount = Number(match[0]);
                    }

                    // Format reviews string
                    if (reviewRating !== null && reviewCount !== null) {
                        reviews = `${reviewRating} (${reviewCount.toLocaleString()} reviews)`;
                    } else if (reviewRating !== null) {
                        reviews = `${reviewRating}`;
                    } else if (reviewCount !== null) {
                        reviews = `${reviewCount.toLocaleString()} reviews`;
                    }

                    if (name && price) {
                        items.push({
                            name,
                            price,
                            link,
                            image,
                            brand,
                            discount,
                            reviews,
                            reviewRating,
                            platform: "Ajio"
                        });
                    }
                });

                const start = (page - 1) * limit;
                return items.slice(start, start + limit);
            }, limit, page);
        }, (browser) => {
            if (currentRequest.browsers) {
                currentRequest.browsers.push(browser);
            }
        }, signal);
    }, 3, 1000);
}

// Helper function to scrape with Puppeteer and proxy
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
                    await Promise.all(pages.map(page => page.close().catch(() => { })));
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
                await Promise.all(pages.map(page => page.close().catch(() => { })));
                await browser.close();
            } catch (err) {
                console.error("Error closing browser:", err.message);
            }
        }
    }
}

// API Route
app.post("/api/search", async (req, res) => {
    const { query, platforms, page = 1, limit = 10 } = req.body;

    if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Query is required" });
    }

    // Abort any existing request
    await abortCurrentRequest();

    // Setup new request tracking
    const abortController = new AbortController();
    currentRequest.controller = abortController;

    // Cleanup function
    const cleanup = async () => {
        console.log("Cleaning up resources...");
        if (currentRequest.controller === abortController) {
            currentRequest.controller = null;
            currentRequest.cleanup = null;
        }
    };

    currentRequest.cleanup = cleanup;

    // Handle request abort
    req.on("aborted", cleanup);
    req.on("close", cleanup);

    const selected = Array.isArray(platforms) && platforms.length > 0
        ? platforms.map(p => p.toLowerCase())
        : ["flipkart", "amazon", "meesho", "myntra", "ajio"];

    const results = [];
    const cardCounts = {};
    const errors = {};

    // Map platform to its scraping function
    const platformFns = {
        flipkart: async () => {
            if (abortController.signal.aborted) return [];
            try {
                const flipkartData = await scrapeFlipkart(query, page, limit, abortController.signal);
                if (abortController.signal.aborted) return [];
                cardCounts.Flipkart = flipkartData.length;
                console.log("Flipkart card count:", cardCounts.Flipkart);
                return flipkartData;
            } catch (error) {
                errors.Flipkart = error.message;
                console.error("Flipkart failed after retries:", error.message);
                return [];
            }
        },
        amazon: async () => {
            if (abortController.signal.aborted) return [];
            try {
                const amazonData = await scrapeAmazon(query, page, limit, abortController.signal);
                if (abortController.signal.aborted) return [];
                cardCounts.Amazon = amazonData.length;
                console.log("Amazon card count:", cardCounts.Amazon);
                return amazonData;
            } catch (error) {
                errors.Amazon = error.message;
                console.error("Amazon failed after retries:", error.message);
                return [];
            }
        },
        meesho: async () => {
            if (abortController.signal.aborted) return [];
            try {
                const meeshoData = await scrapeMeesho(query, page, limit, abortController.signal);
                if (abortController.signal.aborted) return [];
                cardCounts.Meesho = meeshoData.length;
                console.log("Meesho card count:", cardCounts.Meesho);
                return meeshoData;
            } catch (error) {
                errors.Meesho = error.message;
                console.error("Meesho failed after retries:", error.message);
                return [];
            }
        },
        myntra: async () => {
            if (abortController.signal.aborted) return [];
            try {
                const myntraData = await scrapeMyntra(query, page, limit, abortController.signal);
                if (abortController.signal.aborted) return [];
                cardCounts.Myntra = myntraData.length;
                console.log("Myntra card count:", cardCounts.Myntra);
                return myntraData;
            } catch (error) {
                errors.Myntra = error.message;
                console.error("Myntra failed after retries:", error.message);
                return [];
            }
        },
        ajio: async () => {
            if (abortController.signal.aborted) return [];
            try {
                const ajioData = await scrapeAjio(query, page, limit, abortController.signal);
                if (abortController.signal.aborted) return [];
                cardCounts.Ajio = ajioData.length;
                console.log("Ajio card count:", cardCounts.Ajio);
                return ajioData;
            } catch (error) {
                errors.Ajio = error.message;
                console.error("Ajio failed after retries:", error.message);
                return [];
            }
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

        // Shuffle results
        for (let i = results.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [results[i], results[j]] = [results[j], results[i]];
        }

        res.status(200).json(results);
    } catch (err) {
        if (abortController.signal.aborted) {
            res.status(499).json();
            return;
        }
        console.error("Unexpected error:", err.message);
        res.status(500).json({ message: "Internal Server Error" });
    } finally {
        await cleanup();
    }
});

// Amazon suggestions endpoint
app.get('/api/suggestions', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        const response = await axios.get('https://completion.amazon.in/api/2017/suggestions', {
            params: {
                'session-id': `257-${Date.now()}`,
                'customer-id': '',
                'request-id': 'YVZQZQZQZQZQ',
                'page-type': 'Search',
                'lop': 'en_IN',
                'site-variant': 'desktop',
                'client-info': 'amazon-search-ui',
                'mid': 'A21TJRUUN4KGV',
                'alias': 'aps',
                'b2b': '0',
                'fresh': '0',
                'ks': '87',
                'prefix': query,
                'event': 'onKeyPress',
                'limit': '11',
                'fb': '1',
                'suggestion-type': 'KEYWORD'
            },
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Referer': 'https://www.amazon.in/',
                'Origin': 'https://www.amazon.in'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching Amazon suggestions:', error);
        res.status(500).json({ error: 'Failed to fetch suggestions' });
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