import React from "react";
import CustomerAvatar from "../common/CustomerAvatar";
import { useCRM } from "../../context/CRMContext";
import { IoSparklesOutline, IoChatbubbleOutline } from "react-icons/io5";

export default function RecentInsights({ insights = [], loading = false }) {
  const { setActiveCustomerId, setActiveTab } = useCRM();

  const handleOpenChat = (customerId) => {
    if (!customerId) return;
    setActiveCustomerId(customerId);
    setActiveTab("chat");
  };

  const getStatusBadge = (status) => {
    const s = status || "Cold";
    if (s === "Hot") return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-red-500/15 text-red-400 rounded-full border border-red-500/25">🔥 Hot</span>;
    if (s === "Warm") return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-orange-500/15 text-orange-400 rounded-full border border-orange-500/25">⚡ Warm</span>;
    return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-blue-500/15 text-blue-400 rounded-full border border-blue-500/25">❄️ Cold</span>;
  };

  const getSentimentBadge = (sentiment) => {
    const s = (sentiment || "Neutral").toLowerCase();
    if (s === "positive") return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 rounded-full border border-emerald-500/25">Positive</span>;
    if (s === "negative") return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold bg-red-500/15 text-red-400 rounded-full border border-red-500/25">Negative</span>;
    return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold bg-whatsapp-input text-whatsapp-gray rounded-full border border-whatsapp-border/30">Neutral</span>;
  };

  const getPriorityBadge = (prio) => {
    const p = (prio || "Low").toLowerCase();
    if (p === "high") return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 rounded-full border border-red-500/30">High</span>;
    if (p === "medium") return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold bg-orange-500/15 text-orange-400 rounded-full border border-orange-500/25">Medium</span>;
    return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-whatsapp-input text-whatsapp-gray rounded-full border border-whatsapp-border/30">Low</span>;
  };

  return (
    <div className="bg-whatsapp-panel/90 backdrop-blur-sm border border-whatsapp-border/30 rounded-xl p-4 sm:p-5 shadow-sm select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-whatsapp-border/15 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-whatsapp-teal/15 text-whatsapp-green border border-whatsapp-green/20">
            <IoSparklesOutline className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-whatsapp-text">Recent AI Conversation Insights</h3>
            <p className="text-[10px] text-whatsapp-gray">Live structured extraction from WhatsApp customer interactions</p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-whatsapp-gray bg-whatsapp-input px-2.5 py-1 rounded-full border border-whatsapp-border/20">
          Top {insights.length} active
        </span>
      </div>
      
      {/* Content */}
      {loading ? (
        <div className="space-y-3 py-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-whatsapp-input/30 rounded-lg animate-pulse"></div>
          ))}
        </div>
      ) : (!insights || insights.length === 0) ? (
        <div className="text-center py-12 text-whatsapp-gray text-xs">
          <div className="w-10 h-10 rounded-full bg-whatsapp-input/50 flex items-center justify-center text-whatsapp-gray mx-auto mb-2">
            <IoSparklesOutline className="w-5 h-5 opacity-60" />
          </div>
          <p className="font-semibold text-whatsapp-text">No AI Insights Generated Yet</p>
          <p className="text-[10px] text-whatsapp-gray max-w-sm mx-auto mt-1">
            When customers message your WhatsApp Business number, Gemini automatically extracts score, intent, and recommendations.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-whatsapp-border/15 text-whatsapp-gray font-semibold text-[11px]">
                <th className="pb-3 font-medium">Customer</th>
                <th className="pb-3 font-medium text-center">Score</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Intent</th>
                <th className="pb-3 font-medium">Sentiment</th>
                <th className="pb-3 font-medium text-center">Priority</th>
                <th className="pb-3 font-medium">Prob.</th>
                <th className="pb-3 font-medium">Recommended Product</th>
                <th className="pb-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-whatsapp-border/10 text-whatsapp-text">
              {insights.map((insight, index) => {
                const prob = insight.purchaseProbability ?? 0;
                return (
                  <tr 
                    key={insight._id || index} 
                    className="hover:bg-whatsapp-input/20 transition-colors group cursor-pointer"
                    onClick={() => handleOpenChat(insight._id)}
                  >
                    {/* Customer Profile */}
                    <td className="py-3 pr-2">
                      <div className="flex items-center space-x-2.5">
                        <CustomerAvatar 
                          name={insight.name} 
                          profilePicture={insight.profilePicture} 
                          size="sm"
                        />
                        <div className="min-w-0">
                          <span className="font-semibold text-whatsapp-text group-hover:text-whatsapp-green transition-colors truncate block">
                            {insight.name}
                          </span>
                          <span className="text-[10px] text-whatsapp-gray font-mono">{insight.phone || ""}</span>
                        </div>
                      </div>
                    </td>

                    {/* Lead Score */}
                    <td className="py-3 text-center">
                      <span className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded ${
                        (insight.leadScore ?? 0) >= 80 
                          ? "bg-red-500/15 text-red-400 border border-red-500/30" 
                          : (insight.leadScore ?? 0) >= 50 
                            ? "bg-orange-500/15 text-orange-400" 
                            : "bg-blue-500/15 text-blue-400"
                      }`}>
                        {insight.leadScore ?? 0}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 whitespace-nowrap">
                      {getStatusBadge(insight.leadStatus)}
                    </td>

                    {/* Intent */}
                    <td className="py-3">
                      <span className="font-medium text-whatsapp-text bg-whatsapp-input/50 px-2 py-0.5 rounded border border-whatsapp-border/20 text-[11px] truncate max-w-[120px] inline-block">
                        {insight.intent || "General Inquiry"}
                      </span>
                    </td>

                    {/* Sentiment */}
                    <td className="py-3 whitespace-nowrap">
                      {getSentimentBadge(insight.sentiment)}
                    </td>

                    {/* Priority */}
                    <td className="py-3 text-center whitespace-nowrap">
                      {getPriorityBadge(insight.priority)}
                    </td>

                    {/* Probability Progress Bar */}
                    <td className="py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 w-24">
                        <div className="flex-1 bg-whatsapp-input rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-whatsapp-green h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(prob, 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-whatsapp-gray font-bold">{prob}%</span>
                      </div>
                    </td>

                    {/* Recommended Product */}
                    <td className="py-3 truncate max-w-[150px]">
                      {insight.recommendedProduct ? (
                        <span className="text-[11px] text-whatsapp-green bg-whatsapp-teal/10 border border-whatsapp-green/20 px-2 py-0.5 rounded truncate inline-block">
                          {insight.recommendedProduct}
                        </span>
                      ) : (
                        <span className="text-[11px] text-whatsapp-gray italic">None</span>
                      )}
                    </td>

                    {/* Open Chat Action */}
                    <td className="py-3 text-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenChat(insight._id);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-whatsapp-green hover:bg-whatsapp-teal/20 rounded-lg border border-whatsapp-green/20 transition-all cursor-pointer"
                      >
                        <IoChatbubbleOutline className="w-3.5 h-3.5" />
                        <span>Chat</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
