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
  const hasGridSelector = $('div.a-section[role="list"] div.a-fixed-left-grid.product-facts-detail').length > 0;
  const hasColumnSelector = $('div.a-column.a-span12.a-span-last').length > 0;
  console.log('Amazon selectors found:', {
    columnSelector: hasColumnSelector,
    gridSelector: hasGridSelector
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

  console.log('Amazon Details Length:', Object.keys(Object.fromEntries(details)).length);
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
  const hasRowSelector = $('div.sBVJqn._8vsVX1 div.row').length > 0;
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
  $('div.sBVJqn._8vsVX1 div.row').each((_, element) => {
    const key = $(element).find('div.col.col-3-12._9NUIO9').text().trim();
    const value = $(element).find('div.col.col-9-12.-gXFvC').text().trim();

    const normalizedKey = normalizeKey(key);
    if (key && value && !details.has(normalizedKey)) {
      details.set(normalizedKey, value);
    }
  });

  console.log('Flipkart Details Length:', Object.keys(Object.fromEntries(details)).length);
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

  console.log('Meesho Details Length:', Object.keys(Object.fromEntries(details)).length);
  return Object.fromEntries(details);
};

const scrapeMyntra = async (url) => {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const result = {
      name: $('h1.pdp-title').text().trim(),
      price: parseFloat($('.pdp-price').text().replace(/[^0-9.]/g, '')),
      originalPrice: parseFloat($('.pdp-mrp').text().replace(/[^0-9.]/g, '')),
      discount: $('.pdp-discount').text().trim(),
      rating: $('.pdp-rating').text().trim(),
      reviewCount: $('.pdp-review-count').text().trim(),
      image: $('img.pdp-image').attr('src'),
      platform: 'Myntra'
    };
    console.log('Myntra Details Length:', Object.keys(result).length);
    return result;
  } catch (error) {
    console.error('Error scraping Myntra:', error);
    throw error;
  }
};

const scrapeAjio = async (url) => {
  const userAgent = randomUseragent.getRandom();
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
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
    });

    const page = await browser.newPage();

    if (userAgent) {
      await page.setUserAgent(userAgent);
    }

    await page.setViewport({ width: 1920, height: 1080 });

    // Set longer timeout for page load
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 45000
    });

    // First scroll
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Second scroll
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    const html = await page.content();
    console.log('Ajio Response Length:', html.length);

    // Check if page length is below threshold
    if (html.length < 5000) {
      return null;
    }

    // Wait for the product details to load
    const found = await page.waitForSelector('ul.prod-list li.detail-list, div.prod-list li.detail-list', { timeout: 10000 })
      .catch(() => {
        console.log('Product details selector not found')
        return []
      }
      );

    if (!found) {
      console.log('Ajio: Product cards selector not found!');
      return [];
    }

    // Get the page content
    const content = await page.content();
    const $ = cheerio.load(content);

    // Check if the selector is present
    const hasSelector = $('ul.prod-list li.detail-list, div.prod-list li.detail-list').length > 0;
    console.log('Ajio selector found:', hasSelector);

    const details = new Map();

    // Helper function to normalize key
    const normalizeKey = (key) => {
      return key.toLowerCase().trim().replace(/\s+/g, ' ');
    };

    // Extract details from the product list
    $('ul.prod-list li.detail-list, div.prod-list li.detail-list').each((_, element) => {
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

    console.log('Ajio Details Length:', Object.keys(Object.fromEntries(details)).length);
    return Object.fromEntries(details);

  } catch (error) {
    console.error('Error in scrapeAjio:', {
      message: error.message,
      url: url
    });
    throw error;
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

    // Create an array of promises for parallel execution
    const scrapePromises = products.map(async (product) => {
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
            throw new Error(`Unsupported platform: ${product.platform}`);
        }
      } catch (error) {
        console.error(`Error scraping ${product.platform}:`, error);
        details = {}; // Empty object if scraping fails
      }
      return details || {}; // Ensure we always have an object
    });

    // Wait for all scraping to complete in parallel
    const productDetails = await Promise.all(scrapePromises);

    // If both product details are empty, return 404
    if (
      (!productDetails[0] || Object.keys(productDetails[0]).length === 0) &&
      (!productDetails[1] || Object.keys(productDetails[1]).length === 0)
    ) {
      return res.status(404).json({ error: 'Please try again later.' });
    }

    // Combine all unique keys from both products
    const allKeys = new Set([
      ...Object.keys(productDetails[0] || {}),
      ...Object.keys(productDetails[1] || {})
    ]);

    // Create the final structure with two values for each key
    const results = {};
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