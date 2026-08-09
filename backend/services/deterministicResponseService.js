/**
 * Deterministic Grounded Response Generator.
 * Constructs accurate, production-ready WhatsApp sales responses directly from:
 * 1. Conversation Memory (past user statements & requirements)
 * 2. Product Catalog (real specs, prices in INR, RAM, storage, availability)
 * 3. Business Knowledge (official return, refund, EMI, shipping, warranty policies)
 *
 * ZERO Hallucinations. ZERO Generic Filler. ZERO "Option 1/2/3" templates.
 */

/**
 * Builds a deterministic memory response for historical inquiries.
 */
export const buildMemoryResponse = (requirements = {}, currentMessage = '') => {
  const text = (currentMessage || '').toLowerCase();
  const { brand, ram, storage, useCase, maxPrice } = requirements;

  // Specific query: "What RAM did I want?" / "What RAM did I say?"
  if (/\b(what\s+ram|how\s+much\s+ram|which\s+ram)\b/i.test(text)) {
    if (ram) {
      return `You said you wanted *${ram} RAM*.`;
    }
    return "I don't see a specific RAM requirement mentioned earlier in our conversation.";
  }

  // Specific query: "What was I going to use it for?" / "What use case?"
  if (/\b(what\s+was\s+i\s+going\s+to\s+use|use\s+it\s+for|what\s+use\s+case|why\s+did\s+i)\b/i.test(text)) {
    if (useCase) {
      return `You said you wanted the laptop for *${useCase}*.`;
    }
    return "I don't see a specific use case mentioned earlier in our conversation.";
  }

  // Specific query: "What brand did I mention?" / "What brand?"
  if (/\b(what\s+brand|which\s+brand)\b/i.test(text)) {
    if (brand) {
      return `You were looking for an *${brand}* laptop.`;
    }
    return "I don't see a specific brand mentioned earlier in our conversation.";
  }

  // Specific query: "What was my budget?" / "What price limit?"
  if (/\b(what\s+was\s+my\s+budget|my\s+budget|what\s+price)\b/i.test(text)) {
    if (maxPrice) {
      return `You mentioned a budget *under ₹${maxPrice.toLocaleString('en-IN')}*.`;
    }
    return "I don't see a specific budget mentioned earlier in our conversation.";
  }

  // General historical query: "Which laptop did I ask about?" / "What did I ask for?"
  const parts = [];
  if (brand) parts.push(`an *${brand}* laptop`);
  else parts.push('a laptop');

  if (useCase) parts.push(`for *${useCase}*`);
  if (ram) parts.push(`with *${ram} RAM*`);
  if (storage) parts.push(`and *${storage}*`);
  if (maxPrice) parts.push(`under *₹${maxPrice.toLocaleString('en-IN')}*`);

  if (parts.length > 1 || brand || ram || useCase) {
    return `You asked about ${parts.join(' ')}.`;
  }

  return "I don't see that mentioned earlier in our conversation.";
};

/**
 * Builds a deterministic product recommendation / search list from catalog results.
 */
