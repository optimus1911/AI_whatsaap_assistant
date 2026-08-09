import api from "./api";

/**
 * Fetch general dashboard statistics and KPIs.
 * @returns {Promise<object>} REST API response
 */
export const getDashboardStats = async () => {
  const response = await api.get("/dashboard/stats");
  return response.data;
};

/**
 * Fetch lead status category distribution for charts.
 * @returns {Promise<object>} REST API response
 */
export const getLeadDistribution = async () => {
  const response = await api.get("/dashboard/lead-distribution");
  return response.data;
};

/**
 * Fetch customer sentiment category distribution for charts.
 * @returns {Promise<object>} REST API response
 */
export const getSentimentDistribution = async () => {
  const response = await api.get("/dashboard/sentiment-distribution");
  return response.data;
};

/**
 * Fetch customer intent category distribution for charts.
 * @returns {Promise<object>} REST API response
 */
export const getIntentDistribution = async () => {
  const response = await api.get("/dashboard/intent-distribution");
  return response.data;
};

/**
 * Fetch weekly message volumes per day for line charts.
 * @returns {Promise<object>} REST API response
 */
export const getMessagesPerDay = async () => {
  const response = await api.get("/dashboard/messages-per-day");
  return response.data;
};

/**
 * Fetch top recommended products using aggregation.
 * @returns {Promise<object>} REST API response
 */
export const getTopProducts = async () => {
  const response = await api.get("/dashboard/top-products");
  return response.data;
};

/**
 * Fetch recent customer AI insights.
 * @returns {Promise<object>} REST API response
 */
export const getRecentInsights = async () => {
  const response = await api.get("/dashboard/recent-insights");
  return response.data;
};
