import axios from "axios";
import * as cheerio from "cheerio";
import randomUseragent from "random-useragent";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from 'fs';

puppeteer.use(StealthPlugin());

// Helper function to make HTTP requests with abort support
const makeRequest = async (url, signal, retries = 3) => {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            if (signal?.aborted) {
                throw new Error('Request aborted');
            }
            if (attempt > 1) {
                const delay = Math.floor(Math.random() * 3000) + 2000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': randomUseragent.getRandom(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Connection': 'keep-alive'
                },
                timeout: 15000,
                signal,
                maxRedirects: 5,
                validateStatus: function (status) {
                    return status >= 200 && status < 500;
                }
            });
            if (response.status === 529) {
                throw new Error('Rate limited (529)');
            }
            return response.data;
        } catch (error) {
            lastError = error;
            if (error.name === 'AbortError' || error.message === 'Request aborted') {
                throw error;
            }
            if (attempt === retries) {
                throw error;
            }
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
            if (signal?.aborted) {
                throw new Error('Request aborted');
            }
            const result = await operation();
            if (signal?.aborted) {
                throw new Error('Request aborted');
            }
            if (result && result.length > 0) {
                return result;
            }
            throw new Error('No results found');
        } catch (error) {
            lastError = error;
            if (error.name === 'AbortError' || error.message === 'Request aborted') {
                throw error;
            }
            if (i === maxRetries - 1) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, (i + 1) * 1000));
        }
    }
    throw lastError;
}

// Scraper Helper
async function scrapeWithProxyAndUserAgent(url, pageEvaluateFunc, proxy = null) {
    const userAgent = randomUseragent.getRandom();
    let browser = null;
    try {
        const launchArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080',
        ];
        if (proxy) {
            launchArgs.push(`--proxy-server=${proxy}`);
        }
        const launchOptions = {
            headless: "New",
            args: launchArgs,
            executablePath: process.env.NODE_ENV === "production"
                ? (process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium')
                : process.platform === 'win32'
                    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
                    : process.platform === 'darwin'
                        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
                        : '/usr/bin/google-chrome',
            ignoreHTTPSErrors: true,
            timeout: 60000
        };
        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        if (userAgent) {
            await page.setUserAgent(userAgent);
        }
        // Block unnecessary resources
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const type = req.resourceType();
            if ([
                'image',
                'stylesheet',
                'font',
                'media',
                'websocket',
                'manifest',
                'other'
            ].includes(type)) {
                req.abort();
            } else {
                req.continue();
            }
        });
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(url, {
            waitUntil: "networkidle2",
            timeout: 60000
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
        const html = await page.content();
        console.log(`Loaded URL: ${url}\nPage length: ${html.length}`);
        if (html.length < 5000) {
            console.log(html)
            return null;
        }
        const products = await pageEvaluateFunc(page);
        return products;
    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        throw error;
    } finally {
        if (browser) {
            try {
                await browser.close();
                console.log('Browser closed successfully');
            } catch (err) {
                console.error('Error closing browser:', err.message);
                if (process.platform === 'win32') {
                    try {
                        require('child_process').execSync('taskkill /F /IM chrome.exe /T');
                    } catch (killErr) {
                        console.error('Error force killing browser:', killErr.message);
                    }
                }
            }
        }
    }
}

