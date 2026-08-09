import Product from '../models/Product.js';
import { searchProducts } from '../services/productSearchService.js';

// @desc    Get all products or search products
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res, next) => {
  try {
    const { brand, ram, storage, maxPrice, minPrice, useCase, q, inStockOnly } = req.query;

    if (brand || ram || storage || maxPrice || minPrice || useCase || q) {
      const results = await searchProducts({
        brand,
        ram,
        storage,
        maxPrice: maxPrice ? parseFloat(maxPrice) : null,
        minPrice: minPrice ? parseFloat(minPrice) : null,
        useCase,
        keyword: q,
        inStockOnly: inStockOnly !== 'false',
        limit: 20
      });
      return res.status(200).json({ success: true, count: results.length, data: results });
    }

    const products = await Product.find({}).sort({ price: 1 });
    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single product by ID or model
// @route   GET /api/products/:id
// @access  Public
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne({
      $or: [{ id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }]
    });

    if (!product) {
      res.status(404);
      throw new Error(`Product not found with identifier: ${id}`);
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};
