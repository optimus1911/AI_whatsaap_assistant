import React, { useState, useEffect } from "react";
import { IoRefreshOutline, IoSparklesOutline, IoRadioOutline } from "react-icons/io5";

export default function DashboardHeader({ onRefresh, loading, refreshing, lastUpdated }) {
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
        " • " +
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isSpinning = loading || refreshing;

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-5 border-b border-whatsapp-border/30 gap-4 select-none">
      
      {/* Title & Subtitle */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl lg:text-3xl font-extrabold text-whatsapp-text tracking-tight flex items-center gap-2">
            Sales Intelligence
          </h1>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-whatsapp-teal/15 text-whatsapp-green border border-whatsapp-green/25 shadow-sm">
            <IoSparklesOutline className="w-3.5 h-3.5 animate-pulse text-whatsapp-green" />
            <span>AI Analytics Engine</span>
          </span>
        </div>
        <p className="text-xs text-whatsapp-gray max-w-xl leading-relaxed">
          Real-time conversation intelligence, predictive lead scoring & automated CRM insights from WhatsApp Business.
        </p>
      </div>

      {/* Controls & Status Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Live Sync Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-whatsapp-panel/80 border border-whatsapp-border/30 text-[11px] text-whatsapp-gray shadow-inner">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-whatsapp-green opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-whatsapp-green"></span>
          </span>
          <span className="font-medium text-whatsapp-text">Live Sync</span>
          <span className="text-whatsapp-gray/60">|</span>
          <span className="font-mono text-[10px] text-whatsapp-gray">{currentTime || "Active"}</span>
        </div>

        {/* Last Updated Badge */}
        {lastUpdated && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-whatsapp-panel border border-whatsapp-border/25 text-[11px] text-whatsapp-gray">
            <span>Updated:</span>
            <span className="font-mono font-semibold text-whatsapp-text">{lastUpdated}</span>
          </div>
        )}

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isSpinning}
          aria-label="Refresh Dashboard"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-whatsapp-teal hover:bg-whatsapp-green text-whatsapp-dark font-bold text-xs rounded-lg transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <IoRefreshOutline className={`w-4 h-4 ${isSpinning ? "animate-spin" : ""}`} />
          <span>{isSpinning ? "Updating..." : "Refresh"}</span>
        </button>
      </div>

    </div>
  );
}
