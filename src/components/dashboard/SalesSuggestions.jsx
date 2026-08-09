import React from "react";
import { 
  IoCallOutline, 
  IoCardOutline, 
  IoFlashOutline
} from "react-icons/io5";
import { useCRM } from "../../context/CRMContext";

export default function SalesSuggestions({ customers = [], loading = false }) {
  const { setActiveCustomerId, setActiveTab } = useCRM();

  const handleOpenChat = (customerId) => {
    if (!customerId) return;
    setActiveCustomerId(customerId);
    setActiveTab("chat");
  };

  const generateSuggestions = () => {
    if (!Array.isArray(customers) || customers.length === 0) return [];
    
    const suggestionsList = [];

    customers.forEach(cust => {
      const prob = cust.purchaseProbability ?? 0;
      const score = cust.leadScore ?? 0;
      const intentLower = (cust.intent || "").toLowerCase();

      if (cust.leadStatus === "Hot" || score >= 80) {
        suggestionsList.push({
          id: `sug-hot-${cust._id || cust.id}`,
          customerId: cust._id || cust.id,
          title: `Follow up with ${cust.name}`,
          description: `Lead score is ${score}/100. High purchase readiness for ${cust.recommendedProduct || 'products'}.`,
          actionLabel: "Open Chat",
          icon: IoCallOutline,
          iconColor: "text-red-400"
        });
      } else if (prob >= 70 || intentLower.includes("price") || intentLower.includes("buy")) {
        suggestionsList.push({
          id: `sug-prob-${cust._id || cust.id}`,
          customerId: cust._id || cust.id,
          title: `Share pricing with ${cust.name}`,
          description: `Customer is inquiring about pricing & specifications.`,
          actionLabel: "Open Chat",
          icon: IoCardOutline,
          iconColor: "text-emerald-400"
        });
      }
    });

    return suggestionsList.slice(0, 4);
  };

  const suggestions = generateSuggestions();

  return (
    <div className="bg-whatsapp-panel border border-whatsapp-border/30 rounded-lg p-4 sm:p-5 select-none">
      <div className="flex items-center justify-between pb-3 border-b border-whatsapp-border/20 mb-3">
        <div className="flex items-center gap-2">
          <IoFlashOutline className="w-4 h-4 text-whatsapp-gray" />
          <h3 className="text-xs sm:text-sm font-semibold text-whatsapp-text">Action Playbook</h3>
        </div>
        {suggestions.length > 0 && (
          <span className="text-[11px] font-mono text-whatsapp-gray">
            {suggestions.length} items
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 py-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-12 bg-whatsapp-sidebar rounded animate-pulse"></div>
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-6 text-whatsapp-gray text-xs">
          <p>No immediate sales actions required</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.map((sug) => {
            const Icon = sug.icon;
            return (
              <div 
                key={sug.id}
                onClick={() => handleOpenChat(sug.customerId)}
                className="flex items-center justify-between p-3 bg-whatsapp-sidebar/60 border border-whatsapp-border/20 rounded hover:bg-whatsapp-sidebar transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${sug.iconColor}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-whatsapp-text truncate">
                      {sug.title}
                    </p>
                    <p className="text-[11px] text-whatsapp-gray truncate">
                      {sug.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenChat(sug.customerId);
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium bg-whatsapp-panel text-whatsapp-text border border-whatsapp-border/30 rounded flex-shrink-0 hover:bg-whatsapp-border/30 transition-colors"
                >
                  {sug.actionLabel}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
