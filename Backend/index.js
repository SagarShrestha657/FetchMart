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

            // Add random delay between attempts
            if (attempt > 1) {
                const delay = Math.floor(Math.random() * 3000) + 2000; // Random delay between 2-5 seconds
                await new Promise(resolve => setTimeout(resolve, delay));
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
                    'Referer': 'https://www.google.com/search?q=' + encodeURIComponent(url.split('q=')[1]?.split('&')[0] || '')
                },
                timeout: 10000,
                signal,
                maxRedirects: 5,
                validateStatus: function (status) {
                    return status >= 200 && status < 500;
                }
            });

            // Check for 529 status code
            if (response.status === 529) {
                throw new Error('Rate limited (529)');
            }

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

            // Wait before retrying (exponential backoff with jitter)
            const baseDelay = attempt * 2000;
            const jitter = Math.floor(Math.random() * 1000);
            await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
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

// Scraper Helper
async function scrapeWithProxyAndUserAgent(url, pageEvaluateFunc) {
    const userAgent = randomUseragent.getRandom();
    let browser = null;

    try {
        const launchOptions = {
            headless: "New",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920x1080',
                '--disable-extensions',
                '--disable-software-rasterizer',
                '--disable-features=site-per-process',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-site-isolation-trials'
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
            ignoreHTTPSErrors: true,
            timeout: 30000
        };

        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();

        if (userAgent) {
            await page.setUserAgent(userAgent);
        }

        await page.setViewport({ width: 1920, height: 1080 });

        // Set longer timeout for page load
        await page.goto(url, {
            waitUntil: "networkidle2",
            timeout: 30000  // Increased timeout to 30 seconds
        });

        // Add a small delay to ensure dynamic content loads
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Log the HTML for debugging
        const html = await page.content();
        console.log(`Loaded URL: ${url}\nPage length: ${html.length}`);

        if (html.length < 1000) {
            throw new Error('Page content too small, likely failed to load properly');
        }

        const products = await pageEvaluateFunc(page);
        return products;

    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Scrape Flipkart
async function scrapeFlipkart(query, page = 1, signal) {
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

                // Rating
                let reviewRating = null;
                const rating = $(element).find('div._3LWZlK, div.XQDdHH').text().trim();
                if (rating) {
                    reviewRating = parseFloat(rating);
                }

                // Reviews
                let reviews = '';
                const reviewsText = $(element).find('span._2_R_DZ, span.Wphh3N').text().trim();
                if (reviewsText) {
                    const match = reviewsText.match(/(\d+(?:,\d+)*)/);
                    if (match) {
                        const reviewCount = parseInt(match[1].replace(/,/g, ''));
                        reviews = reviewRating !== null
                            ? `${reviewRating} (${reviewCount.toLocaleString()} reviews)`
                            : `${reviewCount.toLocaleString()} reviews`;
                    }
                } else if (reviewRating !== null) {
                    reviews = `${reviewRating}`;
                }

                if (name && price && image) {
                    items.push({
                        name,
                        price: Number(price),
                        link: link ? `https://www.flipkart.com${link}` : '',
                        image: image || '',
                        brand: brand || '',
                        discount: discount || '',
                        reviews,
                        reviewRating,
                        platform: 'Flipkart'
                    });
                }
            });

            return items;
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
async function scrapeAmazon(query, page = 1, signal) {
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

                // Star rating
                let reviewRating = null;
                const starEl = card.find('span.a-icon-alt');
                if (starEl.length) {
                    const ratingText = starEl.text().trim();
                    const match = ratingText.match(/^([\d.]+)\s+out of 5/);
                    if (match) {
                        reviewRating = parseFloat(match[1]);
                    }
                }

                // Review count
                let reviews = '';
                const countEl = card.find('span.a-size-base.s-underline-text, span.a-size-base.s-underline-text.s-link-style');
                if (countEl.length) {
                    const countText = countEl.text().trim().replace(/,/g, '');
                    if (!isNaN(Number(countText))) {
                        const reviewCount = Number(countText);
                        reviews = reviewRating !== null
                            ? `${reviewRating} (${reviewCount.toLocaleString()} reviews)`
                            : `${reviewCount.toLocaleString()} reviews`;
                    }
                } else if (reviewRating !== null) {
                    reviews = `${reviewRating}`;
                }

                if (name && price && image) {
                    items.push({
                        name,
                        price,
                        link,
                        image,
                        brand,
                        discount,
                        reviews,
                        reviewRating,
                        platform: 'Amazon'
                    });
                }
            });

            return items;
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

