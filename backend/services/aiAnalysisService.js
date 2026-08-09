import { generateAiResponse } from './geminiService.js';

/**
 * Analyzes the customer conversation and returns AI predictions with Grounded RAG.
 * Calls Gemini directly to retrieve structured intelligence.
 *
 * @param {string} prompt The latest customer message text.
 * @param {string} [customerContext=""] Historical or profile context of the customer.
 * @param {string} [conversationHistory=""] Recent chat history between customer and assistant.
 * @param {string} [lastAssistantMessage=""] Immediately preceding assistant response.
 * @returns {Promise<{
 *   reply: string,
 *   leadScore: number,
 *   leadStatus: string,
 *   intent: string,
 *   sentiment: string,
 *   priority: string,
 *   summary: string,
 *   purchaseProbability: number,
 *   recommendedProduct: string
 * }>} Consolidated analysis and grounded customer reply.
 */
export const analyzeConversation = async (
  prompt, 
  customerContext = '', 
  conversationHistory = '',
  lastAssistantMessage = ''
) => {
  return await generateAiResponse(prompt, customerContext, conversationHistory, lastAssistantMessage);
};
