import mongoose from 'mongoose';

const businessKnowledgeSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    keywords: {
      type: [String],
      default: [],
      index: true
    },
    embedding: {
      type: [Number],
      default: undefined
    }
  },
  {
    timestamps: true
  }
);

// Compound text index for search
businessKnowledgeSchema.index({
  title: 'text',
  content: 'text',
  keywords: 'text',
  category: 'text'
});

const BusinessKnowledge = mongoose.model('BusinessKnowledge', businessKnowledgeSchema);
export default BusinessKnowledge;
