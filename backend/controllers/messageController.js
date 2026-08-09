import Message from '../models/Message.js';
import Customer from '../models/Customer.js';
import { analyzeConversation } from '../services/aiAnalysisService.js';

// @desc    Get messages for a specific customer
// @route   GET /api/messages/:customerId
// @access  Public
export const getMessagesByCustomer = async (req, res, next) => {
  try {
    const { customerId } = req.params;

    // Check if customer exists
    const customerExists = await Customer.findById(customerId);
    if (!customerExists) {
      res.status(404);
      throw new Error(`Customer not found with ID ${customerId}`);
    }

    const messages = await Message.find({ customerId }).sort({ timestamp: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send/Post a new message
// @route   POST /api/messages
// @access  Public
export const createMessage = async (req, res, next) => {
  try {
    const { customerId, sender, message } = req.body;

    if (!customerId || !sender || !message) {
      res.status(400);
      throw new Error('Please provide customerId, sender, and message text');
    }

    // Check if customer exists
    const customer = await Customer.findById(customerId);
    if (!customer) {
      res.status(404);
      throw new Error(`Customer not found with ID ${customerId}`);
    }

    // 1. Create the customer message
    const newMessage = await Message.create({
      customerId,
      sender,
      message: message.trim(),
      status: sender === 'customer' ? 'read' : 'sent',
      timestamp: new Date()
    });

    // Update customer last message
    customer.lastMessage = message.trim();
    await customer.save();

    // 2. If message is from customer, trigger AI analysis with persistent conversation history + RAG
    if (sender === 'customer') {
      try {
        // Retrieve previous messages for this specific customer
        const previousMessages = await Message.find({
          customerId: customer._id,
          _id: { $ne: newMessage._id }
        })
          .sort({ timestamp: -1, createdAt: -1 })
          .limit(25)
          .lean();

        let lastAssistantMessage = '';
        const lastAiMsg = previousMessages.find((m) => m.sender === 'ai');
        if (lastAiMsg) {
          lastAssistantMessage = lastAiMsg.message;
        }

        previousMessages.reverse();

        const conversationHistory = previousMessages.length > 0
          ? previousMessages
              .map(
                (m) =>
                  `${m.sender === 'customer' ? 'CUSTOMER' : 'ASSISTANT'}: "${m.message}"`
              )
              .join('\n')
          : 'No previous messages recorded for this customer.';

        const customerContext = `Customer Name: ${customer.name}\nPhone: ${customer.phone}\nCurrent Status: ${customer.leadStatus || 'Cold'}\nPrevious Summary: ${customer.summary || 'None'}`;

        const aiAnalysis = await analyzeConversation(
          message.trim(),
          customerContext,
          conversationHistory,
          lastAssistantMessage
        );

        if (aiAnalysis && aiAnalysis.reply) {
          const aiReply = aiAnalysis.reply.trim();

          // Save AI reply message
          await Message.create({
            customerId: customer._id,
            sender: 'ai',
            message: aiReply,
            status: 'sent',
            timestamp: new Date()
          });

          // Update customer intelligence in MongoDB
          customer.leadScore = aiAnalysis.leadScore ?? customer.leadScore;
          customer.leadStatus = aiAnalysis.leadStatus || customer.leadStatus;
          customer.intent = aiAnalysis.intent || customer.intent;
          customer.sentiment = aiAnalysis.sentiment || customer.sentiment;
          customer.priority = aiAnalysis.priority || customer.priority;
          customer.summary = aiAnalysis.summary || customer.summary;
          customer.purchaseProbability = aiAnalysis.purchaseProbability ?? customer.purchaseProbability;
          customer.recommendedProduct = aiAnalysis.recommendedProduct || customer.recommendedProduct;
          customer.lastMessage = aiReply;
          await customer.save();
        }
      } catch (aiErr) {
        console.error('CRM message AI analysis failed:', aiErr.message);
      }
    }

    res.status(201).json({
      success: true,
      data: newMessage,
    });
  } catch (error) {
    next(error);
  }
};
