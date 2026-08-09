import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import ChatPage from './pages/ChatPage'

function App() {
  return (
    <Router>
      <div className="w-full h-screen bg-whatsapp-dark text-white font-sans overflow-hidden">
        <Routes>
          <Route path="/" element={<ChatPage />} />
          {/* Dashboard route now maps to ChatPage with integrated views */}
          <Route path="/dashboard" element={<ChatPage />} />
          <Route path="/customers" element={<div className="p-8">Customer Management (Coming Soon)</div>} />
          <Route path="/analytics" element={<div className="p-8">Analytics & Lead Scoring (Coming Soon)</div>} />
          <Route path="/settings" element={<div className="p-8">Settings (Coming Soon)</div>} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
