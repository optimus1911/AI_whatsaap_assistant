import api from './api'

/**
 * Fetch all customers from the backend.
 * @returns {Promise<object>} REST API JSON response containing customer array
 */
export const getCustomers = async () => {
  const response = await api.get('/customers')
  return response.data
}

/**
 * Fetch a specific customer's profile by ID.
 * @param {string} id Customer MongoDB Object ID
 * @returns {Promise<object>} REST API JSON response containing customer profile
 */
export const getCustomerById = async (id) => {
  const response = await api.get(`/customers/${id}`)
  return response.data
}

/**
 * Fetch conversation history for a given customer.
 * @param {string} customerId Customer MongoDB Object ID
 * @returns {Promise<object>} REST API JSON response containing message array
 */
export const getMessagesByCustomer = async (customerId) => {
  const response = await api.get(`/messages/${customerId}`)
  return response.data
}

/**
 * Save a new message in MongoDB.
 * @param {string} customerId Customer MongoDB Object ID
 * @param {string} sender Whom the message is sent from ('customer' | 'ai')
 * @param {string} message Text content of the message
 * @returns {Promise<object>} REST API JSON response containing saved message
 */
export const createMessage = async (customerId, sender, message) => {
  const response = await api.post('/messages', {
    customerId,
    sender,
    message
  })
  return response.data
}
