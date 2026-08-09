import express from 'express'
import { verifyWebhook, handleWebhook } from '../controllers/whatsappController.js'

const router = express.Router()

router.route('/webhook')
  .get(verifyWebhook)
  .post(handleWebhook)

export default router
