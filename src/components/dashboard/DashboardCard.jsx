import React from "react";

export default function DashboardCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendType,
  subtext
}) {
  const isPositive = trendType === "positive";
  const isHot = trendType === "hot";

  return (
    <div className="bg-whatsapp-panel border border-whatsapp-border/30 rounded-lg p-4 flex flex-col justify-between select-none">
      {/* Top row: Title and Subtle Icon */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-medium text-whatsapp-gray uppercase tracking-wider truncate">
          {title}
        </span>
        {Icon && (
          <Icon className="w-4 h-4 text-whatsapp-gray flex-shrink-0" />
        )}
      </div>
      
      {/* Middle row: Primary Metric */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold text-whatsapp-text font-sans tracking-tight">
          {value !== undefined && value !== null ? value : "0"}
        </span>
        {trend && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
            isHot
              ? 'bg-red-500/15 text-red-400'
              : isPositive 
                ? 'bg-emerald-500/15 text-emerald-400' 
                : 'bg-whatsapp-sidebar text-whatsapp-gray'
          }`}>
            {trend}
          </span>
        )}
      </div>

      {/* Subtext description if available */}
      {subtext && (
        <div className="text-[11px] text-whatsapp-gray/70 truncate pt-2 mt-2 border-t border-whatsapp-border/20">
          {subtext}
        </div>
      )}
    </div>
  );
}
