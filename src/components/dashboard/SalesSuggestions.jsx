import React from "react";
import { 
  IoFlashOutline, 
  IoCallOutline, 
  IoCardOutline, 
  IoMailOutline, 
  IoPeopleOutline, 
  IoWarningOutline, 
  IoChatbubblesOutline,
  IoChevronForwardOutline
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
      const sentimentLower = (cust.sentiment || "").toLowerCase();

      // Rule 1: High Priority + Hot Lead
      if (cust.leadStatus === "Hot" || score >= 80) {
        suggestionsList.push({
          id: `sug-hot-${cust._id}`,
          customerId: cust._id,
          title: `Urgent Follow-Up: ${cust.name}`,
          description: `Lead score is ${score}/100 with ${prob}% close probability. Call or send checkout info immediately.`,
          actionLabel: "Chat Now",
          icon: IoCallOutline,
          iconColor: "text-red-400 bg-red-500/10 border-red-500/25",
          urgency: 4
        });
      }

      // Rule 2: Purchase Probability >= 75%
      else if (prob >= 75) {
        suggestionsList.push({
          id: `sug-prob-${cust._id}`,
          customerId: cust._id,
          title: `Send Payment Details to ${cust.name}`,
          description: `High purchase readiness for ${cust.recommendedProduct || 'catalog items'}. Provide direct invoice/payment link.`,
          actionLabel: "Send Link",
          icon: IoCardOutline,
          iconColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
          urgency: 3
        });
      }

      // Rule 3: Pricing Intent
      else if (intentLower.includes("price") || intentLower.includes("pricing") || intentLower.includes("cost") || intentLower.includes("quote")) {
        suggestionsList.push({
          id: `sug-price-${cust._id}`,
          customerId: cust._id,
          title: `Provide Pricing Tiers to ${cust.name}`,
          description: `Customer enquired about pricing. Share detailed packages and tier discounts.`,
          actionLabel: "Send Quote",
          icon: IoMailOutline,
          iconColor: "text-blue-400 bg-blue-500/10 border-blue-500/25",
          urgency: 2
        });
      }

      // Rule 4: Negative Sentiment Support
      else if (sentimentLower === "negative") {
        suggestionsList.push({
          id: `sug-support-${cust._id}`,
          customerId: cust._id,
          title: `Resolve Objections with ${cust.name}`,
          description: `Negative sentiment detected. Prioritize empathetic response to retain customer interest.`,
          actionLabel: "Support Chat",
          icon: IoWarningOutline,
          iconColor: "text-amber-400 bg-amber-500/10 border-amber-500/25",
          urgency: 3
        });
      }

      // Rule 5: Positive Sentiment Demo
      else if (sentimentLower === "positive" && cust.leadStatus === "Warm") {
        suggestionsList.push({
          id: `sug-demo-${cust._id}`,
          customerId: cust._id,
          title: `Book Product Demo with ${cust.name}`,
          description: `Warm lead with positive sentiment. Propose a short walkthrough of ${cust.recommendedProduct || 'the product'}.`,
          actionLabel: "Book Demo",
          icon: IoPeopleOutline,
          iconColor: "text-purple-400 bg-purple-500/10 border-purple-500/25",
          urgency: 2
        });
      }
    });

    // Fallback standard playbook recommendations if list has fewer items
    if (suggestionsList.length < 3) {
      suggestionsList.push({
        id: "sug-fallback-1",
        customerId: null,
        title: "Daily Pipeline Follow-Up",
        description: "Review all Warm leads who have had no activity in the last 24 hours.",
        actionLabel: "Review Leads",
        icon: IoChatbubblesOutline,
        iconColor: "text-whatsapp-teal bg-whatsapp-teal/10 border-whatsapp-teal/20",
        urgency: 1
      });
    }

    // Sort by urgency DESC and take top 4
    return suggestionsList.sort((a, b) => b.urgency - a.urgency).slice(0, 4);
  };

  const suggestions = generateSuggestions();

  return (
    <div className="bg-whatsapp-panel/90 backdrop-blur-sm border border-whatsapp-border/30 rounded-xl p-4 sm:p-5 shadow-sm h-full flex flex-col justify-between select-none">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-whatsapp-border/15 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-whatsapp-teal/15 text-whatsapp-green border border-whatsapp-green/20">
              <IoFlashOutline className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-whatsapp-text">AI Sales Playbook Actions</h3>
              <p className="text-[10px] text-whatsapp-gray">Recommended next actions to maximize conversion</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-whatsapp-input text-whatsapp-gray border border-whatsapp-border/20">
            {suggestions.length} recommendations
          </span>
        </div>
        
        {/* Content */}
        {loading ? (
          <div className="space-y-2 py-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-whatsapp-input/30 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-8 text-whatsapp-gray text-xs">
            No playbook actions needed right now.
          </div>
        ) : (
          <div className="space-y-2.5">
            {suggestions.map((sug) => {
              const Icon = sug.icon;
              return (
                <div 
                  key={sug.id} 
                  className="p-3 bg-whatsapp-input/30 border border-whatsapp-border/20 rounded-xl hover:border-whatsapp-teal/40 hover:bg-whatsapp-input/50 transition-all duration-200 flex items-center justify-between gap-3"
                >
                  <div className="flex items-start space-x-3 text-xs min-w-0">
                    <div className={`p-2 rounded-lg flex-shrink-0 border ${sug.iconColor} mt-0.5`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-whatsapp-text font-bold truncate text-xs">{sug.title}</div>
                      <div className="text-whatsapp-gray text-[11px] leading-relaxed mt-0.5 line-clamp-2">{sug.description}</div>
                    </div>
                  </div>

                  {sug.customerId && (
                    <button
                      onClick={() => handleOpenChat(sug.customerId)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-whatsapp-panel hover:bg-whatsapp-teal/20 text-whatsapp-green text-[11px] font-bold border border-whatsapp-border/30 hover:border-whatsapp-green/30 transition-all flex-shrink-0 cursor-pointer"
                    >
                      <span>{sug.actionLabel}</span>
                      <IoChevronForwardOutline className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