// Scrape Meesho
async function scrapeMeesho(query, page = 1, signal) {
    return retryOperation(async () => {
        try {
            console.log('Meesho: Starting scraping attempt...');
            const url = `https://www.meesho.com/search?q=${encodeURIComponent(query)}&page=${page}`;
            console.log('Meesho: URL:', url);
            
            return scrapeWithProxyAndUserAgent(url, async (pageObj) => {
                if (signal?.aborted) throw new Error('Request aborted');

                console.log('Meesho: Waiting for product cards selector...');
                const found = await pageObj.waitForSelector("a[href*='/p/'], div.sc-dkrFOg", { timeout: 15000 }).catch(() => {
                    console.log('Meesho: Product cards selector not found!');
                    return null;
                });
                console.log('Meesho: Product cards selector found:', !!found);

                if (!found) {
                    console.log('Meesho: No products found');
                    return [];
                }

                // Scroll to load more products
                console.log('Meesho: Starting to scroll for more products...');
                for (let i = 0; i < page * 6; i++) {
                    if (signal?.aborted) throw new Error('Request aborted');
                    await pageObj.evaluate(() => window.scrollBy(0, window.innerHeight));
                    await new Promise(resolve => setTimeout(resolve, 300));
                    if (i % 2 === 0) {
                        console.log(`Meesho: Scrolled ${i + 1} times`);
                    }
                }
                console.log('Meesho: Finished scrolling');

                return pageObj.evaluate((page) => {
                    const items = [];
                    const seenProducts = new Set(); // Track unique product names

                    // Try both old and new selectors
                    const cards = document.querySelectorAll("a[href*='/p/'], div.sc-dkrFOg");
                    console.log('Meesho: Number of product cards found:', cards.length);

                    cards.forEach((card, index) => {
                        try {
                            // Name - try both old and new selectors
                            const nameEl = card.querySelector("p[class*='StyledDesktopProductTitle'], p.NewProductCardstyled__StyledDesktopProductTitle-sc-6y2tys-5");
                            console.log(`Meesho: Card ${index} - Name element found:`, !!nameEl);
                            const name = nameEl ? nameEl.innerText.trim() : "";

                            // Skip if product name is empty or already seen
                            if (!name || seenProducts.has(name)) {
                                console.log('Meesho: Skipping duplicate product:', name);
                                return;
                            }
                            seenProducts.add(name); // Add to seen products

                            // Price - try both old and new selectors
                            const priceEl = card.querySelector("h5, h5.dwCrSh");
                            console.log(`Meesho: Card ${index} - Price element found:`, !!priceEl);
                            const price = priceEl ? Number(priceEl.innerText.replace(/[₹,]/g, "").trim()) : null;

                            // Link - try both old and new selectors
                            const linkEl = card.closest('a') || card.querySelector('a');
                            const link = linkEl ? (linkEl.href.startsWith("http") ? linkEl.href : "https://www.meesho.com" + linkEl.getAttribute("href")) : "";
                            console.log(`Meesho: Card ${index} - Link found:`, !!link);

                            // Image - try both old and new selectors
                            const imgEl = card.querySelector("img, img[data-nimg='fill']");
                            console.log(`Meesho: Card ${index} - Image element found:`, !!imgEl);
                            const image = imgEl ? imgEl.src : "";

                            // Discount - try both old and new selectors
                            const discountEl = card.querySelector("span[class*='StyledDesktopSubtitle'], span.fkvMlU");
                            console.log(`Meesho: Card ${index} - Discount element found:`, !!discountEl);
                            const discount = discountEl ? discountEl.innerText.trim() : "";

                            // Brand (Meesho usually doesn't show brand, set to empty string)
                            let brand = "";

                            // Rating - try both old and new selectors
                            const ratingEl = card.querySelector("span.Rating__StyledPill-sc-12htng8-1, span.dxBdQp");
                            console.log(`Meesho: Card ${index} - Rating element found:`, !!ratingEl);
                            let reviewRating = null;
                            if (ratingEl) {
                                const ratingText = ratingEl.innerText.trim();
                                if (!isNaN(Number(ratingText))) reviewRating = Number(ratingText);
                            }

                            // Review count - try both old and new selectors
                            const reviewCountEl = card.querySelector("span.NewProductCardstyled__RatingCount-sc-6y2tys-22, span.iaGtYc");
                            console.log(`Meesho: Card ${index} - Review count element found:`, !!reviewCountEl);
                            let reviews = "";
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

                            if (name && price && image) {
                                items.push({
                                    name,
                                    price,
                                    link,
                                    image,
                                    brand,
                                    discount,
                                    reviews,
                                    reviewRating,
                                    platform: "Meesho"
                                });
                                console.log(`Meesho: Card ${index} - Successfully added to results`);
                            } else {
                                console.log(`Meesho: Card ${index} - Missing required fields:`, {
                                    name: !!name,
                                    price: !!price,
                                    image: !!image
                                });
                            }
                        } catch (error) {
                            console.error(`Meesho: Error processing card ${index}:`, error.message);
                        }
                    });

                    console.log(`Meesho: Total unique items found: ${items.length}`);
                    return items;
                }, page);
            });
        } catch (error) {
            if (error.message === 'Request aborted') {
                console.log('Meesho scraping aborted');
                return [];
            }
            console.error('Meesho scraping error:', error.message);
            throw error;
        }
    }, 3, signal, 'Meesho');
}

