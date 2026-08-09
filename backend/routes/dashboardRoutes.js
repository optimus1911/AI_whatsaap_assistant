import express from "express";
import {
  getDashboardStats,
  getLeadDistribution,
  getSentimentDistribution,
  getIntentDistribution,
  getMessagesPerDay,
  getTopProducts,
  getRecentInsights
} from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/stats", getDashboardStats);
router.get("/lead-distribution", getLeadDistribution);
router.get("/sentiment-distribution", getSentimentDistribution);
router.get("/intent-distribution", getIntentDistribution);
router.get("/messages-per-day", getMessagesPerDay);
router.get("/top-products", getTopProducts);
router.get("/recent-insights", getRecentInsights);

export default router;
