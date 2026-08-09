import React from "react";
import { IoSparklesOutline, IoLogoWhatsapp, IoServerOutline, IoShieldCheckmarkOutline } from "react-icons/io5";

export default function DashboardFooter({ lastUpdated }) {
  return (
    <div className="mt-8 pt-4 border-t border-whatsapp-border/20 flex flex-col sm:flex-row items-center justify-between text-[11px] text-whatsapp-gray gap-3 select-none">
      
      {/* Service Status Indicators */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-1.5 text-emerald-400">
          <IoSparklesOutline className="animate-pulse" /> 
          <span className="text-whatsapp-gray">Gemini 3.5 AI:</span> <span className="font-semibold text-emerald-400">Active</span>
        </span>
        <span className="flex items-center gap-1.5 text-whatsapp-green">
          <IoLogoWhatsapp /> 
          <span className="text-whatsapp-gray">WhatsApp Cloud API:</span> <span className="font-semibold text-whatsapp-green">Online</span>
        </span>
        <span className="flex items-center gap-1.5 text-cyan-400">
          <IoServerOutline /> 
          <span className="text-whatsapp-gray">Database:</span> <span className="font-semibold text-cyan-400">MongoDB Atlas</span>
        </span>
        <span className="hidden md:flex items-center gap-1 text-whatsapp-gray/70">
          <IoShieldCheckmarkOutline className="text-whatsapp-teal" /> 
          <span>End-to-End Encrypted</span>
        </span>
      </div>

      {/* Version & Sync Stamp */}
      <div className="flex items-center gap-3">
        <span className="bg-whatsapp-panel px-2.5 py-1 rounded-md border border-whatsapp-border/20 font-mono text-[10px] text-whatsapp-text">
          SalesPilot-AI v1.2 (Hackathon Edition)
        </span>
        {lastUpdated && (
          <span className="font-mono text-[10px] text-whatsapp-gray">
            Synced: {lastUpdated}
          </span>
        )}
      </div>

    </div>
  );
}
