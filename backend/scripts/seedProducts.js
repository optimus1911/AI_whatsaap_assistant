import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import BusinessKnowledge from '../models/BusinessKnowledge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const productsPath = path.resolve(__dirname, '../data/products.json');
const knowledgePath = path.resolve(__dirname, '../data/businessKnowledge.json');

/**
 * Seeds products and business knowledge into MongoDB using upsert (stable IDs).
 * Safe to run multiple times without duplicating data.
 */
export const seedCatalogAndKnowledge = async () => {
  try {
    const productsRaw = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
    const knowledgeRaw = JSON.parse(fs.readFileSync(knowledgePath, 'utf-8'));

    console.log(`Starting seed: ${productsRaw.length} products, ${knowledgeRaw.length} knowledge items...`);

    let productsCount = 0;
    for (const item of productsRaw) {
      await Product.findOneAndUpdate(
        { id: item.id },
        { $set: item },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      productsCount++;
    }

    let knowledgeCount = 0;
    for (const item of knowledgeRaw) {
      await BusinessKnowledge.findOneAndUpdate(
        { id: item.id },
        { $set: item },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      knowledgeCount++;
    }

    console.log(`✅ Seed Complete: Upserted ${productsCount} products and ${knowledgeCount} business knowledge items.`);
    return { success: true, productsCount, knowledgeCount };
  } catch (error) {
    console.error('❌ Seeding Error:', error.message);
    throw error;
  }
};

// If run directly via CLI (e.g. `node backend/scripts/seedProducts.js`)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not defined in environment.');
    process.exit(1);
  }

  mongoose
    .connect(uri)
    .then(async () => {
      console.log('Connected to MongoDB for standalone seeding...');
      await seedCatalogAndKnowledge();
      await mongoose.disconnect();
      console.log('MongoDB disconnected.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('MongoDB connection failed during seed:', err);
      process.exit(1);
    });
}
