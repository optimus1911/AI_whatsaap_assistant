import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Generates an embedding vector for a given text using Gemini.
 * Returns null if embedding model is unavailable or rate-limited.
 *
 * @param {string} text
 * @returns {Promise<Array<number>|null>}
 */
export const generateEmbedding = async (text) => {
  if (!text || typeof text !== 'string' || !process.env.GEMINI_API_KEY) {
    return null;
  }

  try {
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text.trim().substring(0, 2000),
    });

    if (response && response.embedding && Array.isArray(response.embedding.values)) {
      return response.embedding.values;
    }
    return null;
  } catch (error) {
    // Non-blocking warning - structured search will continue as primary retrieval
    console.warn('[EmbeddingService] Embedding lookup skipped:', error.message);
    return null;
  }
};