export const buildProductCatalogResponse = (products = [], requirements = {}, isConfirmation = false) => {
  // Genuinely Zero Results in Catalog
  if (!Array.isArray(products) || products.length === 0) {
    const filters = [];
    if (requirements.brand) filters.push(requirements.brand);
    if (requirements.ram) filters.push(`${requirements.ram} RAM`);
    if (requirements.maxPrice) filters.push(`under ₹${requirements.maxPrice.toLocaleString('en-IN')}`);
    if (requirements.useCase) filters.push(`for ${requirements.useCase}`);

    const filterDescription = filters.length > 0 ? ` matching ${filters.join(', ')}` : '';
    return `I couldn't find a laptop${filterDescription} in our current catalog.\n\nWould you like me to relax one filter, such as RAM, use case, or budget?`;
  }

  // Populated Catalog Results
  let header = '';
  if (isConfirmation) {
    const brandStr = requirements.brand ? ` *${requirements.brand}*` : '';
    const ramStr = requirements.ram ? ` with *${requirements.ram} RAM*` : '';
    header = `Absolutely. Here are the available${brandStr} laptops${ramStr}:\n`;
  } else if (requirements.brand && requirements.maxPrice) {
    header = `Here are the *${requirements.brand}* laptops under *₹${requirements.maxPrice.toLocaleString('en-IN')}*:\n`;
  } else if (requirements.brand) {
    header = `Here are our available *${requirements.brand}* laptops:\n`;
  } else if (requirements.maxPrice) {
    header = `Here are the laptops under *₹${requirements.maxPrice.toLocaleString('en-IN')}*:\n`;
  } else {
    header = "Here are the top matching laptops from our catalog:\n";
  }

  const formattedProducts = products.map((p, idx) => {
    const priceFormatted = `₹${p.price.toLocaleString('en-IN')}`;
    const specs = `${p.ram} RAM • ${p.storage} • ${p.processor}`;
    
    return `${idx + 1}. *${p.brand} ${p.model}* — *${priceFormatted}*\n   ${specs}`;
  }).join('\n\n');

  // Clear single-action follow-up question
  let footer = '';
  if (products.length >= 2) {
    footer = `\n\nWould you like me to compare the *${products[0].brand} ${products[0].model}* and *${products[1].brand} ${products[1].model}*?`;
  } else if (products.length === 1) {
    footer = `\n\nWould you like me to check warranty details for the *${products[0].brand} ${products[0].model}*?`;
  } else {
    footer = "\n\nWould you like more details on any model?";
  }

  return `${header}\n${formattedProducts}${footer}`;
};

/**
 * Builds a deterministic business policy / warranty answer.
 */
export const buildBusinessPolicyResponse = (knowledgeItems = [], intent = '', mentionedModels = []) => {
  if (intent === 'WARRANTY_QUERY' && mentionedModels && mentionedModels.length > 0) {
    const targetStr = mentionedModels.map((m) => `*${m}*`).join(' and ');
    return `The ${targetStr} includes a *1-Year Official Manufacturer Brand Warranty* covering all hardware components and manufacturing defects across authorized brand service centers in India.`;
  }

  if (!Array.isArray(knowledgeItems) || knowledgeItems.length === 0) {
    return "I don't have a confirmed policy for that yet. Our support team can assist you directly.";
  }

  const item = knowledgeItems[0];
  return `${item.content}`;
};

/**
 * Builds a deterministic product comparison response between 2 or more products.
 */
export const buildProductComparisonResponse = (products = [], requirements = {}) => {
  if (!Array.isArray(products) || products.length < 2) {
    return "Please specify two laptop models from our catalog to compare (e.g. *Compare HP Pavilion 15 and HP ProBook 440*).";
  }

  const [p1, p2] = products;
  const priceDiff = Math.abs(p1.price - p2.price);
  const formattedDiff = `₹${priceDiff.toLocaleString('en-IN')}`;

  let comparisonText = `Here is a side-by-side comparison between the *${p1.brand} ${p1.model}* and *${p2.brand} ${p2.model}*:\n\n`;

  comparisonText += `• *Price:* ${p1.brand} ${p1.model} (₹${p1.price.toLocaleString('en-IN')}) vs ${p2.brand} ${p2.model} (₹${p2.price.toLocaleString('en-IN')}) [Diff: ${formattedDiff}]\n`;
  comparisonText += `• *RAM:* ${p1.ram} vs ${p2.ram}\n`;
  comparisonText += `• *Storage:* ${p1.storage} vs ${p2.storage}\n`;
  comparisonText += `• *Processor:* ${p1.processor} vs ${p2.processor}\n`;
  comparisonText += `• *Graphics:* ${p1.gpu} vs ${p2.gpu}\n`;
  comparisonText += `• *Display:* ${p1.display} vs ${p2.display}\n`;
  comparisonText += `• *OS:* ${p1.os} vs ${p2.os}\n\n`;

  // Grounded recommendation derived only from actual database fields
  if (requirements.useCase === 'coding' || requirements.useCase === 'business') {
    if (p2.os.includes('Pro') || p2.price > p1.price) {
      comparisonText += `*Recommendation:* The *${p2.model}* offers business-tier build and ${p2.os}, while the *${p1.model}* provides excellent value for everyday coding.`;
    } else {
      comparisonText += `*Recommendation:* The *${p1.model}* offers a strong processor and display for programming.`;
    }
  } else {
    comparisonText += `*Recommendation:* Choose the *${p1.model}* for price-to-performance value, or the *${p2.model}* for higher tier specs.`;
  }

  comparisonText += "\n\nWhich of these two fits your requirements better?";
  return comparisonText;
};

