import React, { useState } from "react";
import { 
  IoFlame, 
  IoSparkles, 
  IoSparklesOutline, 
  IoRibbonOutline, 
  IoFolderOpenOutline, 
  IoHelpCircleOutline, 
  IoPulseOutline, 
  IoChevronForward, 
  IoChevronBack, 
  IoTimeOutline, 
  IoFlashOutline, 
  IoCopyOutline, 
  IoCheckmarkOutline, 
  IoCallOutline, 
  IoCardOutline, 
  IoMailOutline, 
  IoWarningOutline,
  IoPersonOutline
} from "react-icons/io5";
import CustomerAvatar from "../common/CustomerAvatar";

export default function IntelligencePanel({ customer, isOpen, onToggle }) {
  const [copied, setCopied] = useState(false);

  if (!customer) return null;

  const leadScore = customer.leadScore ?? 0;
  const purchaseProb = customer.purchaseProbability ?? 0;
  const intent = customer.intent || "General Inquiry";
  const sentiment = customer.sentiment || "Neutral";
  const priority = customer.priority || "Low";
  const status = customer.leadStatus || "Cold";

  const getStatusBadge = (s) => {
    if (s === "Hot") return <span className="px-2.5 py-0.5 text-xs font-extrabold bg-red-500/15 text-red-400 rounded-full border border-red-500/30 flex items-center gap-1 shadow-sm">🔥 Hot Lead</span>;
    if (s === "Warm") return <span className="px-2.5 py-0.5 text-xs font-extrabold bg-orange-500/15 text-orange-400 rounded-full border border-orange-500/30 flex items-center gap-1 shadow-sm">⚡ Warm Lead</span>;
    return <span className="px-2.5 py-0.5 text-xs font-extrabold bg-blue-500/15 text-blue-400 rounded-full border border-blue-500/30 flex items-center gap-1 shadow-sm">❄️ Cold Lead</span>;
  };

  const getSentimentBadge = (sent) => {
    const s = sent.toLowerCase();
    if (s === "positive") return <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-500/15 text-emerald-400 rounded-full border border-emerald-500/30">Positive</span>;
    if (s === "negative") return <span className="px-2.5 py-0.5 text-xs font-bold bg-red-500/15 text-red-400 rounded-full border border-red-500/30">Negative</span>;
    return <span className="px-2.5 py-0.5 text-xs font-bold bg-whatsapp-input text-whatsapp-gray rounded-full border border-whatsapp-border/30">Neutral</span>;
  };

  const getPriorityBadge = (prio) => {
    const p = prio.toLowerCase();
    if (p === "high") return <span className="px-2.5 py-0.5 text-xs font-bold bg-red-500/15 text-red-400 rounded-full border border-red-500/30">High Priority</span>;
    if (p === "medium") return <span className="px-2.5 py-0.5 text-xs font-bold bg-orange-500/15 text-orange-400 rounded-full border border-orange-500/30">Medium Priority</span>;
    return <span className="px-2.5 py-0.5 text-xs font-bold bg-whatsapp-input text-whatsapp-gray rounded-full border border-whatsapp-border/30">Low Priority</span>;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "Just now";
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " • " + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Determine Recommended Next Action from customer data
  const getRecommendedAction = () => {
    const intentLower = intent.toLowerCase();
    const sentimentLower = sentiment.toLowerCase();

    if (status === "Hot" && purchaseProb >= 75) {
      return {
        title: "Follow up immediately",
        subtitle: "Customer is primed to buy with strong purchase intent.",
        advice: "Send direct payment / checkout link or initiate phone closing call.",
        icon: IoFlashOutline,
        color: "text-red-400 bg-red-500/15 border-red-500/30",
        badge: "Highest Impact"
      };
    }

    if (intentLower.includes("price") || intentLower.includes("pricing") || intentLower.includes("cost") || intentLower.includes("quote")) {
      return {
        title: "Send pricing / checkout details",
        subtitle: "Pricing inquiry identified in message exchange.",
        advice: "Share the customized pricing tier breakdown and offer immediate trial access.",
        icon: IoCardOutline,
        color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
        badge: "Commercial"
      };
    }

    if (intentLower.includes("demo") || (sentimentLower === "positive" && status === "Warm")) {
      return {
        title: "Schedule a product demo",
        subtitle: "Customer showed high curiosity in feature capabilities.",
        advice: "Propose a quick 15-min live walkthrough tailored to their workflow.",
        icon: IoCallOutline,
        color: "text-purple-400 bg-purple-500/15 border-purple-500/30",
        badge: "Demo Request"
      };
    }

    if (sentimentLower === "negative") {
      return {
        title: "Prioritize support follow-up",
        subtitle: "Friction or negative sentiment detected in conversation.",
        advice: "Address concerns with empathy, clarify requirements and offer support guarantee.",
        icon: IoWarningOutline,
        color: "text-amber-400 bg-amber-500/15 border-amber-500/30",
        badge: "Escalation"
      };
    }

    if (status === "Warm") {
      return {
        title: "Follow up today",
        subtitle: "Active evaluation stage. Don't let momentum cool down.",
        advice: "Send case study or highlight key advantages of the recommended solution.",
        icon: IoMailOutline,
        color: "text-cyan-400 bg-cyan-500/15 border-cyan-500/30",
        badge: "Nurture"
      };
    }

    return {
      title: "Nurture lead",
      subtitle: "Early discovery phase with standard interest level.",
      advice: "Share product catalog overview and invite them to ask specific questions.",
      icon: IoPersonOutline,
      color: "text-whatsapp-teal bg-whatsapp-teal/15 border-whatsapp-green/30",
      badge: "Discovery"
    };
  };

  const action = getRecommendedAction();
  const ActionIcon = action.icon;

  const handleCopySummary = () => {
    if (!customer.summary) return;
    navigator.clipboard.writeText(customer.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`relative flex h-full transition-all duration-300 ${
      isOpen ? "w-[310px] md:w-[330px] lg:w-[360px]" : "w-0"
    } flex-shrink-0 bg-whatsapp-sidebar border-l border-whatsapp-border/40 overflow-hidden`}>
      
      {/* Collapse Handle Tab */}
      <button
        onClick={onToggle}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[24px] z-20 flex items-center justify-center w-6 h-12 rounded-l-lg bg-whatsapp-sidebar border border-r-0 border-whatsapp-border/40 text-whatsapp-gray hover:text-white hover:bg-whatsapp-panel transition-all shadow-md"
        title={isOpen ? "Collapse Intelligence Panel" : "Expand Intelligence Panel"}
      >
        {isOpen ? <IoChevronForward className="w-4 h-4" /> : <IoChevronBack className="w-4 h-4" />}
      </button>

      {/* Main Panel Content Container */}
      <div className="flex flex-col w-full h-full p-4 sm:p-5 overflow-y-auto select-none space-y-4">
        
        {/* Panel Title */}
        <div className="flex items-center justify-between pb-3 border-b border-whatsapp-border/20 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-whatsapp-teal/15 text-whatsapp-green border border-whatsapp-green/20">
              <IoSparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xs font-extrabold text-whatsapp-text uppercase tracking-wider">Customer Intelligence</h2>
              <p className="text-[10px] text-whatsapp-gray">Gemini AI Conversation Insights</p>
            </div>
          </div>
          {getStatusBadge(status)}
        </div>

        {/* Customer Profile Card */}
        <div className="bg-whatsapp-panel/80 border border-whatsapp-border/30 rounded-xl p-3.5 shadow-sm">
          <div className="flex items-center space-x-3">
            <CustomerAvatar
              name={customer.name}
              profilePicture={customer.profilePicture}
              online={customer.online}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-whatsapp-text truncate">
                {customer.name}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-whatsapp-gray font-mono mt-0.5">
                <span>{customer.phone || "WhatsApp User"}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-whatsapp-green mt-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-whatsapp-green animate-pulse"></span>
                <span>{customer.online ? "Online Now" : customer.lastSeen || "Active Lead"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RECOMMENDED NEXT ACTION - PROMINENT PLAYBOOK SECTION */}
        <div className="bg-gradient-to-br from-whatsapp-panel via-whatsapp-panel/95 to-whatsapp-input border border-whatsapp-green/30 rounded-xl p-3.5 shadow-lg relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-whatsapp-green/5 rounded-full blur-xl pointer-events-none"></div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold text-whatsapp-green uppercase tracking-wider flex items-center gap-1.5">
              <IoFlashOutline className="w-3.5 h-3.5" /> Recommended Next Action
            </span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${action.color}`}>
              {action.badge}
            </span>
          </div>

          <div className="flex items-start space-x-2.5">
            <div className={`p-2 rounded-lg border ${action.color} flex-shrink-0 mt-0.5`}>
              <ActionIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-whatsapp-text">{action.title}</h4>
              <p className="text-[11px] text-whatsapp-gray leading-tight mt-0.5">{action.subtitle}</p>
              <div className="mt-2 p-2 bg-whatsapp-input/60 rounded-lg border border-whatsapp-border/30 text-[10px] text-whatsapp-text font-medium leading-relaxed">
                👉 {action.advice}
              </div>
            </div>
          </div>
        </div>

        {/* Lead Score & Purchase Probability Dual Meters */}
        <div className="grid grid-cols-2 gap-3">
          {/* Lead Score */}
          <div className="bg-whatsapp-panel/80 border border-whatsapp-border/30 rounded-xl p-3 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-bold text-whatsapp-gray uppercase tracking-wider mb-1">
              <span className="flex items-center gap-1 text-red-400"><IoFlame /> Score</span>
              <span className={`font-mono font-extrabold text-xs ${
                leadScore >= 80 ? "text-red-400" : leadScore >= 50 ? "text-orange-400" : "text-blue-400"
              }`}>
                {leadScore}/100
              </span>
            </div>
            <div className="w-full bg-whatsapp-input rounded-full h-2 overflow-hidden my-1">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  leadScore >= 80 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : leadScore >= 50 ? "bg-orange-500" : "bg-blue-500"
                }`}
                style={{ width: `${leadScore}%` }}
              />
            </div>
            <span className="text-[9px] text-whatsapp-gray text-right font-medium">
              {leadScore >= 80 ? "🔥 Hot Ready" : leadScore >= 50 ? "⚡ Evaluating" : "❄️ Early"}
            </span>
          </div>

          {/* Purchase Probability */}
          <div className="bg-whatsapp-panel/80 border border-whatsapp-border/30 rounded-xl p-3 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-bold text-whatsapp-gray uppercase tracking-wider mb-1">
              <span className="flex items-center gap-1 text-emerald-400"><IoRibbonOutline /> Prob.</span>
              <span className="font-mono font-extrabold text-xs text-whatsapp-green">
                {purchaseProb}%
              </span>
            </div>
            <div className="w-full bg-whatsapp-input rounded-full h-2 overflow-hidden my-1">
              <div 
                className="h-full bg-whatsapp-green rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(37,211,102,0.4)]"
                style={{ width: `${purchaseProb}%` }}
              />
            </div>
            <span className="text-[9px] text-whatsapp-gray text-right font-medium">
              {purchaseProb >= 70 ? "High Close" : purchaseProb >= 40 ? "Moderate" : "Low"}
            </span>
          </div>
        </div>

        {/* Intent, Sentiment, Priority Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-whatsapp-panel/80 border border-whatsapp-border/30 rounded-xl p-2.5">
            <div className="text-[9px] text-whatsapp-gray uppercase tracking-wider mb-1 flex items-center gap-1">
              <IoHelpCircleOutline /> Intent
            </div>
            <div className="text-xs font-bold text-whatsapp-text truncate">
              {intent}
            </div>
          </div>

          <div className="bg-whatsapp-panel/80 border border-whatsapp-border/30 rounded-xl p-2.5">
            <div className="text-[9px] text-whatsapp-gray uppercase tracking-wider mb-1 flex items-center gap-1">
              <IoPulseOutline /> Sentiment
            </div>
            <div>{getSentimentBadge(sentiment)}</div>
          </div>

          <div className="bg-whatsapp-panel/80 border border-whatsapp-border/30 rounded-xl p-2.5 col-span-2 flex items-center justify-between">
            <span className="text-[10px] text-whatsapp-gray uppercase tracking-wider font-semibold">Priority Level</span>
            <span>{getPriorityBadge(priority)}</span>
          </div>
        </div>

        {/* Recommended Product Highlight */}
        {customer.recommendedProduct && (
          <div className="bg-whatsapp-panel/80 border border-whatsapp-border/30 rounded-xl p-3">
            <div className="text-[10px] text-whatsapp-gray uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <IoFolderOpenOutline className="text-whatsapp-teal" /> Recommended Product Match
            </div>
            <div className="text-xs font-bold text-whatsapp-green bg-whatsapp-teal/10 border border-whatsapp-green/25 px-3 py-2 rounded-lg flex items-center justify-between">
              <span className="truncate">{customer.recommendedProduct}</span>
              <span className="text-[10px] text-whatsapp-gray font-normal">AI Match</span>
            </div>
          </div>
        )}

        {/* AI Conversation Summary */}
        {customer.summary && (
          <div className="bg-whatsapp-panel/80 border border-whatsapp-border/30 rounded-xl p-3.5 relative">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-whatsapp-gray uppercase tracking-wider flex items-center gap-1">
                <IoSparklesOutline className="text-whatsapp-green" /> AI Conversation Summary
              </span>
              <button 
                onClick={handleCopySummary}
                className="text-whatsapp-gray hover:text-white transition-colors"
                title="Copy summary"
              >
                {copied ? <IoCheckmarkOutline className="w-3.5 h-3.5 text-whatsapp-green" /> : <IoCopyOutline className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-xs leading-relaxed text-whatsapp-gray italic bg-whatsapp-input/50 p-2.5 rounded-lg border border-whatsapp-border/20">
              "{customer.summary}"
            </p>
          </div>
        )}

        {/* Last Analyzed Timestamp */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-whatsapp-gray pt-2 border-t border-whatsapp-border/10">
          <IoTimeOutline className="w-3.5 h-3.5" />
          <span>Last Analyzed: {formatTime(customer.updatedAt)}</span>
        </div>

      </div>

    </div>
  );
}
