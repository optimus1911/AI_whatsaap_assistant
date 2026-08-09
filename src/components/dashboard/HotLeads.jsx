import React from "react";
import CustomerAvatar from "../common/CustomerAvatar";
import { useCRM } from "../../context/CRMContext";
import { IoFlameOutline } from "react-icons/io5";

export default function HotLeads({ customers = [], loading = false }) {
  const { setActiveCustomerId, setActiveTab } = useCRM();

  const handleOpenChat = (customerId) => {
    if (!customerId) return;
    setActiveCustomerId(customerId);
    setActiveTab("chat");
  };

  const leads = [...customers]
    .filter(c => c.leadStatus === "Hot" || (c.leadScore ?? 0) >= 70)
    .sort((a, b) => (b.leadScore ?? 0) - (a.leadScore ?? 0))
    .slice(0, 5);

  return (
    <div className="bg-whatsapp-panel border border-whatsapp-border/30 rounded-lg p-4 sm:p-5 flex flex-col justify-between select-none">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-whatsapp-border/20 mb-3">
          <div className="flex items-center gap-2">
            <IoFlameOutline className="w-4 h-4 text-red-400" />
            <h3 className="text-xs sm:text-sm font-semibold text-whatsapp-text">Hot Leads</h3>
          </div>
          {leads.length > 0 && (
            <span className="text-[11px] font-mono text-red-400">
              {leads.length} priority
            </span>
          )}
        </div>
        
        {/* Content */}
        {loading ? (
          <div className="space-y-2 py-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-whatsapp-sidebar rounded animate-pulse"></div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-6 text-whatsapp-gray text-xs">
            <p>No hot leads currently pending</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {leads.map((lead) => (
              <div 
                key={lead._id || lead.id}
                onClick={() => handleOpenChat(lead._id || lead.id)}
                className="flex items-center justify-between p-2 rounded hover:bg-whatsapp-sidebar/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <CustomerAvatar 
                    profilePicture={lead.profilePicture} 
                    name={lead.name} 
                    size="sm" 
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-xs text-whatsapp-text truncate">
                      {lead.name}
                    </p>
                    <p className="text-[10px] text-whatsapp-gray font-mono truncate">
                      {lead.phone}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-mono font-bold text-red-400">
                    {lead.leadScore ?? 0}
                  </span>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-500/15 text-red-400 rounded">
                    Hot
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