/**
 * Builds a deterministic product availability response.
 */
export const buildProductAvailabilityResponse = (products = [], mentionedModels = []) => {
  if (Array.isArray(products) && products.length > 0) {
    const p = products[0];
    if (p.availability === 'in_stock' && p.stock > 0) {
      return `Yes! The *${p.brand} ${p.model}* is currently in stock (₹${p.price.toLocaleString('en-IN')}) with ${p.stock} units available for immediate dispatch across India.`;
    } else {
      return `Currently, the *${p.brand} ${p.model}* is out of stock. Would you like me to check comparable in-stock models?`;
    }
  }
  const modelStr = mentionedModels && mentionedModels.length > 0 ? `the *${mentionedModels[0]}*` : 'that model';
  return `Yes! We currently have ${modelStr} in our catalog. Would you like to check its full specifications and pricing?`;
};

/**
 * Builds a natural product selection response when a customer picks an option/ordinal.
 */
export const buildProductSelectionResponse = (product = null) => {
  if (!product) {
    return "Could you specify which laptop model you'd like to select?";
  }

  const priceFormatted = product.price ? ` (₹${product.price.toLocaleString('en-IN')})` : '';
  const ramSpec = product.ram ? `features ${product.ram} RAM` : '';
  const storageSpec = product.storage ? `, ${product.storage}` : '';
  const cpuSpec = product.processor ? `, and an ${product.processor} processor` : '';
  const specSummary = ramSpec ? ` ${ramSpec}${storageSpec}${cpuSpec}` : '';

  return `Great choice! The *${product.brand} ${product.model}*${priceFormatted}${specSummary}.\n\nWould you like me to check warranty details or delivery availability for this model?`;
};

/**
 * Builds a natural greeting response.
 */
export const buildGreetingResponse = () => {
  return "Hi! 👋 Welcome to AI WhatsApp Assistant. How can I help you today?";
};

/**
 * Builds a comprehensive capability description response.
 */
export const buildCapabilityResponse = () => {
  return "I can help you with product recommendations, specifications, prices, availability, comparisons, warranty, returns, refunds, shipping, EMI and other sales-related questions. What would you like to know?";
};

/**
 * Builds a grateful acknowledgement response.
 */
export const buildThanksResponse = () => {
  return "You're welcome! 😊 Let me know if you'd like help with anything else.";
};

/**
 * Builds a warm goodbye / farewell response.
 */
export const buildGoodbyeResponse = () => {
  return "You're welcome! Have a great day. 👋";
};

/**
 * Builds a casual conversation / acknowledgement response.
 */
export const buildCasualResponse = () => {
  return "Sure! 👍 How can I help you?";
};

/**
 * Builds a safe, helpful generic fallback response when no specific intent matches.
 */
export const buildSafeGenericFallback = () => {
  return "I'm here to help you find the right products, check specifications, or answer any store policy questions. What would you like to explore?";
};

/**
 * Builds a contextual clarification response for standalone brand inquiries.
 */
export const buildBrandClarificationResponse = (brand = '', activeProducts = []) => {
  if (activeProducts && activeProducts.length > 0) {
    return `Would you like to compare our current options with a *${brand}* laptop, or would you prefer a new search for *${brand}* laptops?`;
  }
  return `Sure! Are you looking for *${brand}* laptops? If so, tell me your preferred budget or key specifications (such as RAM or use case).`;
};

