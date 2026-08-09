import React from "react";
import { IoFlameOutline } from "react-icons/io5";

export default function LeadStatusList({ data = [], loading = false }) {
  const hasData = Array.isArray(data) && data.some(d => (d.value || 0) > 0);
  const totalLeads = hasData ? data.reduce((acc, curr) => acc + (curr.value || 0), 0) : 0;

  // Find counts for Hot, Warm, Cold
  const hotCount = data.find(d => d.name === "Hot")?.value || 0;
  const warmCount = data.find(d => d.name === "Warm")?.value || 0;
  const coldCount = data.find(d => d.name === "Cold")?.value || 0;

  const maxVal = Math.max(hotCount, warmCount, coldCount, 1);

  const items = [
    { name: "Hot", count: hotCount, color: "bg-red-500", textColor: "text-red-400", bgTrack: "bg-red-500/10" },
    { name: "Warm", count: warmCount, color: "bg-orange-500", textColor: "text-orange-400", bgTrack: "bg-orange-500/10" },
    { name: "Cold", count: coldCount, color: "bg-blue-500", textColor: "text-blue-400", bgTrack: "bg-blue-500/10" }
  ];

  return (
    <div className="bg-whatsapp-panel border border-whatsapp-border/30 rounded-lg p-4 sm:p-5 flex flex-col justify-between select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-whatsapp-border/20 mb-4">
        <div className="flex items-center gap-2">
          <IoFlameOutline className="w-4 h-4 text-whatsapp-gray" />
          <h3 className="text-xs sm:text-sm font-semibold text-whatsapp-text">Lead Status</h3>
        </div>
        {hasData && (
          <span className="text-[11px] font-mono text-whatsapp-gray">
            {totalLeads} total
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8 gap-2">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-whatsapp-green border-t-transparent"></div>
          <span className="text-xs text-whatsapp-gray">Loading leads...</span>
        </div>
      ) : !hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <p className="text-xs text-whatsapp-gray">No lead data recorded yet</p>
        </div>
      ) : (
        <div className="space-y-4 my-auto">
          {items.map((item) => {
            const pct = totalLeads > 0 ? Math.round((item.count / totalLeads) * 100) : 0;
            const barWidth = totalLeads > 0 ? Math.max((item.count / maxVal) * 100, item.count > 0 ? 6 : 0) : 0;

            return (
              <div key={item.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-whatsapp-text w-12">{item.name}</span>
                  <div className="flex-1 mx-3 bg-whatsapp-sidebar rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 w-14 text-right">
                    <span className="font-mono font-semibold text-whatsapp-text">{item.count}</span>
                    <span className="text-[10px] text-whatsapp-gray font-mono">({pct}%)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
