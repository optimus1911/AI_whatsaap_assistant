import {
  sendWhatsAppMessage,
  fetchWhatsAppUserProfilePicture,
} from "../services/whatsappService.js";
import { generateAiResponse as analyzeConversation } from "../services/geminiService.js";
import Customer from "../models/Customer.js";
import Message from "../models/Message.js";

// In-memory deduplication cache for webhook events (10 min TTL)
const processedMessageIds = new Map();
const DEDUP_TTL_MS = 10 * 60 * 1000;

const isDuplicateMessage = (msgId) => {
  if (!msgId || typeof msgId !== 'string') return false;
  const now = Date.now();
  if (processedMessageIds.has(msgId)) {
    const timestamp = processedMessageIds.get(msgId);
    if (now - timestamp < DEDUP_TTL_MS) {
      return true;
    }
  }
  processedMessageIds.set(msgId, now);

  // Clean old entries periodically
  if (processedMessageIds.size > 2000) {
    for (const [id, ts] of processedMessageIds.entries()) {
      if (now - ts > DEDUP_TTL_MS) processedMessageIds.delete(id);
    }
  }
  return false;
};

// Simple lead status calculator
const getLeadStatus = (score) => {
  if (score >= 80) return "Hot";
  if (score >= 50) return "Warm";
  return "Cold";
};

// Webhook Verification (GET /api/whatsapp/webhook)
export const verifyWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode && token) {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("WhatsApp Webhook Verified Successfully!");
      return res.status(200).send(challenge);
    } else {
      console.warn("WhatsApp Webhook Verification Failed: Token mismatch");
      return res.sendStatus(403);
    }
  }

  return res.sendStatus(400);
};