// Scrape Myntra
async function scrapeMyntra(query, page = 1, signal) {
    return retryOperation(async () => {
        try {
            const url = `https://www.myntra.com/${encodeURIComponent(query.trim().toLowerCase())}?rawQuery=${encodeURIComponent(query)}&p=${page}`;
            return scrapeWithProxyAndUserAgent(url, async (pageObj) => {
                if (signal?.aborted) throw new Error('Request aborted');

                console.log('Myntra: Waiting for product cards selector...');
                const found = await pageObj.waitForSelector('li.product-base, div.product-base', { timeout: 15000 }).catch(() => {
                    console.log('Myntra: Product cards selector not found!');
                    return null;
                });
                console.log('Myntra: Product cards selector found:', !!found);

                if (!found) {
                    console.log('Myntra: No products found');
                    return [];
                }

                // Scroll to load more products
                for (let i = 0; i < page * 6; i++) {
                    if (signal?.aborted) throw new Error('Request aborted');
                    await pageObj.evaluate(() => window.scrollBy(0, window.innerHeight));
                    await new Promise(resolve => setTimeout(resolve, 600));
                }

                return pageObj.evaluate((page) => {
                    const items = [];
                    const seenProducts = new Set(); // Track unique product names

                    const cards = document.querySelectorAll('li.product-base, div.product-base');
                    console.log('Myntra: Number of product cards found:', cards.length);

                    cards.forEach((card, index) => {
                        try {
                            // Name
                            const nameEl = card.querySelector('h4.product-product, div.product-product');
                            console.log(`Myntra: Card ${index} - Name element found:`, !!nameEl);
                            const name = nameEl?.textContent.trim() || "";

                            // Skip if product name is empty or already seen
                            if (!name || seenProducts.has(name)) {
                                console.log('Myntra: Skipping duplicate product:', name);
                                return;
                            }
                            seenProducts.add(name); // Add to seen products

                            // Brand
                            const brandEl = card.querySelector('h3.product-brand, div.product-brand');
                            console.log(`Myntra: Card ${index} - Brand element found:`, !!brandEl);
                            const brand = brandEl?.textContent.trim() || "";

                            // Price
                            const priceEl = card.querySelector('div.product-price span, span.product-price');
                            console.log(`Myntra: Card ${index} - Price element found:`, !!priceEl);
                            const priceText = priceEl?.textContent || "";
                            const price = Number(priceText.replace(/[^\d]/g, ''));

                            // Link
                            const linkEl = card.querySelector('a[data-refreshpage="true"], a[href*="/buy/"]');
                            console.log(`Myntra: Card ${index} - Link element found:`, !!linkEl);
                            const link = linkEl ? (linkEl.href.startsWith('http') ? linkEl.href : `https://www.myntra.com${linkEl.getAttribute('href')}`) : "";

                            // Image
                            const imgEl = card.querySelector('picture.img-responsive img, img.img-responsive');
                            console.log(`Myntra: Card ${index} - Image element found:`, !!imgEl);
                            const image = imgEl?.src || "";

                            // Discount
                            const discountEl = card.querySelector('div.product-price span.product-discountedPrice, span.product-discountPercentage');
                            console.log(`Myntra: Card ${index} - Discount element found:`, !!discountEl);
                            const discount = discountEl?.textContent.trim() || "";

                            // Rating
                            const ratingEl = card.querySelector('div.product-ratingsContainer span, span.product-ratingsContainer');
                            console.log(`Myntra: Card ${index} - Rating element found:`, !!ratingEl);
                            const rating = ratingEl?.textContent.trim() || "";
                            const reviewRating = rating ? Number(rating) : null;

                            // Reviews
                            const reviewsEl = card.querySelector('div.product-ratingsCount, span.product-ratingsCount');
                            console.log(`Myntra: Card ${index} - Reviews element found:`, !!reviewsEl);
                            const reviews = reviewsEl?.textContent.trim() || "";

                            if (name && price && image) {
                                items.push({
                                    name,
                                    price,
                                    link,
                                    image,
                                    brand,
                                    discount,
                                    reviews,
                                    reviewRating,
                                    platform: 'Myntra'
                                });
                                console.log(`Myntra: Card ${index} - Successfully added to results`);
                            } else {
                                console.log(`Myntra: Card ${index} - Missing required fields:`, {
                                    name: !!name,
                                    price: !!price,
                                    image: !!image
                                });
                            }
                        } catch (error) {
                            console.error(`Myntra: Error processing card ${index}:`, error.message);
                        }
                    });

                    console.log(`Myntra: Total unique items found: ${items.length}`);
                    return items;
                }, page);
            });
        } catch (error) {
            if (error.message === 'Request aborted') {
                console.log('Myntra scraping aborted');
                return [];
            }
            console.error('Myntra scraping error:', error.message);
            throw error;
        }
    }, 3, signal, 'Myntra');
}

