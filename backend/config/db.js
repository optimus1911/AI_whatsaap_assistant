import mongoose from 'mongoose'

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp_sales_assistant')
    console.log(`MongoDB Connected: ${conn.connection.host}`)
  } catch (error) {
    console.error(`[MongoDB] Connection failed: ${error.message}`)
    console.warn('[MongoDB] Server will continue with deterministic fallback catalog. Will retry on next request.')
    // Do NOT process.exit — let HTTP server stay alive for webhook/health/diagnostics
  }
}

export default connectDB
