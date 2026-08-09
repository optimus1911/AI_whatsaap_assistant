import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Product from '../models/Product.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fallbackProductsPath = path.resolve(__dirname, '../data/products.json');

// In-memory fallback if database query is unavailable
let localProductsCache = null;
const getLocalProducts = () => {
  if (!localProductsCache) {
    try {
      localProductsCache = JSON.parse(fs.readFileSync(fallbackProductsPath, 'utf-8'));
    } catch {
      localProductsCache = [];
    }
  }
  return localProductsCache;
};

/**
 * Searches the laptop catalog using structured criteria and fuzzy keyword matching.
 * Implements a resilient relaxation ladder to guarantee explicit requirements (brand, budget)
 * are never starved by secondary or stale contextual constraints.
 *
 * @param {object} criteria Search filters
 * @param {string} [criteria.brand] "HP" | "Lenovo" | "Dell" | "ASUS" | "Acer" | "Apple"
 * @param {string} [criteria.model] "Pavilion" | "ThinkPad" | "Victus" | etc.
 * @param {string} [criteria.ram] "16GB" | "8GB" | "32GB"
 * @param {string} [criteria.storage] "512GB" | "1TB"
 * @param {number} [criteria.maxPrice] e.g. 70000
 * @param {number} [criteria.minPrice] e.g. 40000
 * @param {string} [criteria.useCase] "coding" | "gaming" | "student" | "business" | "AI"
 * @param {string} [criteria.keyword] generic text query (MUST NOT be full conversational sentence)
 * @param {boolean} [criteria.inStockOnly=true] whether to restrict to available inventory
 * @param {number} [criteria.limit=5] max items to return
 * @returns {Promise<Array<object>>} Ranked list of matching products
 */
