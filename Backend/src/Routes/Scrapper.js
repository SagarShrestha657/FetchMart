import express from 'express';
const router = express.Router();
import { scrapper } from '../Controllers/Scrapper';


router.post('/search', scrapper);

export default router;
