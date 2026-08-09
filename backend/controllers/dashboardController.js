import Customer from "../models/Customer.js";
import Message from "../models/Message.js";

// @desc    Get dashboard KPIs and general statistics
// @route   GET /api/dashboard/stats
// @access  Public
export const getDashboardStats = async (req, res, next) => {
  try {
    const totalCustomers = await Customer.countDocuments();
    const totalMessages = await Message.countDocuments();

    // Group customer counts by leadStatus
    const leadCounts = await Customer.aggregate([
      {
        $group: {
          _id: "$leadStatus",
          count: { $sum: 1 }
        }
      }
    ]);

    const leadStats = { Hot: 0, Warm: 0, Cold: 0 };
    leadCounts.forEach(c => {
      if (c._id && leadStats[c._id] !== undefined) {
        leadStats[c._id] = c.count;
      }
    });

    // Calculate averages
    const averageStats = await Customer.aggregate([
      {
        $group: {
          _id: null,
          avgLeadScore: { $avg: "$leadScore" },
          avgPurchaseProbability: { $avg: "$purchaseProbability" }
        }
      }
    ]);

    const avgLeadScore = averageStats[0]?.avgLeadScore || 0;
    const avgPurchaseProbability = averageStats[0]?.avgPurchaseProbability || 0;

    // Group customer counts by sentiment
    const sentimentCounts = await Customer.aggregate([
      {
        $group: {
          _id: { $toLower: "$sentiment" },
          count: { $sum: 1 }
        }
      }
    ]);

    const sentimentStats = { positive: 0, neutral: 0, negative: 0 };
    sentimentCounts.forEach(c => {
      if (c._id && sentimentStats[c._id] !== undefined) {
        sentimentStats[c._id] = c.count;
      }
    });

    // Find top recommended product
    const topProductAgg = await Customer.aggregate([
      { $match: { recommendedProduct: { $ne: "" } } },
      { $group: { _id: "$recommendedProduct", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    const topRecommendedProduct = topProductAgg[0]?._id || "None";

    // Find top intent
    const topIntentAgg = await Customer.aggregate([
      { $match: { intent: { $ne: "" } } },
      { $group: { _id: "$intent", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    const topIntent = topIntentAgg[0]?._id || "None";

    // Messages sent today (since midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMessages = await Message.countDocuments({
      createdAt: { $gte: today }
    });

    res.status(200).json({
      success: true,
      data: {
        totalCustomers,
        totalMessages,
        hotLeads: leadStats.Hot,
        warmLeads: leadStats.Warm,
        coldLeads: leadStats.Cold,
        averageLeadScore: Math.round(avgLeadScore * 10) / 10,
        averagePurchaseProbability: Math.round(avgPurchaseProbability * 10) / 10,
        positiveSentiment: sentimentStats.positive,
        neutralSentiment: sentimentStats.neutral,
        negativeSentiment: sentimentStats.negative,
        topRecommendedProduct,
        topIntent,
        todayMessages
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get lead status distribution for charts
// @route   GET /api/dashboard/lead-distribution
// @access  Public
export const getLeadDistribution = async (req, res, next) => {
  try {
    const counts = await Customer.aggregate([
      { $group: { _id: "$leadStatus", value: { $sum: 1 } } },
      { $project: { _id: 0, name: "$_id", value: 1 } }
    ]);

    const statuses = ["Hot", "Warm", "Cold"];
    const result = statuses.map(s => {
      const found = counts.find(c => c.name === s);
      return { name: s, value: found ? found.value : 0 };
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get customer sentiment distribution for charts
// @route   GET /api/dashboard/sentiment-distribution
// @access  Public
export const getSentimentDistribution = async (req, res, next) => {
  try {
    const counts = await Customer.aggregate([
      { $group: { _id: "$sentiment", value: { $sum: 1 } } },
      { $project: { _id: 0, name: "$_id", value: 1 } }
    ]);

    const sentiments = ["Positive", "Neutral", "Negative"];
    const result = sentiments.map(s => {
      const found = counts.find(c => c.name && c.name.toLowerCase() === s.toLowerCase());
      return { name: s, value: found ? found.value : 0 };
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get customer intent distribution for charts
// @route   GET /api/dashboard/intent-distribution
// @access  Public
export const getIntentDistribution = async (req, res, next) => {
  try {
    const counts = await Customer.aggregate([
      { $match: { intent: { $ne: "" } } },
      { $group: { _id: "$intent", value: { $sum: 1 } } },
      { $sort: { value: -1 } },
      { $project: { _id: 0, name: "$_id", value: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: counts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get weekly message counts per day for line chart
// @route   GET /api/dashboard/messages-per-day
// @access  Public
export const getMessagesPerDay = async (req, res, next) => {
  try {
    const daysLimit = 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysLimit);
    startDate.setHours(0, 0, 0, 0);

    const counts = await Message.aggregate([
      { $match: { timestamp: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          messages: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const formattedResult = counts.map(c => {
      const dateObj = new Date(c._id);
      const dateStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return {
        date: dateStr,
        messages: c.messages
      };
    });

    res.status(200).json({
      success: true,
      data: formattedResult
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get top recommended products using aggregation
// @route   GET /api/dashboard/top-products
// @access  Public
export const getTopProducts = async (req, res, next) => {
  try {
    const products = await Customer.aggregate([
      { $match: { recommendedProduct: { $ne: "" } } },
      { $group: { _id: "$recommendedProduct", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, name: "$_id", count: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recent customer insights sorted by updatedAt DESC
// @route   GET /api/dashboard/recent-insights
// @access  Public
export const getRecentInsights = async (req, res, next) => {
  try {
    const recentCustomers = await Customer.find({})
      .select('name phone leadStatus leadScore intent sentiment priority purchaseProbability recommendedProduct updatedAt')
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    res.status(200).json({
      success: true,
      data: recentCustomers
    });
  } catch (error) {
    next(error);
  }
};
