import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    brand: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    model: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      default: 'Laptop',
      trim: true
    },
    price: {
      type: Number,
      required: true,
      index: true
    },
    currency: {
      type: String,
      default: 'INR'
    },
    ram: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    storage: {
      type: String,
      required: true,
      trim: true
    },
    processor: {
      type: String,
      required: true,
      trim: true
    },
    gpu: {
      type: String,
      default: 'Integrated'
    },
    display: {
      type: String,
      default: ''
    },
    os: {
      type: String,
      default: 'Windows 11 Home'
    },
    useCases: {
      type: [String],
      default: [],
      index: true
    },
    availability: {
      type: String,
      enum: ['in_stock', 'out_of_stock', 'pre_order'],
      default: 'in_stock',
      index: true
    },
    stock: {
      type: Number,
      default: 0
    },
    description: {
      type: String,
      default: ''
    },
    keywords: {
      type: [String],
      default: []
    },
    source: {
      type: String,
      default: 'Demo AI WhatsApp Assistant product catalog'
    },
    // Optional embedding vector field for MongoDB Atlas Vector Search
    embedding: {
      type: [Number],
      default: undefined
    }
  },
  {
    timestamps: true
  }
);

// Compound text index for fast keyword search fallback
productSchema.index({
  brand: 'text',
  model: 'text',
  description: 'text',
  keywords: 'text',
  useCases: 'text',
  processor: 'text'
});

const Product = mongoose.model('Product', productSchema);
export default Product;
