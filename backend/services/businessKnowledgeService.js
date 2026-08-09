import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import BusinessKnowledge from '../models/BusinessKnowledge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fallbackKnowledgePath = path.resolve(__dirname, '../data/businessKnowledge.json');

let localKnowledgeCache = null;
const getLocalKnowledge = () => {
  if (!localKnowledgeCache) {
    try {
      localKnowledgeCache = JSON.parse(fs.readFileSync(fallbackKnowledgePath, 'utf-8'));
    } catch {
      localKnowledgeCache = [];
    }
  }
  return localKnowledgeCache;
};

/**
 * Searches the business knowledge base by category or query keywords with relevance ranking.
 *
 * @param {object} params
 * @param {string} [params.category] "returns" | "refunds" | "warranty" | "shipping" | "payment" | "billing" | "discounts" | "cancellation"
 * @param {string} [params.query] text search query
 * @param {number} [params.limit=3]
 * @returns {Promise<Array<object>>} Matching business policies
 */
export const searchBusinessKnowledge = async ({ category = null, query = null, limit = 3 } = {}) => {
  try {
    let items = null;

    if (mongoose.connection.readyState === 1) {
      if (category && typeof category === 'string' && category.trim()) {
        items = await BusinessKnowledge.find({
          category: new RegExp(`^${category.trim()}$`, 'i')
        }).lean();
      }

      if ((!items || items.length === 0) && query && typeof query === 'string' && query.trim()) {
        const words = query
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((w) => w.length >= 3 && !/^(what|how|can|does|show|tell|your|the|is|our|with)$/i.test(w));

        if (words.length > 0) {
          const regexConditions = words.map((word) => ({
            $or: [
              { title: new RegExp(word, 'i') },
              { content: new RegExp(word, 'i') },
              { keywords: new RegExp(word, 'i') },
              { category: new RegExp(word, 'i') }
            ]
          }));

          items = await BusinessKnowledge.find({ $or: regexConditions }).lean();
        }
      }
    }

    // Fast fallback to local data if MongoDB collection has no results or not connected
    if (!items || items.length === 0) {
      const local = getLocalKnowledge();
      items = local.filter((item) => {
        if (category && new RegExp(category.trim(), 'i').test(item.category)) return true;
        if (query) {
          const lowerQ = query.toLowerCase();
          if (
            lowerQ.includes(item.category.toLowerCase()) ||
            item.keywords?.some((k) => lowerQ.includes(k.toLowerCase())) ||
            lowerQ.includes(item.title.toLowerCase())
          ) {
            return true;
          }
        }
        return false;
      });
    }

    // Sort by query relevance (exact keyword matches in title or keywords array)
    if (query && items.length > 1) {
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter((w) => w.length >= 3);

      items.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;

        for (const w of queryWords) {
          if (a.title.toLowerCase().includes(w)) scoreA += 5;
          if (b.title.toLowerCase().includes(w)) scoreB += 5;

          if (a.keywords?.some((k) => k.toLowerCase().includes(w))) scoreA += 4;
          if (b.keywords?.some((k) => k.toLowerCase().includes(w))) scoreB += 4;

          if (a.content.toLowerCase().includes(w)) scoreA += 2;
          if (b.content.toLowerCase().includes(w)) scoreB += 2;
        }

        return scoreB - scoreA;
      });
    }

    return items.slice(0, limit);
  } catch (error) {
    console.error('Business Knowledge Search Error:', error.message);
    return getLocalKnowledge().slice(0, limit);
  }
};
