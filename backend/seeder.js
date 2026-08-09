import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import connectDB from './config/db.js'
import Customer from './models/Customer.js'
import Message from './models/Message.js'

// Load env vars
dotenv.config()

// Connect to DB
connectDB()

// Read seed files from frontend mocks
const customersPath = path.resolve('../src/mock/customers.json')
const messagesPath = path.resolve('../src/mock/messages.json')

const customers = JSON.parse(fs.readFileSync(customersPath, 'utf-8'))
const messagesData = JSON.parse(fs.readFileSync(messagesPath, 'utf-8'))

const importData = async () => {
  try {
    // Clear existing DB data
    await Message.deleteMany()
    await Customer.deleteMany()

    console.log('Database cleared...')

    // Seed Customers
    const createdCustomers = []
    for (const cust of customers) {
      const { name, phone, leadStatus, leadScore, lastMessage, lastSeen, avatar, online } = cust
      
      const newCust = await Customer.create({
        name,
        phone,
        leadStatus,
        leadScore,
        lastMessage,
        lastSeen,
        profilePicture: avatar,
        online
      })
      createdCustomers.push(newCust)
      console.log(`Created customer: ${newCust.name}`)
    }

    // Seed Messages associated to customers
    for (const cust of createdCustomers) {
      // Find matching mock source key using phone or initials
      // Find cust_x match based on position
      const originalCustMock = customers.find(c => c.name === cust.name)
      if (originalCustMock) {
        const mockMsgKey = originalCustMock.id // e.g. "cust_1"
        const customerMessages = messagesData[mockMsgKey] || []
        
        for (const msg of customerMessages) {
          await Message.create({
            customerId: cust._id,
            sender: msg.sender,
            message: msg.text,
            status: msg.status,
            timestamp: new Date() // Sets to current time for standard sorting
          })
        }
        console.log(`Imported ${customerMessages.length} messages for ${cust.name}`)
      }
    }

    console.log('Data Imported Successfully!')
    process.exit()
  } catch (error) {
    console.error(`Error importing seed data: ${error.message}`)
    process.exit(1)
  }
}

const destroyData = async () => {
  try {
    await Message.deleteMany()
    await Customer.deleteMany()

    console.log('Data Destroyed Successfully!')
    process.exit()
  } catch (error) {
    console.error(`Error destroying seed data: ${error.message}`)
    process.exit(1)
  }
}

if (process.argv[2] === '-d') {
  destroyData()
} else {
  importData()
}
