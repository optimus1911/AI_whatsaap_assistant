import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Route imports
import customerRoutes from './routes/customerRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import productRoutes from './routes/productRoutes.js';
import knowledgeRoutes from './routes/knowledgeRoutes.js';

// Middleware imports
import errorHandler from './middleware/errorHandler.js';

// Load environment variables
dotenv.config();

const app = express();

// Dynamic CORS configuration supporting local development & Render deployment
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. WhatsApp webhooks, curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      
      // Allow listed origins or any *.onrender.com subdomain
      if (
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes('*') ||
        /\.onrender\.com$/.test(origin)
      ) {
        return callback(null, true);
      }
      
      // Allow origin in development
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root Health & Service Info Endpoint (GET /)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'AI WhatsApp Assistant CRM Backend (RAG Enabled)',
    version: '2.0.0',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'production',
    endpoints: {
      health: '/health',
      customers: '/api/customers',
      messages: '/api/messages',
      products: '/api/products',
      knowledge: '/api/knowledge',
      dashboard: '/api/dashboard',
      whatsapp: '/api/whatsapp/webhook'
    }
  });
});

// Dedicated Health Check API (GET /health)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date(),
    message: 'AI WhatsApp Assistant backend with RAG Knowledge Engine is healthy and running.'
  });
});

// Safe Diagnostics Endpoint (GET /api/diagnostics)
app.get('/api/diagnostics', async (req, res) => {
  try {
    const mongoose = (await import('mongoose')).default;
    const Product = (await import('./models/Product.js')).default;
    const BusinessKnowledge = (await import('./models/BusinessKnowledge.js')).default;

    const isConnected = mongoose.connection.readyState === 1;
    let productCount = 0;
    let knowledgeCount = 0;

    if (isConnected) {
      productCount = await Product.countDocuments();
      knowledgeCount = await BusinessKnowledge.countDocuments();
    }

    res.status(200).json({
      success: true,
      version: process.env.APP_VERSION || 'v2.1.0-rag',
      mongoConnected: isConnected,
      productCount,
      knowledgeCount,
      deterministicFallbackActive: true,
      geminiModelsConfigured: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Route mounting
app.use('/api/customers', customerRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/products', productRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Fallback path handler for undefined routes
app.use((req, res, next) => {
  res.status(404);
  const error = new Error(`Not Found - Path: ${req.originalUrl}`);
  next(error);
});

// Global Centralized Error Middleware
app.use(errorHandler);

export default app;
