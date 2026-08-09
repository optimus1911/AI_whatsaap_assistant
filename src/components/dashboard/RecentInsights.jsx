import React from "react";
import CustomerAvatar from "../common/CustomerAvatar";
import { useCRM } from "../../context/CRMContext";
import { IoChatbubblesOutline } from "react-icons/io5";

export default function RecentInsights({ insights = [], loading = false }) {
  const { setActiveCustomerId, setActiveTab } = useCRM();

  const handleOpenChat = (customerId) => {
    if (!customerId) return;
    setActiveCustomerId(customerId);
    setActiveTab("chat");
  };

  const getStatusBadge = (status) => {
    const s = status || "Cold";
    if (s === "Hot") return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold bg-red-500/15 text-red-400 rounded">Hot</span>;
    if (s === "Warm") return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold bg-orange-500/15 text-orange-400 rounded">Warm</span>;
    return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold bg-blue-500/15 text-blue-400 rounded">Cold</span>;
  };

  const getSentimentBadge = (sentiment) => {
    const s = (sentiment || "Neutral").toLowerCase();
    if (s === "positive") return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-emerald-500/15 text-emerald-400 rounded">Positive</span>;
    if (s === "negative") return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-red-500/15 text-red-400 rounded">Negative</span>;
    return <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-whatsapp-sidebar text-whatsapp-gray rounded">Neutral</span>;
  };

  return (
    <div className="bg-whatsapp-panel border border-whatsapp-border/30 rounded-lg p-4 sm:p-5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-whatsapp-border/20 mb-3">
        <div className="flex items-center gap-2">
          <IoChatbubblesOutline className="w-4 h-4 text-whatsapp-gray" />
          <h3 className="text-xs sm:text-sm font-semibold text-whatsapp-text">Recent Conversations</h3>
        </div>
        {insights.length > 0 && (
          <span className="text-[11px] font-mono text-whatsapp-gray">
            {insights.length} active
          </span>
        )}
      </div>
      
      {/* Content Table */}
      {loading ? (
        <div className="space-y-2 py-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 bg-whatsapp-sidebar rounded animate-pulse"></div>
          ))}
        </div>
      ) : (!insights || insights.length === 0) ? (
        <div className="text-center py-8 text-whatsapp-gray text-xs">
          <p>No conversation insights recorded yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-whatsapp-border/20 text-whatsapp-gray font-medium text-[11px]">
                <th className="pb-2.5">Customer</th>
                <th className="pb-2.5">Intent</th>
                <th className="pb-2.5">Lead</th>
                <th className="pb-2.5 text-center">Score</th>
                <th className="pb-2.5">Sentiment</th>
                <th className="pb-2.5">Recommended</th>
                <th className="pb-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-whatsapp-border/10 text-whatsapp-text">
              {insights.map((insight, index) => {
                return (
                  <tr 
                    key={insight._id || index} 
                    className="hover:bg-whatsapp-sidebar/50 transition-colors cursor-pointer"
                    onClick={() => handleOpenChat(insight._id)}
                  >
                    {/* Customer Profile */}
                    <td className="py-2.5 pr-2">
                      <div className="flex items-center space-x-2">
                        <CustomerAvatar 
                          profilePicture={insight.profilePicture} 
                          name={insight.name} 
                          size="sm" 
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-whatsapp-text truncate max-w-[120px] sm:max-w-[150px]">
                            {insight.name}
                          </p>
                          <p className="text-[10px] text-whatsapp-gray font-mono truncate">
                            {insight.phone}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Detected Intent */}
                    <td className="py-2.5 pr-2">
                      <span className="text-whatsapp-gray truncate max-w-[120px] block">
                        {insight.intent || "General enquiry"}
                      </span>
                    </td>

                    {/* Lead Status */}
                    <td className="py-2.5 pr-2">
                      {getStatusBadge(insight.leadStatus)}
                    </td>

                    {/* Lead Score */}
                    <td className="py-2.5 pr-2 text-center font-mono font-semibold">
                      {insight.leadScore ?? 0}
                    </td>

                    {/* Sentiment */}
                    <td className="py-2.5 pr-2">
                      {getSentimentBadge(insight.sentiment)}
                    </td>

                    {/* Recommended Product */}
                    <td className="py-2.5 pr-2">
                      <span className="text-whatsapp-text font-medium truncate max-w-[130px] block">
                        {insight.recommendedProduct || "—"}
                      </span>
                    </td>

                    {/* Action Button */}
                    <td className="py-2.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenChat(insight._id);
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium bg-whatsapp-sidebar hover:bg-whatsapp-border/40 text-whatsapp-text rounded transition-colors"
                      >
                        Chat
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
