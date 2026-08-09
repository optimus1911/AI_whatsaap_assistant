import React from 'react';
import { motion } from 'framer-motion';
import CustomerAvatar from '../common/CustomerAvatar';
import { LEAD_STATUS } from '../../constants/leadStatus';

export default function ChatItem({ customer, isActive, onClick }) {
  const { 
    name, 
    profilePicture,
    avatar, 
    lastMessage, 
    time, 
    unread, 
    online, 
    leadStatus,
    leadScore
  } = customer;

  const score = leadScore ?? 0;

  return (
    <motion.div
      onClick={onClick}
      className={`relative flex items-center justify-between p-3 cursor-pointer select-none transition-all duration-200 border-b border-whatsapp-border/25 ${
        isActive 
          ? 'bg-whatsapp-panel/90 shadow-sm border-l-4 border-l-whatsapp-green' 
          : 'hover:bg-whatsapp-panel/40'
      }`}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        {/* Customer Avatar with real photo or initials */}
        <CustomerAvatar 
          profilePicture={profilePicture || avatar} 
          name={name} 
          online={online} 
          size="md" 
        />

        {/* Customer Details & Snippet */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <h3 className={`font-bold text-sm truncate mr-2 ${
              isActive ? 'text-white' : 'text-whatsapp-text'
            }`}>
              {name}
            </h3>
            <span className={`text-[10px] font-mono ${
              unread > 0 ? 'text-whatsapp-green font-bold' : 'text-whatsapp-gray'
            }`}>
              {time}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className={`text-xs truncate ${
              unread > 0 ? 'text-whatsapp-text font-semibold' : 'text-whatsapp-gray'
            }`}>
              {lastMessage}
            </p>

            <div className="flex items-center space-x-1.5 flex-shrink-0">
              {/* Lead Score Indicator */}
              {score > 0 && (
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                  score >= 80 ? 'text-red-400 bg-red-500/10' : score >= 50 ? 'text-orange-400 bg-orange-500/10' : 'text-blue-400 bg-blue-500/10'
                }`}>
                  {score}
                </span>
              )}

              {/* Lead Status Badge */}
              {leadStatus && (
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  LEAD_STATUS[leadStatus] || LEAD_STATUS.Cold
                }`}>
                  {leadStatus === "Hot" ? "🔥 Hot" : leadStatus === "Warm" ? "⚡ Warm" : "❄️ Cold"}
                </span>
              )}

              {/* Unread Message Count Badge */}
              {unread > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-whatsapp-green text-whatsapp-dark text-[10px] font-extrabold shadow-sm">
                  {unread}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
