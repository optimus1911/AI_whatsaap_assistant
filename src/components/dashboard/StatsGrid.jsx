import React from "react";
import { 
  IoPeopleOutline, 
  IoChatbubblesOutline, 
  IoFlameOutline, 
  IoAnalyticsOutline
} from "react-icons/io5";
import DashboardCard from "./DashboardCard";

export default function StatsGrid({ stats = {} }) {
  const totalCustomers = stats.totalCustomers ?? 0;
  const totalMessages = stats.totalMessages ?? 0;
  const hotLeads = stats.hotLeads ?? 0;
  const avgLeadScore = stats.averageLeadScore ?? 0;
  const todayMessages = stats.todayMessages ?? 0;

  const cards = [
    {
      title: "Customers",
      value: totalCustomers.toLocaleString(),
      icon: IoPeopleOutline,
      trend: "Active",
      trendType: "positive",
      subtext: "Synced via WhatsApp CRM"
    },
    {
      title: "Messages",
      value: totalMessages.toLocaleString(),
      icon: IoChatbubblesOutline,
      trend: todayMessages > 0 ? `+${todayMessages} today` : "Live feed",
      trendType: "positive",
      subtext: "Processed by assistant"
    },
    {
      title: "Hot Leads",
      value: hotLeads.toLocaleString(),
      icon: IoFlameOutline,
      trend: hotLeads > 0 ? "Urgent" : "0 Pending",
      trendType: hotLeads > 0 ? "hot" : "neutral",
      subtext: "High purchase readiness"
    },
    {
      title: "Average Lead Score",
      value: `${avgLeadScore} / 100`,
      icon: IoAnalyticsOutline,
      trend: avgLeadScore >= 70 ? "High" : "Standard",
      trendType: avgLeadScore >= 70 ? "positive" : "neutral",
      subtext: "Conversation evaluation"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <DashboardCard
          key={idx}
          title={card.title}
          value={card.value}
          icon={card.icon}
          trend={card.trend}
          trendType={card.trendType}
          subtext={card.subtext}
        />
      ))}
    </div>
  );
}
