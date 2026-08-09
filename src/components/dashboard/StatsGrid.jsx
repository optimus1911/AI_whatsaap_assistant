import React from "react";
import { 
  IoPeopleOutline, 
  IoChatbubblesOutline, 
  IoFlameOutline, 
  IoAnalyticsOutline, 
  IoCashOutline, 
  IoHappyOutline 
} from "react-icons/io5";
import DashboardCard from "./DashboardCard";

export default function StatsGrid({ stats = {} }) {
  const totalCustomers = stats.totalCustomers ?? 0;
  const totalMessages = stats.totalMessages ?? 0;
  const hotLeads = stats.hotLeads ?? 0;
  const avgLeadScore = stats.averageLeadScore ?? 0;
  const avgPurchaseProb = stats.averagePurchaseProbability ?? 0;
  const positiveSentiment = stats.positiveSentiment ?? 0;
  const todayMessages = stats.todayMessages ?? 0;

  const sentimentRatio = totalCustomers > 0 
    ? Math.round((positiveSentiment / totalCustomers) * 100) 
    : 0;

  const cards = [
    {
      title: "Total Customers",
      value: totalCustomers,
      icon: IoPeopleOutline,
      trend: "+12 Active",
      trendType: "positive",
      subtext: "Synced via WhatsApp CRM",
      accentColor: "teal"
    },
    {
      title: "Total Messages",
      value: totalMessages,
      icon: IoChatbubblesOutline,
      trend: todayMessages > 0 ? `+${todayMessages} today` : "Live feed",
      trendType: "positive",
      subtext: "Processed by AI engine",
      accentColor: "blue"
    },
    {
      title: "Hot Leads",
      value: hotLeads,
      icon: IoFlameOutline,
      trend: hotLeads > 0 ? "🔥 Urgent Action" : "0 Pending",
      trendType: hotLeads > 0 ? "hot" : "neutral",
      subtext: "High buying readiness",
      accentColor: "red"
    },
    {
      title: "Avg Lead Score",
      value: `${avgLeadScore}/100`,
      icon: IoAnalyticsOutline,
      trend: avgLeadScore >= 70 ? "High Quality" : "Moderate",
      trendType: avgLeadScore >= 70 ? "positive" : "neutral",
      subtext: "Dynamic AI evaluation",
      accentColor: "purple"
    },
    {
      title: "Purchase Prob.",
      value: `${avgPurchaseProb}%`,
      icon: IoCashOutline,
      trend: avgPurchaseProb >= 50 ? "Strong Pipeline" : "Standard",
      trendType: avgPurchaseProb >= 50 ? "positive" : "neutral",
      subtext: "Predicted deal closure",
      accentColor: "teal"
    },
    {
      title: "Positive Sentiment",
      value: positiveSentiment,
      icon: IoHappyOutline,
      trend: `${sentimentRatio}% overall`,
      trendType: "positive",
      subtext: `${positiveSentiment} happy customer dialogues`,
      accentColor: "amber"
    }
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">
      {cards.map((card, idx) => (
        <DashboardCard
          key={idx}
          title={card.title}
          value={card.value}
          icon={card.icon}
          trend={card.trend}
          trendType={card.trendType}
          subtext={card.subtext}
          accentColor={card.accentColor}
        />
      ))}
    </div>
  );
}
