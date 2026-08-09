import express from 'express'
import { getMessagesByCustomer, createMessage } from '../controllers/messageController.js'

const router = express.Router()

router.route('/')
  .post(createMessage)

router.route('/:customerId')
  .get(getMessagesByCustomer)

export default router