// Scrape Ajio
async function scrapeAjio(query, page = 1, signal) {
    return retryOperation(async () => {
        try {
            const url = `https://www.ajio.com/search/?text=${encodeURIComponent(query)}&page=${page}`;
            return scrapeWithProxyAndUserAgent(url, async (pageObj) => {
                if (signal?.aborted) throw new Error('Request aborted');

                const found = await pageObj.waitForSelector("div.item.rilrtl-products-list__item" || "item rilrtl-products-list__item item", { timeout: 15000 }).catch(() => {
                    console.log('Ajio: Product cards selector not found!');
                    return null;
                });
                console.log('Ajio: Product cards selector found:', !!found);

                // Scroll to load more products
                for (let i = 0; i < page * 6; i++) {
                    if (signal?.aborted) throw new Error('Request aborted');
                    await pageObj.evaluate(() => window.scrollBy(0, window.innerHeight));
                    await new Promise(resolve => setTimeout(resolve, 600));
                }

                return pageObj.evaluate((page) => {
                    const items = [];
                    const seenProducts = new Set(); // Track unique product names

                    document.querySelectorAll("div.item.rilrtl-products-list__item" || "item rilrtl-products-list__item item").forEach(card => {
                        // Name - try both old and new selectors
                        const nameEl = card.querySelector("div.nameCls") ||
                            card.querySelector("div.name-center") ||
                            card.querySelector("div.name");
                        console.log('Ajio: Product name element found:', !!nameEl);
                        let name = "";
                        if (nameEl) {
                            // Try aria-label first, then fallback to innerText
                            name = nameEl.getAttribute('aria-label') || nameEl.innerText.trim();
                        }

                        // Skip if product name is empty or already seen
                        if (!name || seenProducts.has(name)) {
                            console.log('Ajio: Skipping duplicate product:', name);
                            return;
                        }
                        seenProducts.add(name); // Add to seen products

                        // Brand - try both old and new selectors
                        const brandEl = card.querySelector("div.brand strong");
                        console.log('Ajio: Brand element found:', !!brandEl);
                        const brand = brandEl?.textContent.trim() || "";

                        // Price - try multiple selectors
                        let price = null;
                        const priceEl = card.querySelector("span.price strong") ||
                            card.querySelector("span.price #price-value") ||
                            card.querySelector("span.price");
                        console.log('Ajio: Price element found:', !!priceEl);
                        if (priceEl) {
                            if (priceEl.id === "price-value") {
                                price = Number(priceEl.textContent.replace(/[₹,]/g, ""));
                        } else {
                                const priceValue = priceEl.querySelector("#price-value");
                                if (priceValue) {
                                    price = Number(priceValue.textContent.replace(/[₹,]/g, ""));
                                } else {
                                    const ariaLabel = priceEl.getAttribute("aria-label");
                                    if (ariaLabel) {
                                        price = Number(ariaLabel.replace(/[₹,]/g, ""));
                                    } else {
                                        price = Number(priceEl.textContent.replace(/[₹,]/g, ""));
                                    }
                                }
                            }
                        }

                        // Link - try both old and new selectors
                        const linkEl = card.querySelector("a.rilrtl-products-list__link.desktop") ||
                            card.querySelector("a.rilrtl-products-list__link");
                        const link = linkEl ? (linkEl.href.startsWith("http") ? linkEl.href : "https://www.ajio.com" + linkEl.getAttribute("href")) : "";

                        // Image - try both old and new selectors
                        const imgEl = card.querySelector("img.rilrtl-lazy-img");
                        console.log('Ajio: Image element found:', !!imgEl);
                        const image = imgEl ? (imgEl.src.startsWith("http") ? imgEl.src : "https:" + imgEl.src) : "";

                        // Rating - try both old and new selectors
                        let reviewRating = null;
                        const ratingEl = card.querySelector("p._3I65V[aria-label]") ||
                            card.querySelector("p._3I65V");
                        if (ratingEl) {
                            reviewRating = parseFloat(ratingEl.getAttribute("aria-label") || ratingEl.innerText.trim());
                        }

                        // Review count - try both old and new selectors
                        let reviews = "";
                        const reviewCountEl = card.querySelector("p[aria-label^='|']") ||
                            card.querySelector("p[aria-label]:not(._3I65V)");
                        if (reviewCountEl) {
                            const countText = reviewCountEl.getAttribute("aria-label") || reviewCountEl.innerText;
                            const match = countText.match(/\d+/);
                            if (match) {
                                const reviewCount = Number(match[0]);
                                reviews = reviewRating !== null
                                    ? `${reviewRating} (${reviewCount.toLocaleString()} reviews)`
                                    : `${reviewCount.toLocaleString()} reviews`;
                            }
                        } else if (reviewRating !== null) {
                            reviews = `${reviewRating}`;
                        }

                        // Discount - try both old and new selectors
                        let discount = "";
                        // Try old discount selector
                        const discountEl = card.querySelector("span.discount");
                        if (discountEl) {
                            discount = discountEl.innerText.replace(/[()]/g, "").trim();
                        } else {
                            // Try new BBS Price discount calculation
                            const bbsPriceEl = card.querySelector("div._305pl span span");
                            if (bbsPriceEl) {
                                const bbsPrice = Number(bbsPriceEl.textContent.replace(/[₹,]/g, ""));
                                if (price && bbsPrice < price) {
                                    const discountPercent = Math.round(((price - bbsPrice) / price) * 100);
                                    discount = `[${discountPercent}% off]`;
                                }
                            }
                        }

                        if (name && price && image) {
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
                            console.log('Ajio: Added unique product:', name);
                        }
                    });

                    console.log(`Ajio: Total unique items found: ${items.length}`);
                    return items;
                }, page);
            });
        } catch (error) {
            if (error.message === 'Request aborted') {
                console.log('Ajio scraping aborted');
                return [];
            }
            console.error('Ajio scraping error:', error.message);
            throw error;
        }
    }, 3, signal, 'Ajio');
}

// API Route
app.post("/api/search", async (req, res) => {
    const { query, platforms, page = 1 } = req.body;

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
        : ["flipkart", "amazon", "meesho", "ajio"];

    const results = [];
    const cardCounts = {};
    const errors = {};

    // Map platform to its scraping function
    const platformFns = {
        flipkart: async () => {
            if (abortController.signal.aborted) return [];
            try {
                const flipkartData = await scrapeFlipkart(query, page, abortController.signal);
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
                const amazonData = await scrapeAmazon(query, page, abortController.signal);
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
                const meeshoData = await scrapeMeesho(query, page, abortController.signal);
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
                const myntraData = await scrapeMyntra(query, page, abortController.signal);
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
                const ajioData = await scrapeAjio(query, page, abortController.signal);
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
            res.status(499).json({ error: "Previous search aborted", aborted: true });
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