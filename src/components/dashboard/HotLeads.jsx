import React from "react";
import CustomerAvatar from "../common/CustomerAvatar";
import { useCRM } from "../../context/CRMContext";
import { IoFlame, IoChatbubbleOutline } from "react-icons/io5";

export default function HotLeads({ customers = [], loading = false }) {
  const { setActiveCustomerId, setActiveTab } = useCRM();

  const handleOpenChat = (customerId) => {
    if (!customerId) return;
    setActiveCustomerId(customerId);
    setActiveTab("chat");
  };

  // Sort by Lead Score DESC, prioritizing Hot status
  const leads = [...customers]
    .filter(c => c.leadStatus === "Hot" || (c.leadScore ?? 0) >= 70)
    .sort((a, b) => (b.leadScore ?? 0) - (a.leadScore ?? 0))
    .slice(0, 5);

  const getPriorityBadge = (prio) => {
    const p = (prio || "Low").toLowerCase();
    if (p === "high") return <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 rounded-full border border-red-500/30">High</span>;
    if (p === "medium") return <span className="px-2 py-0.5 text-[10px] font-semibold bg-orange-500/15 text-orange-400 rounded-full border border-orange-500/25">Medium</span>;
    return <span className="px-2 py-0.5 text-[10px] font-medium bg-whatsapp-input text-whatsapp-gray rounded-full border border-whatsapp-border/30">Low</span>;
  };

  return (
    <div className="bg-whatsapp-panel/90 backdrop-blur-sm border border-whatsapp-border/30 rounded-xl p-4 sm:p-5 shadow-sm h-full flex flex-col justify-between select-none">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-whatsapp-border/15 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <IoFlame className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-whatsapp-text">Hot Leads Queue</h3>
              <p className="text-[10px] text-whatsapp-gray">Priority customers ready to buy</p>
            </div>
          </div>
          {leads.length > 0 && (
            <span className="text-[10px] font-mono font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
              {leads.length} urgent
            </span>
          )}
        </div>
        
        {/* Content */}
        {loading ? (
          <div className="space-y-2 py-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-whatsapp-input/30 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-8 text-whatsapp-gray text-xs">
            <div className="w-9 h-9 rounded-full bg-whatsapp-input/50 flex items-center justify-center text-whatsapp-gray mx-auto mb-2">
              <IoFlame className="w-4 h-4 opacity-60" />
            </div>
            <p className="font-semibold text-whatsapp-text">No Hot Leads Right Now</p>
            <p className="text-[10px] text-whatsapp-gray mt-0.5">
              High intent customers will automatically be highlighted here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {leads.map((lead, index) => {
              const prob = lead.purchaseProbability ?? 0;
              return (
                <div 
                  key={lead._id || index}
                  onClick={() => handleOpenChat(lead._id)}
                  className="p-2.5 bg-whatsapp-input/30 border border-whatsapp-border/20 rounded-xl hover:border-red-500/40 hover:bg-whatsapp-input/50 transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <CustomerAvatar 
                      name={lead.name} 
                      profilePicture={lead.profilePicture} 
                      size="sm"
                      online={lead.online}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-whatsapp-text group-hover:text-whatsapp-green transition-colors truncate">
                          {lead.name}
                        </span>
                        {getPriorityBadge(lead.priority)}
                      </div>
                      <span className="text-[10px] text-whatsapp-gray truncate block">
                        {lead.recommendedProduct || "General Inquiry"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-extrabold font-mono text-red-400">
                        {lead.leadScore ?? 0} <span className="text-[9px] font-normal text-whatsapp-gray">pts</span>
                      </div>
                      <div className="text-[9px] font-mono text-whatsapp-green font-semibold">
                        {prob}% prob
                      </div>
                    </div>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenChat(lead._id);
                      }}
                      className="p-1.5 text-whatsapp-green hover:bg-whatsapp-teal/20 rounded-lg transition-colors border border-whatsapp-green/20"
                      title="Open conversation"
                    >
                      <IoChatbubbleOutline className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
