import Customer from '../models/Customer.js';

// @desc    Get all customers
// @route   GET /api/customers
// @access  Public
export const getCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find({}).sort({ updatedAt: -1 });
    res.status(200).json({
      success: true,
      count: customers.length,
      data: customers,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single customer details
// @route   GET /api/customers/:id
// @access  Public
export const getCustomerById = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      res.status(404);
      throw new Error(`Customer not found with id of ${req.params.id}`);
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new customer (useful helper for seed / setup)
// @route   POST /api/customers
// @access  Public
export const createCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.create(req.body);
    res.status(201).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
};
