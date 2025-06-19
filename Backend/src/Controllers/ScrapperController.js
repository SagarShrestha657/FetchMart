import { scrapeFlipkart, scrapeAmazon, scrapeMeesho, scrapeMyntra, scrapeAjio } from '../Libs/Scrapper.js';

let currentRequest = { controller: null, cleanup: null };

async function abortCurrentRequest() {
    if (currentRequest.controller) {
        currentRequest.controller.abort();
        if (currentRequest.cleanup) await currentRequest.cleanup();
    }
}

export const searchProducts = async (req, res) => {
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
                return [];
            }
        }
    };

    try {
        const promises = selected.map(platform =>
            platformFns[platform]?.().catch(err => {
                if (abortController.signal.aborted) return [];
                cardCounts[platform.charAt(0).toUpperCase() + platform.slice(1)] = 0;
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
        res.status(500).json({ message: "Internal Server Error" });
    } finally {
        await cleanup();
    }
}; 