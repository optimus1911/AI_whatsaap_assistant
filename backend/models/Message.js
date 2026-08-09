import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Please associate this message with a customer']
    },
    sender: {
      type: String,
      enum: ['customer', 'ai'],
      required: [true, 'Please specify the sender (customer or ai)']
    },
    message: {
      type: String,
      required: [true, 'Message text content is required'],
      trim: true
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
)

// Indexing for faster history lookups
messageSchema.index({ customerId: 1, timestamp: 1 })

const Message = mongoose.model('Message', messageSchema)
export default Message
