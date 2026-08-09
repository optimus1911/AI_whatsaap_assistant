import express from 'express';
import BusinessKnowledge from '../models/BusinessKnowledge.js';
import { searchBusinessKnowledge } from '../services/businessKnowledgeService.js';

const router = express.Router();

// @desc    Get/Search business knowledge items
// @route   GET /api/knowledge
router.get('/', async (req, res, next) => {
  try {
    const { category, q } = req.query;
    if (category || q) {
      const items = await searchBusinessKnowledge({ category, query: q, limit: 10 });
      return res.status(200).json({ success: true, count: items.length, data: items });
    }
    const all = await BusinessKnowledge.find({});
    res.status(200).json({ success: true, count: all.length, data: all });
  } catch (error) {
    next(error);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const { category, q } = req.query;
    const items = await searchBusinessKnowledge({ category, query: q, limit: 10 });
    res.status(200).json({ success: true, count: items.length, data: items });
  } catch (error) {
    next(error);
  }
});

export default router;
