import express from 'express'
import { getCustomers, getCustomerById, createCustomer } from '../controllers/customerController.js'

const router = express.Router()

router.route('/')
  .get(getCustomers)
  .post(createCustomer)

router.route('/:id')
  .get(getCustomerById)

export default router
