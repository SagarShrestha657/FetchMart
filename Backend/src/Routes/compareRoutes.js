import express from 'express';
import { compareProducts } from '../Controllers/compareController.js';

const router = express.Router();

router.post('/compare', compareProducts);

export default router; 