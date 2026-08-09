import React, { useState, useMemo } from 'react';
import { 
  IoSearchOutline, 
  IoSpeedometerOutline, 
  IoChatbubblesOutline, 
  IoFilterOutline,
  IoCloseOutline
} from 'react-icons/io5';
import SearchBox from '../common/SearchBox';
import ChatItem from './ChatItem';
import { useCRM } from '../../context/CRMContext';

export default function Sidebar() {
  const { 
    customers = [], 
    loading, 
    activeCustomerId, 
    setActiveCustomerId: onSelectCustomer, 
    activeTab, 
    setActiveTab: onSelectTab 
  } = useCRM();

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Multi-Filter States
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSentiment, setFilterSentiment] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterOnline, setFilterOnline] = useState(false);

  const activeFiltersCount = [
    filterStatus, 
    filterSentiment, 
    filterPriority, 
    filterOnline
  ].filter(Boolean).length;

  // Combined Search and Multi-Filtering
  const filteredCustomers = useMemo(() => {
    return customers
      .map(c => ({
        id: c._id,
        name: c.name || 'Unknown',
        profilePicture: c.profilePicture || '',
        avatar: c.profilePicture || '',
        phone: c.phone || '',
        lastMessage: c.lastMessage || 'No messages yet.',
        time: c.updatedAt 
          ? new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
          : '',
        unread: (c.leadScore ?? 0) > 80 ? 1 : 0,
        online: c.online || false,
        leadStatus: c.leadStatus || 'Cold',
        leadScore: c.leadScore ?? 0,
        sentiment: c.sentiment || '',
        priority: c.priority || 'Low',
        intent: c.intent || '',
        recommendedProduct: c.recommendedProduct || ''
      }))
      .filter(c => {
        // Search query filtering
        const normalizedSearchQuery = searchQuery.trim().toLowerCase();
        if (normalizedSearchQuery) {
          const nameMatch = c.name.toLowerCase().includes(normalizedSearchQuery);
          const phoneMatch = c.phone.includes(normalizedSearchQuery);
          const messageMatch = c.lastMessage?.toLowerCase().includes(normalizedSearchQuery);
          if (!nameMatch && !phoneMatch && !messageMatch) return false;
        }

        // Multi-Filter constraints check
        if (filterStatus && c.leadStatus !== filterStatus) return false;
        if (filterSentiment && c.sentiment.toLowerCase() !== filterSentiment.toLowerCase()) return false;
        if (filterPriority && c.priority.toLowerCase() !== filterPriority.toLowerCase()) return false;
        if (filterOnline && !c.online) return false;

        return true;
      });
  }, [customers, searchQuery, filterStatus, filterSentiment, filterPriority, filterOnline]);

  const clearAllFilters = () => {
    setFilterStatus('');
    setFilterSentiment('');
    setFilterPriority('');
    setFilterOnline(false);
  };

  return (
    <div className="flex flex-col h-full bg-whatsapp-sidebar border-r border-whatsapp-border/40 w-full sm:w-[320px] md:w-[350px] lg:w-[380px] flex-shrink-0 select-none">
      
      {/* Top Brand Header Section */}
      <div className="flex items-center justify-between p-3.5 bg-whatsapp-panel border-b border-whatsapp-border/30 flex-shrink-0">
        <div className="flex items-center space-x-3">
          {/* Brand Logo Avatar */}
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-whatsapp-teal to-whatsapp-green text-whatsapp-dark font-extrabold text-base shadow-md">
            AI
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-whatsapp-green rounded-full border-2 border-whatsapp-panel" />
          </div>
          
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-sm text-whatsapp-text">AI WhatsApp Assistant</h1>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-whatsapp-teal/20 text-whatsapp-green border border-whatsapp-green/20">CRM</span>
            </div>
            <p className="text-[10px] text-whatsapp-gray flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-whatsapp-green animate-pulse"></span>
              <span>WhatsApp Intelligence</span>
            </p>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center space-x-1 text-whatsapp-gray">
          <button
            onClick={() => onSelectTab && onSelectTab('dashboard')}
            className="p-2 hover:bg-whatsapp-input rounded-lg hover:text-white transition-colors cursor-pointer"
            title="Dashboard Overview"
          >
            <IoSpeedometerOutline className="w-5 h-5" />
          </button>
          <button
            onClick={() => onSelectTab && onSelectTab('chat')}
            className="p-2 hover:bg-whatsapp-input rounded-lg hover:text-white transition-colors cursor-pointer"
            title="Customer Chats"
          >
            <IoChatbubblesOutline className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tab Switch Navigation Bar */}
      <div className="flex border-b border-whatsapp-border/20 p-2 bg-whatsapp-sidebar gap-1.5 select-none flex-shrink-0">
        <button
          onClick={() => onSelectTab && onSelectTab('dashboard')}
          className={`flex items-center justify-center gap-2 flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-whatsapp-teal/20 text-whatsapp-green border border-whatsapp-green/25 shadow-sm'
              : 'text-whatsapp-gray hover:bg-whatsapp-panel hover:text-whatsapp-text'
          }`}
        >
          <IoSpeedometerOutline className="w-4 h-4" />
          <span>Dashboard</span>
        </button>
        <button
          onClick={() => onSelectTab && onSelectTab('chat')}
          className={`flex items-center justify-center gap-2 flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
            activeTab === 'chat'
              ? 'bg-whatsapp-teal/20 text-whatsapp-green border border-whatsapp-green/25 shadow-sm'
              : 'text-whatsapp-gray hover:bg-whatsapp-panel hover:text-whatsapp-text'
          }`}
        >
          <IoChatbubblesOutline className="w-4 h-4" />
          <span>Chats ({customers.length})</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="px-3 py-2 bg-whatsapp-sidebar flex items-center space-x-2 border-b border-whatsapp-border/15 flex-shrink-0">
        <div className="flex-1 relative">
          <SearchBox
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, phone, message..."
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-whatsapp-gray hover:text-white cursor-pointer"
            >
              <IoCloseOutline className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`relative p-2.5 rounded-lg border transition-all duration-200 cursor-pointer ${
            showFilters || activeFiltersCount > 0
              ? "bg-whatsapp-teal/20 border-whatsapp-green/40 text-whatsapp-green shadow-sm"
              : "bg-whatsapp-input border-whatsapp-border/30 text-whatsapp-gray hover:text-white"
          }`}
          title="Toggle search filters"
        >
          <IoFilterOutline className="w-4 h-4" />
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-whatsapp-green text-whatsapp-dark text-[9px] font-extrabold flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Collapsible Multi-Filter Panel */}
      {showFilters && (
        <div className="px-3.5 py-3 bg-whatsapp-panel/95 border-b border-whatsapp-border/30 text-xs text-whatsapp-text grid grid-cols-2 gap-3 select-none flex-shrink-0 animate-slide-in shadow-inner">
          {/* Status Filter */}
          <div>
            <label className="text-[10px] text-whatsapp-gray font-bold uppercase tracking-wider block mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-whatsapp-input text-white rounded-lg border border-whatsapp-border/30 p-1.5 focus:outline-none text-xs cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="Hot">🔥 Hot</option>
              <option value="Warm">⚡ Warm</option>
              <option value="Cold">❄️ Cold</option>
            </select>
          </div>

          {/* Sentiment Filter */}
          <div>
            <label className="text-[10px] text-whatsapp-gray font-bold uppercase tracking-wider block mb-1">Sentiment</label>
            <select
              value={filterSentiment}
              onChange={(e) => setFilterSentiment(e.target.value)}
              className="w-full bg-whatsapp-input text-white rounded-lg border border-whatsapp-border/30 p-1.5 focus:outline-none text-xs cursor-pointer"
            >
              <option value="">All Sentiments</option>
              <option value="Positive">😊 Positive</option>
              <option value="Neutral">😐 Neutral</option>
              <option value="Negative">😠 Negative</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="text-[10px] text-whatsapp-gray font-bold uppercase tracking-wider block mb-1">Priority</label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full bg-whatsapp-input text-white rounded-lg border border-whatsapp-border/30 p-1.5 focus:outline-none text-xs cursor-pointer"
            >
              <option value="">All Priorities</option>
              <option value="High">🔴 High</option>
              <option value="Medium">🟠 Medium</option>
              <option value="Low">🔵 Low</option>
            </select>
          </div>

          {/* Online Checkbox */}
          <div className="flex items-center space-x-2 pt-4">
            <input
              type="checkbox"
              id="online-only-toggle"
              checked={filterOnline}
              onChange={(e) => setFilterOnline(e.target.checked)}
              className="rounded bg-whatsapp-input border-whatsapp-border/30 text-whatsapp-teal focus:ring-0 w-3.5 h-3.5 cursor-pointer"
            />
            <label htmlFor="online-only-toggle" className="text-xs font-semibold text-whatsapp-text cursor-pointer select-none">
              Online Only
            </label>
          </div>

          {/* Clear Filters Option */}
          {activeFiltersCount > 0 && (
            <div className="col-span-2 pt-2 border-t border-whatsapp-border/15 flex justify-between items-center">
              <span className="text-[10px] text-whatsapp-gray">{activeFiltersCount} filter(s) active</span>
              <button
                onClick={clearAllFilters}
                className="text-[10px] text-whatsapp-green font-bold hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Customer Conversation List */}
      <div className="flex-1 overflow-y-auto bg-whatsapp-sidebar divide-y divide-whatsapp-border/10">
        {loading && filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 h-48 gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-whatsapp-green border-t-transparent"></div>
            <span className="text-xs text-whatsapp-gray">Loading customers...</span>
          </div>
        ) : filteredCustomers.length > 0 ? (
          filteredCustomers.map((customer) => (
            <ChatItem
              key={customer.id}
              customer={customer}
              isActive={activeCustomerId === customer.id}
              onClick={() => {
                onSelectCustomer(customer.id);
                if (onSelectTab) onSelectTab('chat');
              }}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center h-64 select-none">
            <div className="p-4 bg-whatsapp-panel rounded-full text-whatsapp-gray mb-3 flex items-center justify-center border border-whatsapp-border/20">
              <IoSearchOutline className="w-7 h-7 opacity-70 text-whatsapp-green" />
            </div>
            <h3 className="text-whatsapp-text font-bold text-sm mb-1">
              No Customers Found
            </h3>
            <p className="text-whatsapp-gray text-xs max-w-[220px] leading-relaxed">
              {searchQuery || activeFiltersCount > 0 
                ? "No customer matches the search query or active filter." 
                : "No customer leads registered in CRM yet."}
            </p>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="mt-3 px-3 py-1 bg-whatsapp-teal/20 text-whatsapp-green text-xs font-bold rounded-lg border border-whatsapp-green/30 hover:bg-whatsapp-teal/30 transition-all cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
