import React from "react";

export default function DashboardCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendType,
  subtext,
  accentColor = "teal"
}) {
  const isPositive = trendType === "positive";
  const isNegative = trendType === "negative";
  const isHot = trendType === "hot";

  const colorStyles = {
    teal: {
      iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      accentBorder: "hover:border-emerald-500/40",
      glow: "group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
    },
    blue: {
      iconBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      accentBorder: "hover:border-cyan-500/40",
      glow: "group-hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]"
    },
    red: {
      iconBg: "bg-red-500/10 text-red-400 border-red-500/20",
      accentBorder: "hover:border-red-500/40",
      glow: "group-hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]"
    },
    purple: {
      iconBg: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      accentBorder: "hover:border-purple-500/40",
      glow: "group-hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]"
    },
    amber: {
      iconBg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      accentBorder: "hover:border-amber-500/40",
      glow: "group-hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]"
    }
  };

  const style = colorStyles[accentColor] || colorStyles.teal;

  return (
    <div className={`group relative bg-whatsapp-panel/90 backdrop-blur-sm border border-whatsapp-border/30 rounded-xl p-4 transition-all duration-300 hover:-translate-y-1 shadow-sm ${style.accentBorder} ${style.glow} flex flex-col justify-between select-none`}>
      {/* Top row: Title and Icon */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[11px] font-bold text-whatsapp-gray uppercase tracking-wider truncate">
          {title}
        </span>
        {Icon && (
          <div className={`p-2 rounded-lg border ${style.iconBg} transition-transform duration-300 group-hover:scale-110 flex-shrink-0`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      
      {/* Middle row: Big Value */}
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-2xl lg:text-3xl font-extrabold text-whatsapp-text font-sans tracking-tight">
          {value !== undefined && value !== null ? value : "0"}
        </span>
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
            isHot
              ? 'bg-red-500/15 text-red-400 border-red-500/30 animate-pulse'
              : isPositive 
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                : isNegative 
                  ? 'bg-red-500/15 text-red-400 border-red-500/30' 
                  : 'bg-whatsapp-input/60 text-whatsapp-gray border-whatsapp-border/30'
          }`}>
            {trend}
          </span>
        )}
      </div>

      {/* Subtext description if available */}
      {subtext && (
        <div className="text-[10px] text-whatsapp-gray/80 truncate pt-1 border-t border-whatsapp-border/15">
          {subtext}
        </div>
      )}
    </div>
  );
}
