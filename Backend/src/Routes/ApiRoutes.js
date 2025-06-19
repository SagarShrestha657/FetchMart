import express from 'express';
import { searchProducts } from '../Controllers/ScrapperController.js';
import { getAmazonSuggestions } from '../Controllers/SuggestionController.js';
import { getAiResponse } from '../Controllers/AiController.js';
import { compareProducts } from '../Controllers/compareController.js';

const router = express.Router();

router.post('/search', searchProducts);
router.get('/suggestions', getAmazonSuggestions);
router.post('/ai-response', getAiResponse);
router.use('/compare', compareProducts);

export default router; 