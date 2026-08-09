import React, { useState, useEffect } from "react";
import { IoRefreshOutline } from "react-icons/io5";

export default function DashboardHeader({ onRefresh, loading, refreshing, lastUpdated }) {
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
        " • " +
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isSpinning = loading || refreshing;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-whatsapp-border/30 gap-3 select-none">
      {/* Title & Overview */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-whatsapp-text tracking-tight">
            AI WhatsApp Assistant
          </h1>
          <span className="text-xs px-2 py-0.5 rounded bg-whatsapp-panel text-whatsapp-gray border border-whatsapp-border/20">
            Overview
          </span>
        </div>
        <p className="text-xs text-whatsapp-gray mt-0.5">
          Real-time WhatsApp customer conversations, lead evaluation, and sales insights.
        </p>
      </div>

      {/* Controls & Actions */}
      <div className="flex items-center gap-2.5 self-start sm:self-auto">
        {/* Status / Timestamp indicator */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-whatsapp-panel border border-whatsapp-border/20 text-[11px] text-whatsapp-gray">
          <span className="w-2 h-2 rounded-full bg-whatsapp-green"></span>
          <span className="font-mono text-whatsapp-text">{currentTime || "Live"}</span>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          disabled={isSpinning}
          aria-label="Refresh Dashboard"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-whatsapp-teal hover:bg-whatsapp-green text-whatsapp-dark font-medium text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <IoRefreshOutline className={`w-3.5 h-3.5 ${isSpinning ? "animate-spin" : ""}`} />
          <span>{isSpinning ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>
    </div>
  );
}
