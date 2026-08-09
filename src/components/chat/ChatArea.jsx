import React, { useState, useEffect, useRef } from 'react';
import { 
  IoHappyOutline, 
  IoAttachOutline, 
  IoSend, 
  IoMicOutline, 
  IoCheckmarkDone, 
  IoCheckmark, 
  IoSparklesOutline,
  IoChatbubblesOutline,
  IoFlameOutline
} from 'react-icons/io5';
import CustomerAvatar from '../common/CustomerAvatar';
import { createMessage } from '../../services/chatService';
import { useCRM } from '../../context/CRMContext';
import IntelligencePanel from './IntelligencePanel';

export default function ChatArea() {
  const { 
    activeCustomerId, 
    activeCustomer: customer, 
    messages = [], 
    messagesLoading: loading,
    sendMessageToState 
  } = useCRM();

  const [inputText, setInputText] = useState('');
  const [intelPanelOpen, setIntelPanelOpen] = useState(true);
  const [thinkingStage, setThinkingStage] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const stages = [
    "Reading customer message...",
    "Understanding intent...",
    "Analyzing sentiment...",
    "Calculating lead score...",
    "Generating AI response..."
  ];

  // Check if AI is currently thinking (last message was from customer)
  const isThinking = messages.length > 0 && messages[messages.length - 1].sender === "customer";

  // Rotate thinking stages smoothly
  useEffect(() => {
    let interval;
    if (isThinking) {
      setThinkingStage(0);
      interval = setInterval(() => {
        setThinkingStage(prev => (prev + 1) % stages.length);
      }, 1400);
    }
    return () => clearInterval(interval);
  }, [isThinking]);

  // Auto-scroll to the bottom of the feed smoothly
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  // Handle message send submission
  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeCustomerId || isSending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);

    try {
      const res = await createMessage(activeCustomerId, 'customer', textToSend);
      if (res.success && res.data) {
        // Append sent message to state immediately
        sendMessageToState(res.data);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!activeCustomerId || !customer) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-whatsapp-dark text-whatsapp-gray text-sm select-none p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-whatsapp-panel border border-whatsapp-border/30 flex items-center justify-center text-whatsapp-gray mb-3">
          <IoChatbubblesOutline className="w-8 h-8 opacity-60 text-whatsapp-green" />
        </div>
        <h2 className="text-base font-bold text-whatsapp-text mb-1">SalesPilot-AI CRM Workspace</h2>
        <p className="text-xs text-whatsapp-gray max-w-sm">
          Select a customer from the left sidebar to inspect live WhatsApp messages and real-time AI conversation analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full bg-whatsapp-dark relative overflow-hidden select-none">
      
      {/* Left Chat Column */}
      <div className="flex-1 flex flex-col h-full bg-whatsapp-dark relative min-w-0">
        
        {/* Active Customer Conversation Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-whatsapp-panel border-b border-whatsapp-border/30 z-10 shadow-sm flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <CustomerAvatar
              profilePicture={customer.profilePicture}
              name={customer.name}
              online={customer.online}
              size="md"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-whatsapp-text truncate">{customer.name}</h2>
                {customer.leadStatus === "Hot" && (
                  <span className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.2 rounded-full text-[9px] font-extrabold bg-red-500/15 text-red-400 border border-red-500/30">
                    <IoFlameOutline /> Hot Lead
                  </span>
                )}
              </div>
              <p className="text-[11px] text-whatsapp-gray flex items-center gap-1 font-mono truncate">
                <span>{customer.phone || ""}</span>
                <span className="text-whatsapp-border">•</span>
                <span className={customer.online ? "text-whatsapp-green font-medium" : "text-whatsapp-gray"}>
                  {customer.online ? 'Online' : customer.lastSeen || 'Offline'}
                </span>
              </p>
            </div>
          </div>

          {/* AI Insights Collapsible Tab Button */}
          <button
            onClick={() => setIntelPanelOpen(!intelPanelOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 cursor-pointer shadow-sm ${
              intelPanelOpen
                ? "bg-whatsapp-teal/20 border-whatsapp-green/40 text-whatsapp-green glow-green"
                : "bg-whatsapp-input border-whatsapp-border/30 text-whatsapp-gray hover:text-white hover:border-whatsapp-border"
            }`}
            title={intelPanelOpen ? "Hide AI Insights Panel" : "Show AI Insights Panel"}
          >
            <IoSparklesOutline className={intelPanelOpen ? "animate-pulse text-whatsapp-green" : ""} />
            <span>AI Insights</span>
          </button>
        </div>

        {/* Message Feed Display */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-4 sm:px-8 py-5 space-y-3 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-whatsapp-dark via-whatsapp-sidebar to-whatsapp-dark relative"
        >
          {/* Subtle watermark / encryption badge */}
          <div className="flex justify-center mb-4">
            <span className="text-[10px] text-whatsapp-gray/80 bg-whatsapp-panel/60 border border-whatsapp-border/20 px-3 py-1 rounded-lg backdrop-blur-sm">
              🔒 WhatsApp Business Conversation • AI Live Monitoring Active
            </span>
          </div>

          {loading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-whatsapp-green border-t-transparent"></div>
              <span className="text-xs text-whatsapp-gray">Loading messages...</span>
            </div>
          ) : messages.length > 0 ? (
            messages.map((msg) => {
              const isCustomer = msg.sender === 'customer';
              
              return (
                <div
                  key={msg._id || msg.id || Math.random()}
                  className={`flex ${isCustomer ? 'justify-start' : 'justify-end'} w-full animate-slide-in`}
                >
                  <div
                    className={`relative max-w-[85%] sm:max-w-[70%] md:max-w-[65%] rounded-2xl px-4 py-2.5 shadow-md text-xs sm:text-sm ${
                      isCustomer
                        ? 'bg-whatsapp-panel text-whatsapp-text border border-whatsapp-border/40 rounded-tl-sm'
                        : 'bg-gradient-to-br from-whatsapp-outgoing to-[#004d3e] text-white border border-whatsapp-green/20 rounded-tr-sm'
                    }`}
                  >
                    {/* Header tag: Customer vs AI Assistant */}
                    <div className="flex items-center justify-between gap-3 mb-1 pb-0.5 border-b border-white/5">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                        isCustomer ? 'text-whatsapp-gray' : 'text-whatsapp-green flex items-center gap-1'
                      }`}>
                        {isCustomer ? (customer.name || 'Customer') : '🤖 SalesPilot AI'}
                      </span>
                    </div>

                    {/* Message body */}
                    <p className="pr-12 break-words leading-relaxed font-sans text-whatsapp-text">
                      {msg.message}
                    </p>
                    
                    {/* Timestamp and Read Receipts */}
                    <div className="flex items-center justify-end space-x-1 text-[10px] text-whatsapp-gray/70 pt-1 select-none">
                      <span className="font-mono">{formatTime(msg.timestamp || msg.createdAt)}</span>
                      {!isCustomer && (
                        msg.status === 'read' ? (
                          <IoCheckmarkDone className="text-whatsapp-blue w-3.5 h-3.5" />
                        ) : msg.status === 'delivered' ? (
                          <IoCheckmarkDone className="text-whatsapp-gray w-3.5 h-3.5" />
                        ) : (
                          <IoCheckmark className="text-whatsapp-gray w-3.5 h-3.5" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-whatsapp-gray text-xs select-none">
              <p>No messages recorded for this conversation yet.</p>
              <p className="text-[10px] text-whatsapp-gray/60 mt-1">Send a test message below to trigger Gemini AI analysis.</p>
            </div>
          )}

          {/* AI Thinking Animation with 5 stages */}
          {isThinking && (
            <div className="flex justify-end w-full select-none animate-slide-in">
              <div className="bg-gradient-to-br from-whatsapp-panel to-whatsapp-input text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg max-w-[70%] flex flex-col gap-2 border border-whatsapp-green/30">
                <div className="flex items-center gap-2">
                  {/* Bouncing dots */}
                  <div className="flex space-x-1 items-center h-3">
                    <div className="w-1.5 h-1.5 bg-whatsapp-green rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-1.5 h-1.5 bg-whatsapp-green rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-1.5 h-1.5 bg-whatsapp-green rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                  <span className="text-[10px] text-whatsapp-green font-extrabold uppercase tracking-wider font-mono">
                    SalesPilot Intelligence
                  </span>
                </div>
                <span className="text-xs text-whatsapp-text font-medium transition-all duration-300">
                  {stages[thinkingStage]}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Bar */}
        <form onSubmit={handleSend} className="px-4 py-3 bg-whatsapp-panel border-t border-whatsapp-border/30 flex items-center space-x-3 z-10 flex-shrink-0">
          <div className="flex items-center space-x-1 text-whatsapp-gray">
            <button type="button" className="p-1.5 hover:text-white hover:bg-whatsapp-input rounded-full transition-colors" title="Emojis">
              <IoHappyOutline className="w-5 h-5" />
            </button>
            <button type="button" className="p-1.5 hover:text-white hover:bg-whatsapp-input rounded-full transition-colors" title="Attachments">
              <IoAttachOutline className="w-5 h-5 rotate-45" />
            </button>
          </div>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type customer message or test inquiry..."
            disabled={isSending}
            className="flex-1 bg-whatsapp-input text-white rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-whatsapp-green border border-whatsapp-border/30 placeholder-whatsapp-gray transition-all"
          />

          {/* Action Buttons */}
          <div className="text-whatsapp-gray flex-shrink-0">
            {inputText.trim() ? (
              <button
                type="submit"
                disabled={isSending}
                className="p-2.5 bg-whatsapp-teal hover:bg-whatsapp-green text-whatsapp-dark font-bold rounded-full transition-all duration-200 shadow-md cursor-pointer disabled:opacity-50"
                title="Send Message"
              >
                <IoSend className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" className="p-2 hover:text-white hover:bg-whatsapp-input rounded-full transition-colors" title="Voice Input">
                <IoMicOutline className="w-5 h-5" />
              </button>
            )}
          </div>
        </form>

      </div>

      {/* Right Intelligence Column */}
      <IntelligencePanel 
        customer={customer}
        isOpen={intelPanelOpen}
        onToggle={() => setIntelPanelOpen(!intelPanelOpen)}
      />

    </div>
  );
}
