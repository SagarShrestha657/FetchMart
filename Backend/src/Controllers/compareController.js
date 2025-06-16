import * as cheerio from "cheerio";
import axios from 'axios';
import randomUseragent from "random-useragent";
import puppeteer from 'puppeteer';

// Common headers to mimic a real browser
const commonHeaders = {
  'User-Agent': randomUseragent.getRandom(),
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0'
};

// Add delay helper function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Add retry logic helper
const makeRequestWithRetry = async (url, options, maxRetries = 3, baseDelay = 2000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, options);
      return response;
    } catch (error) {
      if (error.response?.status === 429 && attempt < maxRetries) {
        const delayTime = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        await delay(delayTime);
        continue;
      }
      throw error;
    }
  }
};

// Common retry mechanism for all platforms
const scrapeWithRetry = async (scrapeFunction, url, platform) => {
  let retries = 3;
  let lastError;

  while (retries > 0) {
    try {
      const result = await scrapeFunction(url);
      // If we got a result with data, return it immediately
      if (result && Object.keys(result).length > 0) {
        console.log(`${platform} scraping successful on attempt ${4 - retries}`);
        return result;
      }
      // If we got an empty result, throw error to trigger retry
      throw new Error(`No data found for ${platform}`);
    } catch (error) {
      lastError = error;
      retries--;
      if (retries > 0) {
        console.log(`${platform} scraping failed, retrying... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log(`${platform} scraping failed after all retries`);
      }
    }
  }
  // Return empty object if all retries failed
  return {};
};

const scrapeAmazon = async (url) => {
  const response = await makeRequestWithRetry(url, {
    headers: {
      ...commonHeaders,
      'Referer': 'https://www.amazon.in/',
      'Origin': 'https://www.amazon.in'
    }
  }, 2);

  if (response.status !== 200) {
    throw new Error(`Failed to fetch Amazon product: ${response.status}`);
  }

  const $ = cheerio.load(response.data);
  console.log('Amazon HTML length:', response.data.length);

  const details = new Map();

  // Helper function to normalize key
  const normalizeKey = (key) => {
    return key.toLowerCase().trim().replace(/\s+/g, ' ');
  };

  // Check selectors
  const hasColumnSelector = $('div.a-column.a-span12.a-span-last').length > 0;
  const hasGridSelector = $('div.a-section[role="list"] div.a-fixed-left-grid.product-facts-detail').length > 0;
  console.log('Amazon selectors found:', {
    columnSelector: hasColumnSelector,
    gridSelector: hasGridSelector
  });

  // Extract product details using the new selectors
  $('div.a-column.a-span12.a-span-last').each((_, element) => {
    const keys = $(element).find('th.a-color-secondary.a-size-base.prodDetSectionEntry').map((_, el) => $(el).text().trim()).get();
    const values = $(element).find('td.a-size-base.prodDetAttrValue').map((_, el) => $(el).text().trim()).get();

    // Create key-value pairs
    keys.forEach((key, index) => {
      const normalizedKey = normalizeKey(key);
      if (key && values[index] && !details.has(normalizedKey)) {
        details.set(normalizedKey, values[index]);
      }
    });
  });

  // Extract details from fixed-left-grid structure
  $('div.a-section[role="list"] div.a-fixed-left-grid.product-facts-detail').each((_, element) => {
    const key = $(element).find('div.a-fixed-left-grid-col.a-col-left span.a-color-base').text().trim();
    const value = $(element).find('div.a-fixed-left-grid-col.a-col-right span.a-color-base').text().trim();

    const normalizedKey = normalizeKey(key);
    if (key && value && !details.has(normalizedKey)) {
      details.set(normalizedKey, value);
    }
  });

  return Object.fromEntries(details);
};

const scrapeFlipkart = async (url) => {
  const response = await makeRequestWithRetry(url, {
    headers: {
      ...commonHeaders,
      'Referer': 'https://www.flipkart.com/',
      'Origin': 'https://www.flipkart.com'
    }
  }, 2);

  if (response.status !== 200) {
    throw new Error(`Failed to fetch Flipkart product: ${response.status}`);
  }

  const $ = cheerio.load(response.data);
  console.log('Flipkart HTML length:', response.data.length);

  const details = new Map();

  // Helper function to normalize key
  const normalizeKey = (key) => {
    return key.toLowerCase().trim().replace(/\s+/g, ' ');
  };

  // Check selectors
  const hasTableSelector = $('._1OjC5I .GNDEQ- table._0ZhAN9 tbody tr').length > 0;
  const hasRowSelector = $('div.sBVJqn div.row').length > 0;
  console.log('Flipkart selectors found:', {
    tableSelector: hasTableSelector,
    rowSelector: hasRowSelector
  });

  // Extract details from the specification tables
  $('._1OjC5I .GNDEQ- table._0ZhAN9 tbody tr').each((_, element) => {
    const key = $(element).find('td.+fFi1w').text().trim();
    const value = $(element).find('td.Izz52n li.HPETK2').text().trim();

    const normalizedKey = normalizeKey(key);
    if (key && value && !details.has(normalizedKey)) {
      details.set(normalizedKey, value);
    }
  });

  // Extract details from row structure
  $('div.sBVJqn div.row').each((_, element) => {
    const key = $(element).find('div.col.col-3-12._9NUIO9').text().trim();
    const value = $(element).find('div.col.col-9-12.-gXFvC').text().trim();

    const normalizedKey = normalizeKey(key);
    if (key && value && !details.has(normalizedKey)) {
      details.set(normalizedKey, value);
    }
  });

  return Object.fromEntries(details);
};

const scrapeMeesho = async (url) => {
  const response = await makeRequestWithRetry(url, {
    headers: {
      ...commonHeaders,
      'Referer': 'https://www.meesho.com/',
      'Origin': 'https://www.meesho.com'
    }
  }, 2);

  if (response.status !== 200) {
    throw new Error(`Failed to fetch Meesho product: ${response.status}`);
  }

  const $ = cheerio.load(response.data);
  console.log('Meesho HTML length:', response.data.length);

  const details = new Map();

  // Helper function to normalize key
  const normalizeKey = (key) => {
    return key.toLowerCase().trim().replace(/\s+/g, ' ');
  };

  // Check selectors
  //const hasProductDetailsSelector = $('p.sc-eDvSVe').length > 0;
  const hasSpecsSelector = $('div.sc-dkrFOg').length > 0;
  const hasNewSelector = $('div.sc-iBYQkv p.sc-eDvSVe').length > 0;
  console.log('Meesho selectors found:', {
    // productDetailsSelector: hasProductDetailsSelector,
    specsSelector: hasSpecsSelector,
    newSelector: hasNewSelector
  });

  // Get key-value pairs from specifications (old structure)
  $('div.sc-dkrFOg').each((_, element) => {
    const key = $(element).find('div.sc-eDvSVe').text().trim();
    const value = $(element).find('div.sc-eDvSVe').next().text().trim();

    const normalizedKey = normalizeKey(key);
    if (key && value && !details.has(normalizedKey)) {
      details.set(normalizedKey, value);
    }
  });

  // Extract details from new product description div
  $('div.sc-iBYQkv p.sc-eDvSVe').each((_, element) => {
    const text = $(element).text().trim();
    if (text.includes(':')) {
      // Split by first occurrence of ':' and handle the special case of sizes
      const [keyPart, ...valueParts] = text.split(':');
      const key = keyPart.trim();
      const value = valueParts.join(':').trim(); // Rejoin in case value contains ':'

      const normalizedKey = normalizeKey(key);
      if (key && value && !details.has(normalizedKey)) {
        details.set(normalizedKey, value);
      }
    }
  });

  return Object.fromEntries(details);
};

const scrapeMyntra = async (url) => {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    return {
      name: $('h1.pdp-title').text().trim(),
      price: parseFloat($('.pdp-price').text().replace(/[^0-9.]/g, '')),
      originalPrice: parseFloat($('.pdp-mrp').text().replace(/[^0-9.]/g, '')),
      discount: $('.pdp-discount').text().trim(),
      rating: $('.pdp-rating').text().trim(),
      reviewCount: $('.pdp-review-count').text().trim(),
      image: $('img.pdp-image').attr('src'),
      platform: 'Myntra'
    };
  } catch (error) {
    console.error('Error scraping Myntra:', error);
    throw error;
  }
};

const scrapeAjio = async (url) => {
  console.log('Starting Ajio scraping for URL:', url);
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
      ],
      executablePath: process.env.NODE_ENV === "production"
        ? (process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium')
        : process.platform === 'win32'
          ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
          : process.platform === 'darwin'
            ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            : '/usr/bin/google-chrome',
      ignoreHTTPSErrors: true,
      timeout: 45000
    };

    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Set random user agent
    const userAgent = randomUseragent.getRandom();
    if (userAgent) {
      await page.setUserAgent(userAgent);
    }

    await page.setViewport({ width: 1920, height: 1080 });

    // // Set extra headers
    // await page.setExtraHTTPHeaders({
    //   'Accept-Language': 'en-US,en;q=0.9',
    //   'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    //   'Accept-Encoding': 'gzip, deflate, br',
    //   'Connection': 'keep-alive',
    //   'Upgrade-Insecure-Requests': '1',
    //   'Sec-Fetch-Dest': 'document',
    //   'Sec-Fetch-Mode': 'navigate',
    //   'Sec-Fetch-Site': 'none',
    //   'Sec-Fetch-User': '?1',
    //   'Cache-Control': 'no-cache',
    //   'Pragma': 'no-cache'
    // });

    // // Enable request interception
    // await page.setRequestInterception(true);
    // page.on('request', (request) => {
    //   // Block unnecessary resources
    //   const resourceType = request.resourceType();
    //   if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
    //     request.abort();
    //   } else {
    //     request.continue();
    //   }
    // });

    console.log('Navigating to URL...');
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 45000
    });

    // Add a small delay to ensure dynamic content loads
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Scroll to load more content
    console.log('Scrolling to load content...');
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Get the HTML content
    const html = await page.content();
    console.log(`Loaded URL: ${url}\nPage length: ${html.length}`);

    // Check if page length is below threshold
    if (html.length < 5000) {
      console.log('Page content too small');
      return {};
    }

    const $ = cheerio.load(html);
    console.log('Page content loaded');

    // First find the product details section
    const productSection = $('section.prod-desc');
    if (!productSection.length) {
      console.log('Product details section not found');
      return {};
    }

    // Then find the list items within the section
    const listItems = productSection.find('li.detail-list');
    console.log('Found list items:', listItems.length);

    if (!listItems.length) {
      console.log('No list items found in product details section');
      return {};
    }

    const details = new Map();

    // Helper function to normalize key
    const normalizeKey = (key) => {
      return key.toLowerCase().trim().replace(/\s+/g, ' ');
    };

    // Extract details from the list items
    listItems.each((_, element) => {
      const text = $(element).text().trim();
      if (text) {
        const parts = text.split(':');
        if (parts.length > 1) {
          const key = normalizeKey(parts[0]);
          const value = parts.slice(1).join(':').trim();
          details.set(key, value);
        } else {
          const normalizedKey = normalizeKey(text);
          details.set(normalizedKey, text);
        }
      }
    });

    console.log('Extracted details:', Object.fromEntries(details));
    return Object.fromEntries(details);

  } catch (error) {
    console.error('Error in scrapeAjio:', error.message);
    return {};
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

export const compareProducts = async (req, res) => {
  try {
    const { products } = req.body;
    if (!products || products.length !== 2) {
      return res.status(400).json({ error: "Please provide exactly 2 products to compare" });
    }

    const results = {};
    const productDetails = [];

    // Get details for both products
    for (const product of products) {
      let details;
      try {
        switch (product.platform.toLowerCase()) {
          case 'amazon':
            details = await scrapeWithRetry(scrapeAmazon, product.link, 'Amazon');
            break;
          case 'flipkart':
            details = await scrapeWithRetry(scrapeFlipkart, product.link, 'Flipkart');
            break;
          case 'meesho':
            details = await scrapeWithRetry(scrapeMeesho, product.link, 'Meesho');
            break;
          case 'ajio':
            details = await scrapeWithRetry(scrapeAjio, product.link, 'Ajio');
            break;
          case 'myntra':
            details = await scrapeWithRetry(scrapeMyntra, product.link, 'Myntra');
            break;
          default:
            return res.status(400).json({ error: `Unsupported platform: ${product.platform}` });
        }
      } catch (error) {
        console.error(`Error scraping ${product.platform}:`, error);
        details = {}; // Empty object if scraping fails
      }
      productDetails.push(details || {}); // Ensure we always have an object
    }

    // Combine all unique keys from both products
    const allKeys = new Set([
      ...Object.keys(productDetails[0] || {}),
      ...Object.keys(productDetails[1] || {})
    ]);

    // Create the final structure with two values for each key
    allKeys.forEach(key => {
      // Normalize the key (remove extra spaces, convert to lowercase for comparison)
      const normalizedKey = key.toLowerCase().trim();

      // Check if this key already exists in results
      const existingKey = Object.keys(results).find(k => k.toLowerCase().trim() === normalizedKey);

      if (existingKey) {
        // If key exists, merge the values
        results[existingKey] = {
          1: productDetails[0]?.[existingKey] || productDetails[0]?.[key] || '-',
          2: productDetails[1]?.[existingKey] || productDetails[1]?.[key] || '-'
        };
      } else {
        // If key doesn't exist, add it
        results[key] = {
          1: productDetails[0]?.[key] || '-',
          2: productDetails[1]?.[key] || '-'
        };
      }
    });

    // Ensure all keys have both indices, even if empty
    Object.keys(results).forEach(key => {
      if (!results[key][1]) results[key][1] = '-';
      if (!results[key][2]) results[key][2] = '-';
    });

    res.json({ products: results });
  } catch (error) {
    console.error('Error comparing products:', error);
    res.status(500).json({ error: 'Failed to compare products' });
  }
}; 