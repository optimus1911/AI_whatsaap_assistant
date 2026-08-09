import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { 
  getDashboardStats, 
  getLeadDistribution, 
  getSentimentDistribution, 
  getIntentDistribution, 
  getMessagesPerDay, 
  getTopProducts, 
  getRecentInsights 
} from "../services/dashboardService";
import { getCustomers, getMessagesByCustomer } from "../services/chatService";

const CRMContext = createContext();

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error("useCRM must be used within a CRMProvider");
  }
  return context;
};

const DEFAULT_STATS = {
  totalCustomers: 0,
  totalMessages: 0,
  hotLeads: 0,
  warmLeads: 0,
  coldLeads: 0,
  averageLeadScore: 0,
  averagePurchaseProbability: 0,
  positiveSentiment: 0,
  neutralSentiment: 0,
  negativeSentiment: 0,
  topRecommendedProduct: "None",
  topIntent: "None",
  todayMessages: 0
};

export const CRMProvider = ({ children }) => {
  const [activeTab, setActiveTab] = useState("dashboard"); // "dashboard" | "chat"
  const [activeCustomerId, setActiveCustomerId] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [dashboardData, setDashboardData] = useState({
    stats: DEFAULT_STATS,
    leads: [],
    sentiments: [],
    intents: [],
    messagesPerDay: [],
    topProducts: [],
    recentInsights: []
  });
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isColdStarting, setIsColdStarting] = useState(false);
  const [error, setError] = useState(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState("");
  const [toasts, setToasts] = useState([]);
  const [activityEvents, setActivityEvents] = useState([]);

  const isFirstLoadRef = useRef(true);
  const prevCustomersRef = useRef([]);
  const isFetchingRef = useRef(false);

  // Cold start timer on initial load (shows friendly Render wakeup notice after 3s)
  useEffect(() => {
    let timer;
    if (loading && isFirstLoadRef.current) {
      timer = setTimeout(() => {
        setIsColdStarting(true);
      }, 3000);
    } else {
      setIsColdStarting(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  // Toast Helpers
  const addToast = useCallback((message, type = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto remove after 4.5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Event Helper
  const addActivityEvent = useCallback((description, customerName, type = "info") => {
    const newEvent = {
      id: Math.random().toString(36).substring(2, 9),
      description,
      customerName,
      type,
      timestamp: new Date()
    };
    setActivityEvents(prev => [newEvent, ...prev].slice(0, 50)); // Limit to last 50 events
  }, []);

  // Fetch all core CRM and Dashboard stats
  const fetchCRMData = useCallback(async (isSilent = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (!isSilent) {
      if (isFirstLoadRef.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
    }

    try {
      const [
        statsRes,
        leadsRes,
        sentimentsRes,
        intentsRes,
        messagesRes,
        productsRes,
        insightsRes,
        customersRes
      ] = await Promise.all([
        getDashboardStats().catch(() => ({ success: false, data: DEFAULT_STATS })),
        getLeadDistribution().catch(() => ({ success: false, data: [] })),
        getSentimentDistribution().catch(() => ({ success: false, data: [] })),
        getIntentDistribution().catch(() => ({ success: false, data: [] })),
        getMessagesPerDay().catch(() => ({ success: false, data: [] })),
        getTopProducts().catch(() => ({ success: false, data: [] })),
        getRecentInsights().catch(() => ({ success: false, data: [] })),
        getCustomers().catch(() => ({ success: false, data: [] }))
      ]);

      const now = new Date();
      setLastRefreshTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setError(null);
      setIsColdStarting(false);

      // Update dashboard values with robust fallbacks
      setDashboardData({
        stats: statsRes.success && statsRes.data ? { ...DEFAULT_STATS, ...statsRes.data } : DEFAULT_STATS,
        leads: leadsRes.success && Array.isArray(leadsRes.data) ? leadsRes.data : [],
        sentiments: sentimentsRes.success && Array.isArray(sentimentsRes.data) ? sentimentsRes.data : [],
        intents: intentsRes.success && Array.isArray(intentsRes.data) ? intentsRes.data : [],
        messagesPerDay: messagesRes.success && Array.isArray(messagesRes.data) ? messagesRes.data : [],
        topProducts: productsRes.success && Array.isArray(productsRes.data) ? productsRes.data : [],
        recentInsights: insightsRes.success && Array.isArray(insightsRes.data) ? insightsRes.data : []
      });

      // Update customers
      const newCustomers = customersRes.success && Array.isArray(customersRes.data) ? customersRes.data : [];
      setCustomers(newCustomers);

      // Seed activity timeline on first load
      if (isFirstLoadRef.current && newCustomers.length > 0) {
        const initialEvents = [];
        
        // Scan for Hot Leads and recommendations
        newCustomers.forEach(cust => {
          if (cust.leadStatus === "Hot") {
            initialEvents.push({
              id: `init-hot-${cust._id}`,
              description: `Hot Lead active: ${cust.name} (Score: ${cust.leadScore ?? 0})`,
              customerName: cust.name,
              type: "hot-lead",
              timestamp: new Date(cust.updatedAt || cust.createdAt || Date.now())
            });
          }
          if (cust.recommendedProduct) {
            initialEvents.push({
              id: `init-prod-${cust._id}`,
              description: `AI recommended: "${cust.recommendedProduct}"`,
              customerName: cust.name,
              type: "recommendation",
              timestamp: new Date(cust.updatedAt || cust.createdAt || Date.now())
            });
          }
          if (cust.lastMessage) {
            initialEvents.push({
              id: `init-msg-${cust._id}`,
              description: `WhatsApp: "${cust.lastMessage.substring(0, 38)}${cust.lastMessage.length > 38 ? "..." : ""}"`,
              customerName: cust.name,
              type: "message",
              timestamp: new Date(cust.updatedAt || cust.createdAt || Date.now())
            });
          }
        });

        // Sort newest first
        initialEvents.sort((a, b) => b.timestamp - a.timestamp);
        setActivityEvents(initialEvents.slice(0, 35));
        isFirstLoadRef.current = false;
        
        // Auto-select first customer for chat
        if (newCustomers.length > 0 && !activeCustomerId) {
          setActiveCustomerId(newCustomers[0]._id);
        }
      } else if (!isFirstLoadRef.current) {
        // Run comparison to trigger dynamic Toast alerts and activity feed entries
        const prevCustomers = prevCustomersRef.current;
        
        newCustomers.forEach(newCust => {
          const oldCust = prevCustomers.find(c => c._id === newCust._id);
          
          if (!oldCust) {
            // New customer added
            addToast(`👥 New Customer detected: ${newCust.name}`, "info");
            addActivityEvent(`New customer registered in CRM`, newCust.name, "new-user");
          } else {
            // Check for new message
            if (newCust.lastMessage !== oldCust.lastMessage && newCust.lastMessage) {
              if (newCust.online && !oldCust.online) {
                addToast(`💬 New WhatsApp message from ${newCust.name}`, "message");
              } else {
                addToast(`🤖 AI analysis completed for ${newCust.name}`, "score");
              }
              addActivityEvent(`WhatsApp: "${newCust.lastMessage.substring(0, 35)}${newCust.lastMessage.length > 35 ? '...' : ''}"`, newCust.name, "message");
            }

            // Check for leadScore increase
            if ((newCust.leadScore ?? 0) > (oldCust.leadScore ?? 0)) {
              addToast(`📈 Lead score for ${newCust.name} increased to ${newCust.leadScore}`, "score");
              addActivityEvent(`Lead score increased from ${oldCust.leadScore ?? 0} to ${newCust.leadScore}`, newCust.name, "score-up");
            }

            // Check for Hot Lead change
            if (newCust.leadStatus === "Hot" && oldCust.leadStatus !== "Hot") {
              addToast(`🔥 Hot Lead alert: ${newCust.name}!`, "hot");
              addActivityEvent(`Customer classified as a HOT LEAD 🔥`, newCust.name, "hot-lead");
            }

            // Check for sentiment change
            if (newCust.sentiment !== oldCust.sentiment && newCust.sentiment) {
              addToast(`😊 Sentiment for ${newCust.name} updated to ${newCust.sentiment}`, "sentiment");
              addActivityEvent(`Sentiment shifted to ${newCust.sentiment}`, newCust.name, "sentiment");
            }

            // Check for Priority change
            if (newCust.priority === "High" && oldCust.priority !== "High") {
              addToast(`⚠️ ${newCust.name} escalated to High Priority`, "priority");
              addActivityEvent(`Escalated to HIGH PRIORITY`, newCust.name, "priority");
            }
          }
        });
      }

      prevCustomersRef.current = newCustomers;
    } catch (err) {
      console.error("CRM Polling failed:", err);
      setError("Backend connection timed out or is waking up on Render.");
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast, addActivityEvent, activeCustomerId]);

  // Fetch messages for active customer
  const fetchActiveCustomerMessages = useCallback(async (customerId) => {
    if (!customerId) return;
    setMessagesLoading(true);
    try {
      const res = await getMessagesByCustomer(customerId);
      if (res.success && Array.isArray(res.data)) {
        setMessages(res.data);
      }
    } catch (err) {
      console.error("Failed to load customer messages:", err);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // Poll CRM state every 3 seconds
  useEffect(() => {
    fetchCRMData(false); // Initial load

    const interval = setInterval(() => {
      fetchCRMData(true); // Silent poll
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchCRMData]);

  // Poll active customer messages separately every 3 seconds
  useEffect(() => {
    if (!activeCustomerId) return;
    
    fetchActiveCustomerMessages(activeCustomerId);

    const interval = setInterval(() => {
      getMessagesByCustomer(activeCustomerId).then(res => {
        if (res.success && Array.isArray(res.data)) {
          setMessages(res.data);
        }
      }).catch(console.error);
    }, 3000);

    return () => clearInterval(interval);
  }, [activeCustomerId, fetchActiveCustomerMessages]);

  const activeCustomer = useMemo(() => {
    return customers.find(c => c._id === activeCustomerId) || null;
  }, [customers, activeCustomerId]);

  const value = useMemo(() => ({
    customers,
    activeCustomer,
    activeCustomerId,
    setActiveCustomerId,
    activeTab,
    setActiveTab,
    dashboardData,
    loading,
    refreshing,
    isColdStarting,
    error,
    messagesLoading,
    messages,
    lastRefreshTime,
    toasts,
    activityEvents,
    addToast,
    removeToast,
    refreshCRM: () => fetchCRMData(false),
    retryCRM: () => fetchCRMData(false),
    sendMessageToState: (msg) => setMessages(prev => [...prev, msg])
  }), [
    customers,
    activeCustomer,
    activeCustomerId,
    activeTab,
    dashboardData,
    loading,
    refreshing,
    isColdStarting,
    error,
    messagesLoading,
    messages,
    lastRefreshTime,
    toasts,
    activityEvents,
    addToast,
    removeToast,
    fetchCRMData
  ]);

  return <CRMContext.Provider value={value}>{children}</CRMContext.Provider>;
};