// Webhook Message Handling (POST /api/whatsapp/webhook)
export const handleWebhook = async (req, res) => {
  try {
    const body = req.body;

    if (!body.object) {
      return res.sendStatus(404);
    }

    // Acknowledge receipt to Meta immediately
    res.status(200).send("EVENT_RECEIVED");

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    // If no text message is present (e.g. status updates), exit
    if (!message || message.type !== "text") {
      return;
    }

    const messageId = message.id || '';
    if (messageId && isDuplicateMessage(messageId)) {
      console.log(`[FLOW-TRACE] duplicateWhatsAppEventIgnored messageId="${messageId}"`);
      return;
    }

    const from = message.from; // Customer's phone number
    const text = message.text?.body; // Customer's message text
    const contact = value?.contacts?.[0];
    const customerName = contact?.profile?.name || `Customer ${from.slice(-4)}`;

    console.log(`[FLOW-TRACE] incomingEventReceived messageId="${messageId}" from="${from.slice(-4)}" text="${text}"`);
    console.log(`Processing WhatsApp message from: ${customerName} (${from.slice(-4)})`);

    // Extract profile picture if available from webhook
    const profilePicFromWebhook = contact?.profile?.profile_picture || null;

    // 1. Find customer by phone or create new customer profile
    let customer = await Customer.findOne({ phone: from });

    if (!customer) {
      customer = await Customer.create({
        name: customerName,
        phone: from,
        online: true,
        lastSeen: "Just now",
        lastMessage: text,
        profilePicture: typeof profilePicFromWebhook === "string" ? profilePicFromWebhook.trim() : ""
      });
    } else {
      customer.online = true;
      customer.lastSeen = "Just now";
      customer.lastMessage = text;

      // Update name if Meta provided a contact profile name
      if (contact?.profile?.name && customer.name !== contact.profile.name) {
        customer.name = contact.profile.name;
      }

      // Only update profilePicture if a valid photo URL is provided (never overwrite with empty)
      if (
        profilePicFromWebhook &&
        typeof profilePicFromWebhook === "string" &&
        profilePicFromWebhook.trim().length > 0 &&
        customer.profilePicture !== profilePicFromWebhook.trim()
      ) {
        customer.profilePicture = profilePicFromWebhook.trim();
      }

      await customer.save();
    }

    // 2. Save incoming customer message to MongoDB
    const incomingCustomerMsg = await Message.create({
      customerId: customer._id,
      sender: "customer",
      message: text,
      status: "read",
      timestamp: new Date()
    });

    // 3. Retrieve customer-specific conversation history (excluding the message just saved)
    let conversationHistory = "";
    let lastAssistantMessage = "";
    let previousMessages = [];
    try {
      previousMessages = await Message.find({
        customerId: customer._id,
        _id: { $ne: incomingCustomerMsg._id }
      })
        .sort({ timestamp: -1, createdAt: -1 })
        .limit(25)
        .lean();

      // Find the most recent assistant message for context ("yes" affirmations / references)
      const lastAiMsg = previousMessages.find((m) => m.sender === "ai");
      if (lastAiMsg) {
        lastAssistantMessage = lastAiMsg.message;
      }

      // Reverse to get chronological order (oldest to newest)
      previousMessages.reverse();

      conversationHistory = previousMessages.length > 0
        ? previousMessages
            .map(
              (m) =>
                `${m.sender === "customer" ? "CUSTOMER" : "ASSISTANT"}: "${m.message}"`
            )
            .join("\n")
        : "No previous messages recorded for this customer.";
    } catch (historyErr) {
      console.warn("Could not retrieve conversation history:", historyErr.message);
    }

    console.log(`[CONV-TRACE] conversationHistoryLength=${previousMessages.length}`);
    console.log(`[PROD-TRACE] incomingWhatsAppMessage="${text}"`);

    // 4. Prepare profile context
    const customerContext = `Customer Name: ${customer.name}\nPhone: ${customer.phone}\nCurrent Status: ${customer.leadStatus || "Cold"}\nPrevious Summary: ${customer.summary || "None"}`;

    // 5. Query Gemini with Grounded RAG + conversation history + current message
    let aiAnalysis;
    try {
      aiAnalysis = await analyzeConversation(
        text,
        customerContext,
        conversationHistory,
        lastAssistantMessage
      );
    } catch (aiError) {
      console.error("AI Analysis Service failed:", aiError);
      aiAnalysis = {
        reply: "Here are our top available laptops:\n\n1. *HP Pavilion 15* — *₹65,999*\n   16GB RAM • 512GB SSD • Core i5\n\n2. *HP Victus 15* — *₹68,999*\n   16GB RAM • 512GB SSD • Ryzen 5\n\nWould you like me to compare the *HP Pavilion 15* and *HP Victus 15*?",
        leadScore: 50,
        leadStatus: "Warm",
        intent: "Product Inquiry",
        sentiment: "Neutral",
        priority: "Medium",
        summary: "Customer inquired about laptops on WhatsApp.",
        purchaseProbability: 50,
        recommendedProduct: "HP Pavilion 15",
        responseSource: "DETERMINISTIC_FALLBACK"
      };
    }

    const {
      reply,
      leadScore = 50,
      leadStatus = getLeadStatus(leadScore),
      intent = "Product Inquiry",
      sentiment = "Neutral",
      priority = "Medium",
      summary = "",
      purchaseProbability = 50,
      recommendedProduct = "",
      responseSource = "DETERMINISTIC_FALLBACK"
    } = aiAnalysis;

    console.log(`[RESP-TRACE] responseSource=${responseSource}`);
    console.log(`[PROD-TRACE] responseSource=${responseSource}`);
    console.log(`[PROD-TRACE] finalResponse="${reply}"`);

    // 6. Save AI response message in MongoDB
    if (reply && reply.trim()) {
      await Message.create({
        customerId: customer._id,
        sender: "ai",
        message: reply.trim(),
        status: "sent",
        timestamp: new Date()
      });

      // 7. Update customer CRM intelligence record in MongoDB
      customer.leadScore = leadScore;
      customer.leadStatus = leadStatus;
      customer.intent = intent;
      customer.sentiment = sentiment;
      customer.priority = priority;
      customer.summary = summary;
      customer.purchaseProbability = purchaseProbability;
      customer.recommendedProduct = recommendedProduct;
      customer.lastMessage = reply.trim();
      customer.online = true;
      customer.lastSeen = "Just now";
      await customer.save();

      console.log("=== AI Conversation Intelligence Saved ===");
      console.log(`Customer:             ${customer.name} (${from.slice(-4)})`);
      console.log(`Intent:               ${intent}`);
      console.log(`Sentiment:            ${sentiment}`);
      console.log(`Lead Score:           ${leadScore}/100`);
      console.log(`Lead Status:          ${leadStatus}`);
      console.log(`Priority:             ${priority}`);
      console.log(`Purchase Probability: ${purchaseProbability}%`);
      console.log(`Recommended Product:  ${recommendedProduct || "N/A"}`);
      console.log(`Response Source:      ${responseSource}`);

      // 8. Send WhatsApp Message to Customer via Meta Cloud API
      try {
        await sendWhatsAppMessage(from, reply.trim());
        console.log(`[FLOW-TRACE] messageDispatchedToCustomer phone="${from.slice(-4)}" responseSource=${responseSource}`);
      } catch (waError) {
        console.error("WhatsApp Message Dispatch Error:", waError.message);
      }
    }
  } catch (error) {
    console.error("WhatsApp Webhook Critical Handler Error:", error.message);
  }
};
