import express from 'express';
const router = express.Router();

// GET route
router.get('/', (req, res) => {
    res.json({ message: 'Scraper route is working' });
});

// POST route
router.post('/', (req, res) => {
    res.json({ message: 'POST request received' });
});

export default router;