export const searchProducts = async ({
  brand = null,
  model = null,
  ram = null,
  storage = null,
  maxPrice = null,
  minPrice = null,
  useCase = null,
  keyword = null,
  inStockOnly = true,
  limit = 5
} = {}) => {
  const isMongoConnected = mongoose.connection.readyState === 1;

  console.log(`[PROD-TRACE] normalizedQuery=${JSON.stringify({ brand, model, ram, storage, maxPrice, minPrice, useCase, keyword, inStockOnly })}`);
  console.log(`[ProductRAG] MongoDB connected = ${isMongoConnected} | Collection = products`);

  try {
    let products = null;

    // Helper to build Mongo query filter
    const buildMongoFilter = (applyUseCase = true, applyRam = true) => {
      const q = {};
      if (inStockOnly) q.availability = 'in_stock';
      if (brand && typeof brand === 'string' && brand.trim()) {
        q.brand = new RegExp(`^${brand.trim()}$`, 'i');
      }
      if (model && typeof model === 'string' && model.trim()) {
        q.model = new RegExp(model.trim(), 'i');
      }
      if (applyRam && ram && typeof ram === 'string' && ram.trim()) {
        const cleanRam = ram.replace(/\s+/g, '').toUpperCase();
        q.ram = new RegExp(cleanRam, 'i');
      }
      if (storage && typeof storage === 'string' && storage.trim()) {
        const cleanStorage = storage.replace(/\s+/g, '').toUpperCase();
        q.storage = new RegExp(cleanStorage, 'i');
      }
      if (typeof maxPrice === 'number' && maxPrice > 0) {
        q.price = q.price || {};
        q.price.$lte = maxPrice;
      }
      if (typeof minPrice === 'number' && minPrice > 0) {
        q.price = q.price || {};
        q.price.$gte = minPrice;
      }
      if (applyUseCase && useCase && typeof useCase === 'string' && useCase.trim()) {
        q.useCases = { $in: [new RegExp(useCase.trim(), 'i')] };
      }
      if (keyword && typeof keyword === 'string' && keyword.trim()) {
        const cleanKey = keyword.trim();
        q.$or = [
          { brand: new RegExp(cleanKey, 'i') },
          { model: new RegExp(cleanKey, 'i') },
          { description: new RegExp(cleanKey, 'i') },
          { keywords: new RegExp(cleanKey, 'i') },
          { processor: new RegExp(cleanKey, 'i') }
        ];
      }
      return q;
    };

    // 1. Query MongoDB if connected
    if (isMongoConnected) {
      const primaryQuery = buildMongoFilter(true, true);
      console.log(`[PROD-TRACE] mongoFilter=${JSON.stringify(primaryQuery)}`);
      products = await Product.find(primaryQuery).limit(limit * 2).lean();
      console.log(`[PROD-TRACE] mongoResultCount=${products ? products.length : 0}`);

      // Relaxation Step 1: Relax useCase if 0 results
      if ((!products || products.length === 0) && useCase && (brand || maxPrice)) {
        console.log('[ProductRAG] 0 products found with strict useCase. Relaxing useCase filter...');
        const relaxedQuery1 = buildMongoFilter(false, true);
        console.log(`[PROD-TRACE] mongoFilterRelaxed1=${JSON.stringify(relaxedQuery1)}`);
        products = await Product.find(relaxedQuery1).limit(limit * 2).lean();
        console.log(`[PROD-TRACE] mongoResultCount=${products ? products.length : 0}`);
      }

      // Relaxation Step 2: Relax ram if 0 results
      if ((!products || products.length === 0) && ram && (brand || maxPrice)) {
        console.log('[ProductRAG] 0 products found with strict RAM. Relaxing RAM filter...');
        const relaxedQuery2 = buildMongoFilter(false, false);
        console.log(`[PROD-TRACE] mongoFilterRelaxed2=${JSON.stringify(relaxedQuery2)}`);
        products = await Product.find(relaxedQuery2).limit(limit * 2).lean();
        console.log(`[PROD-TRACE] mongoResultCount=${products ? products.length : 0}`);
      }
    }

    // 2. Fast in-memory evaluation if DB not connected or no DB results
    let fallbackCount = 0;
    if (!products || products.length === 0) {
      const local = getLocalProducts();
      
      const filterLocal = (applyUseCase = true, applyRam = true) => {
        return local.filter((p) => {
          if (inStockOnly && p.availability !== 'in_stock') return false;
          if (brand && !new RegExp(`^${brand.trim()}$`, 'i').test(p.brand)) return false;
          if (model && !new RegExp(model.trim(), 'i').test(p.model)) return false;
          if (applyRam && ram && !new RegExp(ram.replace(/\s+/g, ''), 'i').test(p.ram)) return false;
          if (storage && !new RegExp(storage.replace(/\s+/g, ''), 'i').test(p.storage)) return false;
          if (typeof maxPrice === 'number' && maxPrice > 0 && p.price > maxPrice) return false;
          if (typeof minPrice === 'number' && minPrice > 0 && p.price < minPrice) return false;
          if (applyUseCase && useCase && !p.useCases?.some((u) => new RegExp(useCase.trim(), 'i').test(u))) return false;
          if (keyword) {
            const kRegex = new RegExp(keyword.trim(), 'i');
            const matches =
              kRegex.test(p.brand) ||
              kRegex.test(p.model) ||
              kRegex.test(p.description) ||
              p.keywords?.some((k) => kRegex.test(k)) ||
              kRegex.test(p.processor);
            if (!matches) return false;
          }
          return true;
        });
      };

      products = filterLocal(true, true);

      // Local Relaxation Step 1: Relax useCase
      if ((!products || products.length === 0) && useCase && (brand || maxPrice)) {
        products = filterLocal(false, true);
      }

      // Local Relaxation Step 2: Relax RAM
      if ((!products || products.length === 0) && ram && (brand || maxPrice)) {
        products = filterLocal(false, false);
      }

      fallbackCount = products ? products.length : 0;
      console.log(`[PROD-TRACE] fallbackResultCount=${fallbackCount}`);
    }

    // Rank results: exact brand match > RAM match > use case match > in stock > price appropriateness
    products.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      if (brand) {
        if (new RegExp(`^${brand}$`, 'i').test(a.brand)) scoreA += 5;
        if (new RegExp(`^${brand}$`, 'i').test(b.brand)) scoreB += 5;
      }

      if (ram) {
        if (new RegExp(ram.replace(/\s+/g, ''), 'i').test(a.ram)) scoreA += 4;
        if (new RegExp(ram.replace(/\s+/g, ''), 'i').test(b.ram)) scoreB += 4;
      }

      if (useCase) {
        if (a.useCases?.some((u) => new RegExp(useCase, 'i').test(u))) scoreA += 3;
        if (b.useCases?.some((u) => new RegExp(useCase, 'i').test(u))) scoreB += 3;
      }

      if (a.availability === 'in_stock') scoreA += 2;
      if (b.availability === 'in_stock') scoreB += 2;

      return scoreB - scoreA;
    });

    const candidates = products.slice(0, limit);
    console.log(`[PROD-TRACE] finalProductCount=${candidates.length}`);
    if (candidates.length > 0) {
      console.log('[ProductRAG] Top products =', candidates.slice(0, 3).map((p, i) => `${i + 1}. ${p.brand} ${p.model} ₹${p.price.toLocaleString('en-IN')}`).join(', '));
    }

    return candidates;
  } catch (error) {
    console.error('Product Search Error:', error.message);
    return getLocalProducts().slice(0, limit);
  }
};

/**
 * Retrieves products by IDs or models (e.g. for comparison queries or active follow-ups).
 */
export const getProductsByIdsOrModels = async (identifiers = []) => {
  if (!Array.isArray(identifiers) || identifiers.length === 0) return [];
  try {
    let products = null;

    if (mongoose.connection.readyState === 1) {
      const cleanList = identifiers.map((id) => id.trim());
      const regexList = cleanList.map((id) => new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
      products = await Product.find({
        $or: [
          { id: { $in: cleanList } },
          { model: { $in: regexList } }
        ]
      }).lean();
    }

    if (!products || products.length === 0) {
      const local = getLocalProducts();
      products = local.filter((p) => {
        const fullModelName = `${p.brand} ${p.model}`.toLowerCase();
        const modelOnly = p.model.toLowerCase();
        return identifiers.some((name) => {
          const lowerName = name.toLowerCase().trim();
          return (
            p.id.toLowerCase() === lowerName ||
            fullModelName === lowerName ||
            modelOnly === lowerName ||
            fullModelName.includes(lowerName) ||
            lowerName.includes(fullModelName) ||
            (lowerName.includes(modelOnly) && modelOnly.length >= 4)
          );
        });
      });
    }

    // Deduplicate and preserve order
    const unique = [];
    const seen = new Set();
    for (const p of products) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        unique.push(p);
      }
    }
    return unique;
  } catch (e) {
    console.error('getProductsByIdsOrModels error:', e.message);
    return [];
  }
};
