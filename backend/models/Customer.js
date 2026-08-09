import mongoose from 'mongoose'

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a customer name'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Please add a contact phone number'],
      unique: true,
      trim: true
    },
    leadStatus: {
      type: String,
      enum: ['Hot', 'Warm', 'Cold'],
      default: 'Cold'
    },
    leadScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    lastMessage: {
      type: String,
      default: ''
    },
    lastSeen: {
      type: String,
      default: 'online'
    },
    profilePicture: {
      type: String,
      default: ''
    },
    online: {
      type: Boolean,
      default: false
    },
    intent: {
      type: String,
      default: ''
    },
    sentiment: {
      type: String,
      default: ''
    },
    priority: {
      type: String,
      default: 'Low'
    },
    summary: {
      type: String,
      default: ''
    },
    purchaseProbability: {
      type: Number,
      default: 0
    },
    recommendedProduct: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
)

const Customer = mongoose.model('Customer', customerSchema)
export default Customer