// Scrape Flipkart
async function scrapeFlipkart(query, page = 1, signal) {
    return retryOperation(async () => {
        try {
            const url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}&page=${page}`;
            const html = await makeRequest(url, signal);
            // console.log(`Page length: ${html.length}`);
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
            const url = `https://www.meesho.com/search?q=${encodeURIComponent(query)}&page=${page}`;

            return scrapeWithProxyAndUserAgent(url, async (pageObj) => {
                if (signal?.aborted) throw new Error('Request aborted');

                // Scroll to load more products
                for (let i = 0; i < page * 2; i++) {
                    if (signal?.aborted) throw new Error('Request aborted');
                    await pageObj.evaluate(() => window.scrollBy(0, window.innerHeight));
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                // Get the final HTML after scrolling
                const html = await pageObj.content();
                const $ = cheerio.load(html);
                const items = [];
                const seenProducts = new Set();

                // Select all product cards with original selectors
                $('div.sc-dkrFOg.ProductListItem__GridCol-sc-1baba2g-0.ieFkkv.kdQjpv,div.sc-dkrFOg, a[href*="/p/"]').each((index, card) => {
                    try {
                        // Name - using both old and new selectors
                        const nameEl = $(card).find("div.name[aria-label], div.name-center[aria-label], div.nameCls[aria-label], p.sc-eDvSVe.gQDOBc.NewProductCardstyled__StyledDesktopProductTitle-sc-6y2tys-5").first();
                        let name = "";
                        if (nameEl.length) {
                            name = nameEl.attr('aria-label') || nameEl.text().trim();
                        }

                        // Skip if product name is empty or already seen
                        if (!name || seenProducts.has(name)) {
                            return;
                        }
                        seenProducts.add(name);

                        // Price - using both old and new selectors
                        const priceText = $(card).find(
                            "h5, h5.dwCrSh, h4.sc-eDvSVe.biMVPh, h5.sc-eDvSVe.dwCrSh"
                        ).text().replace(/[₹,]/g, "").trim();
                        const price = Number(priceText);

                        // Link - using original approach
                        const linkEl = $(card).closest('a').length ? $(card).closest('a') : $(card).find('a');
                        const link = linkEl.length ?
                            (linkEl.attr('href').startsWith('http') ?
                                linkEl.attr('href') :
                                `https://www.meesho.com${linkEl.attr('href')}`) :
                            "";

                        // Image - using both old and new selectors
                        const image = $(card).find("img, img[data-nimg='fill']").attr('src') || "";

                        // Discount - using both old and new selectors
                        let discount = $(card).find(
                            "span.sc-eDvSVe.cBaVUX.NewProductCardstyled__StyledDesktopSubtitle-sc-6y2tys-6.jBXJyw[color='greenBase'], " +
                            "span.sc-eDvSVe.fkvMlU"
                        ).text().trim();

                        // Brand (Meesho usually doesn't show brand)
                        const brand = "";

                        // Rating - using both old and new selectors
                        const ratingText = $(card).find(
                            "span.sc-eDvSVe.laVOtN"
                        ).text().trim();
                        const reviewRating = !isNaN(Number(ratingText)) ? Number(ratingText) : null;

                        // Review count - using both old and new selectors
                        const reviewCountText = $(card).find(
                            "span.sc-eDvSVe.XndEO.NewProductCardstyled__RatingCount-sc-6y2tys-22.iaGtYc.NewProductCardstyled__RatingCount-sc-6y2tys-22.iaGtYc, " +
                            "span.sc-eDvSVe.XndEO.NewProductCardstyled__RatingCount-sc-6y2tys-22"
                        ).text().replace(/[^\d]/g, "");
                        let reviews = "";
                        let reviewCount = null;

                        if (reviewCountText) {
                            reviewCount = Number(reviewCountText);
                            reviews = reviewRating !== null
                                ? `${reviewRating} (${reviewCount.toLocaleString()} reviews)`
                                : `${reviewCount.toLocaleString()} reviews`;
                        } else if (reviewRating !== null) {
                            reviews = `${reviewRating}`;
                        }

                        // Check lengths and make empty if exceeded
                        if (reviews.length > 20) {
                            reviews = "";
                        }
                        if (discount.length > 15) {
                            discount = "";
                        }

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
                    } catch (error) {
                        console.error(`Meesho: Error processing card ${index}:`, error.message);
                    }
                });
                return items;
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
            const myntraUrl = `https://www.myntra.com/${encodeURIComponent(query.trim().toLowerCase())}?rawQuery=${encodeURIComponent(query)}&p=${page}`;
            console.log(myntraUrl);
            const html = await makeRequest(myntraUrl, signal);
            const $ = cheerio.load(html);
            const cards = $('li.product-base, div.product-base');
            console.log('Myntra: Number of product cards found:', cards.length);
            if (cards.length === 0) {
                return null;
            }
            const items = [];
            const seenProducts = new Set();
            cards.each((index, card) => {
                try {
                    // Name
                    const nameEl = $(card).find('h4.product-product, div.product-product, .product-productMetaInfo h4.product-product');
                    const name = nameEl.text().trim();
                    if (!name || seenProducts.has(name)) {
                        console.log('Myntra: Skipping duplicate product:', name);
                        return;
                    }
                    seenProducts.add(name);
                    // Brand
                    const brandEl = $(card).find('h3.product-brand, div.product-brand, .product-productMetaInfo h3.product-brand');
                    const brand = brandEl.text().trim();
                    // Price
                    const priceEl = $(card).find('div.product-price span, span.product-price, span.product-discountedPrice, .product-productMetaInfo .product-price .product-discountedPrice');
                    const priceText = priceEl.text();
                    const price = Number(priceText.replace(/[^\d]/g, ''));
                    // Link
                    const linkEl = $(card).find('a[data-refreshpage="true"], a[href*="/buy/"], .product-productMetaInfo a[data-refreshpage="true"]');
                    const href = linkEl.attr('href');
                    let link = '';
                    if (href) {
                        link = href.startsWith('http') ? href : `https://www.myntra.com${href}`;
                    }
                    // Image
                    const imgEl = $(card).find('picture.img-responsive img, img.img-responsive, .product-imageSliderContainer img.img-responsive');
                    const image = imgEl.first().attr('src');
                    // Discount
                    const discountEl = $(card).find('div.product-price span.product-discountedPrice, span.product-discountPercentage, .product-productMetaInfo .product-discountPercentage');
                    const discount = discountEl.text().trim();
                    // Rating
                    const ratingEl = $(card).find('div.product-ratingsContainer span, span.product-ratingsContainer, div.product-ratingsContainer > span, .product-ratingsContainer > span');
                    const rating = ratingEl.first().text().trim();
                    const reviewRating = rating ? Number(rating) : null;
                    // Reviews
                    const reviewsEl = $(card).find('div.product-ratingsCount, span.product-ratingsCount, .product-ratingsContainer .product-ratingsCount');
                    const reviews = reviewsEl.text().trim();
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
            // Fetch working proxies from API
            let proxies = await getWorkingProxies();
            let proxy = null;
            if (proxies.length > 0) {
                proxy = proxies[Math.floor(Math.random() * proxies.length)];
                console.log('Using proxy for Ajio:', proxy);
            } else {
                console.warn('No working proxies available, running without proxy');
            }
            const url = `https://www.ajio.com/search/?text=${encodeURIComponent(query)}&page=${page}`;
            return scrapeWithProxyAndUserAgent(url, async (pageObj) => {
                if (signal?.aborted) throw new Error('Request aborted');

                // Scroll to load more products
                for (let i = 0; i < page * 1; i++) {
                    if (signal?.aborted) throw new Error('Request aborted');
                    await pageObj.evaluate(() => window.scrollBy(0, window.innerHeight));
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                // Get the final HTML after scrolling
                const html = await pageObj.content();
               
                const isBlocked = (
                    html.includes("CAPTCHA") ||
                    html.includes("Access Denied") ||
                    html.includes("verify you are human") ||
                    html.includes("blocked") ||
                    html.includes("error")
                );

                if (isBlocked) {
                    // Take a screenshot for debugging
                    await pageObj.screenshot({ path: `ajio_blocked_${Date.now()}.png`, fullPage: true });
                    console.log("Blocked or fake page detected! Screenshot saved.");
                    return [];
                }
               
                const $ = cheerio.load(html);
                const items = [];
                const seenProducts = new Set();

                // Select all product cards
                $("div.item.rilrtl-products-list__item.item[role='row'],a.rilrtl-products-list__link.desktop, div.item.rilrtl-products-list__item[role='row'],a.rilrtl-products-list__desktop").each((_, card) => {
                    try {
                        // Name - using exact selectors and taking first match only
                        const nameEl = $(card).find("div.nameCls[aria-label],div.name[aria-label], div.name-center[aria-label]").first();
                        let name = "";
                        if (nameEl.length) {
                            name = nameEl.attr('aria-label') || nameEl.text().trim();
                        }

                        // Skip if product name is empty or already seen
                        if (!name || seenProducts.has(name)) {
                            return;
                        }
                        seenProducts.add(name);

                        // Brand - using exact selectors and taking first match only
                        const brandEl = $(card).find("div.brand[aria-label] strong, div.brand[aria-label]").first();
                        const brand = brandEl.text().trim() || "";

                        // Price - only current price
                        const priceEl = $(card).find("span.price strong").first();
                        let price = null;
                        if (priceEl.length) {
                            price = Number(priceEl.text().replace(/[₹,]/g, ""));
                        }

                        // Discount - only from span.discount
                        let discount = "";
                        const discountEl = $(card).find("span.discount").first();
                        if (discountEl.length) {
                            discount = discountEl.text().replace(/[()]/g, "").trim();
                        }

                        // Link - using exact selector
                        const linkEl = $(card).find("a.rilrtl-products-list__link[href*='/p/'], a.rilrtl-products-list__link.desktop[href*='/p/']").first();
                        const link = linkEl.length ?
                            (linkEl.attr('href').startsWith("http") ?
                                linkEl.attr('href') :
                                "https://www.ajio.com" + linkEl.attr('href')) :
                            "";

                        // Image - using exact selector
                        const imgEl = $(card).find("img.rilrtl-lazy-img.rilrtl-lazy-img-loaded").first();
                        let image = "";
                        if (imgEl.length) {
                            image = imgEl.attr('src');
                            if (image && !image.startsWith('http')) {
                                image = 'https:' + image;
                            }
                        }
                        if (!image) {
                            image = "https://assets.ajio.com/static/img/plp.png";
                        }

                        // Rating - using exact selector
                        let reviewRating = null;
                        const ratingEl = $(card).find("p._3I65V[aria-label]").first();
                        if (ratingEl.length) {
                            reviewRating = parseFloat(ratingEl.attr('aria-label') || ratingEl.text().trim());
                        }

                        // Review count - using exact selector
                        let reviews = "";
                        const reviewCountEl = $(card).find("p[aria-label^='|']").first();
                        if (reviewCountEl.length) {
                            const countText = reviewCountEl.attr('aria-label') || reviewCountEl.text();
                            const match = countText.match(/\d+(?:\.\d+)?[K]?/);
                            if (match) {
                                let reviewCount = match[0];
                                if (reviewCount.includes('K')) {
                                    reviewCount = parseFloat(reviewCount) * 1000;
                                }
                                reviews = reviewRating !== null
                                    ? `${reviewRating} (${reviewCount.toLocaleString()} reviews)`
                                    : `${reviewCount.toLocaleString()} reviews`;
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
                            reviews,
                            reviewRating,
                            platform: "Ajio"
                        });
                    } catch (error) {
                        console.error('Ajio: Error processing card:', error.message);
                    }
                });

                return items;
            }, proxy);
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

async function fetchProxies() {
    const res = await axios.get('https://www.proxy-list.download/api/v1/get?type=http');
    return res.data.split('\r\n').filter(Boolean);
}

async function testProxy(proxy) {
    try {
        const res = await axios.get('https://httpbin.org/ip', {
            proxy: {
                host: proxy.split(':')[0],
                port: parseInt(proxy.split(':')[1])
            },
            timeout: 3000
        });
        return true;
    } catch {
        return false;
    }
}

async function getWorkingProxies() {
    const proxies = await fetchProxies();
    const working = [];
    for (const proxy of proxies) {
        if (await testProxy(proxy)) {
            working.push(proxy);
        }
        if (working.length >= 10) break; // Limit to 10 working proxies
    }
    return working;
}

export { scrapeWithProxyAndUserAgent, scrapeFlipkart, scrapeAmazon, scrapeMeesho, scrapeMyntra, scrapeAjio }; 