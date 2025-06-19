import axios from 'axios';

export const getAmazonSuggestions = async (req, res) => {
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
}; 