import React, { useState } from "react";
import { 
  IoChevronForward, 
  IoChevronBack, 
  IoCopyOutline, 
  IoCheckmarkOutline
} from "react-icons/io5";
import CustomerAvatar from "../common/CustomerAvatar";

export default function IntelligencePanel({ customer, isOpen, onToggle }) {
  const [copied, setCopied] = useState(false);

  if (!customer) return null;

  const leadScore = customer.leadScore ?? 0;
  const purchaseProb = customer.purchaseProbability ?? 0;
  const intent = customer.intent || "General enquiry";
  const sentiment = customer.sentiment || "Neutral";
  const priority = customer.priority || "Standard";
  const status = customer.leadStatus || "Cold";

  const getStatusBadge = (s) => {
    if (s === "Hot") return <span className="px-2 py-0.5 text-xs font-semibold bg-red-500/15 text-red-400 rounded">Hot</span>;
    if (s === "Warm") return <span className="px-2 py-0.5 text-xs font-semibold bg-orange-500/15 text-orange-400 rounded">Warm</span>;
    return <span className="px-2 py-0.5 text-xs font-semibold bg-blue-500/15 text-blue-400 rounded">Cold</span>;
  };

  const copyPhone = () => {
    if (customer.phone) {
      navigator.clipboard.writeText(customer.phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-whatsapp-sidebar border-l border-whatsapp-border/30 transition-all duration-300 select-none ${
      isOpen ? "w-72 sm:w-80" : "w-0"
    } overflow-hidden flex-shrink-0 relative`}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 bg-whatsapp-panel border-b border-whatsapp-border/30 flex-shrink-0">
        <span className="text-xs font-semibold text-whatsapp-text">Customer Details</span>
        <button
          onClick={onToggle}
          className="p-1 text-whatsapp-gray hover:text-white rounded hover:bg-whatsapp-sidebar transition-colors cursor-pointer"
          title="Close details"
        >
          <IoChevronForward className="w-4 h-4" />
        </button>
      </div>

      {/* Main Info Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Customer Profile Section */}
        <div className="flex items-center space-x-3 pb-3 border-b border-whatsapp-border/20">
          <CustomerAvatar
            profilePicture={customer.profilePicture}
            name={customer.name}
            online={customer.online}
            size="md"
          />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-whatsapp-text truncate">
              {customer.name || "Customer"}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-whatsapp-gray font-mono">
              <span className="truncate">{customer.phone || "No phone"}</span>
              {customer.phone && (
                <button
                  onClick={copyPhone}
                  className="hover:text-whatsapp-green transition-colors"
                  title="Copy Phone"
                >
                  {copied ? <IoCheckmarkOutline className="w-3.5 h-3.5 text-whatsapp-green" /> : <IoCopyOutline className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lead & Score Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 bg-whatsapp-panel border border-whatsapp-border/20 rounded">
            <span className="text-[10px] uppercase font-medium text-whatsapp-gray block mb-1">
              Lead Status
            </span>
            {getStatusBadge(status)}
          </div>

          <div className="p-2.5 bg-whatsapp-panel border border-whatsapp-border/20 rounded">
            <span className="text-[10px] uppercase font-medium text-whatsapp-gray block mb-1">
              Lead Score
            </span>
            <span className="text-sm font-mono font-bold text-whatsapp-text">
              {leadScore} <span className="text-xs font-normal text-whatsapp-gray">/ 100</span>
            </span>
          </div>
        </div>

        {/* Key Attributes List */}
        <div className="space-y-2.5 text-xs">
          <div className="p-2.5 bg-whatsapp-panel border border-whatsapp-border/20 rounded space-y-1">
            <span className="text-[10px] uppercase font-medium text-whatsapp-gray block">
              Current Intent
            </span>
            <span className="font-medium text-whatsapp-text">
              {intent}
            </span>
          </div>

          <div className="p-2.5 bg-whatsapp-panel border border-whatsapp-border/20 rounded space-y-1">
            <span className="text-[10px] uppercase font-medium text-whatsapp-gray block">
              Recommended Product
            </span>
            <span className="font-medium text-whatsapp-green">
              {customer.recommendedProduct || "General Catalog Match"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-whatsapp-panel border border-whatsapp-border/20 rounded space-y-0.5">
              <span className="text-[10px] uppercase font-medium text-whatsapp-gray block">
                Sentiment
              </span>
              <span className="font-medium text-whatsapp-text capitalize">
                {sentiment}
              </span>
            </div>

            <div className="p-2.5 bg-whatsapp-panel border border-whatsapp-border/20 rounded space-y-0.5">
              <span className="text-[10px] uppercase font-medium text-whatsapp-gray block">
                Purchase Prob.
              </span>
              <span className="font-mono font-bold text-whatsapp-text">
                {purchaseProb}%
              </span>
            </div>
          </div>
        </div>

        {/* Next Step / Guidance */}
        <div className="p-3 bg-whatsapp-panel border border-whatsapp-border/20 rounded space-y-1 text-xs">
          <span className="text-[10px] uppercase font-medium text-whatsapp-gray block">
            Suggested Action
          </span>
          <p className="text-whatsapp-text text-[11px] leading-relaxed">
            {status === "Hot"
              ? "High buying readiness. Provide price quotation or complete purchase link."
              : intent.toLowerCase().includes("price")
              ? "Share product specs and pricing comparison options."
              : "Assist with catalog browsing and feature recommendations."}
          </p>
        </div>
      </div>
    </div>
  );
}
