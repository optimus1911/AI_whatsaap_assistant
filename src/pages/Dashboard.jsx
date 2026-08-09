import React from "react";
import { useCRM } from "../context/CRMContext";
import { IoAlertCircleOutline, IoRefreshOutline, IoCloudUploadOutline } from "react-icons/io5";

// Component imports
import DashboardHeader from "../components/dashboard/DashboardHeader";
import StatsGrid from "../components/dashboard/StatsGrid";
import LeadStatusList from "../components/dashboard/LeadStatusList";
import SentimentList from "../components/dashboard/SentimentList";
import IntentBarChart from "../components/dashboard/IntentBarChart";
import MessagesLineChart from "../components/dashboard/MessagesLineChart";
import RecentInsights from "../components/dashboard/RecentInsights";
import HotLeads from "../components/dashboard/HotLeads";
import TopProducts from "../components/dashboard/TopProducts";
import SalesSuggestions from "../components/dashboard/SalesSuggestions";
import ActivityFeed from "../components/dashboard/ActivityFeed";
import DashboardFooter from "../components/dashboard/DashboardFooter";

export default function Dashboard() {
  const { 
    dashboardData, 
    customers, 
    loading, 
    refreshing,
    isColdStarting,
    error,
    lastRefreshTime, 
    activityEvents,
    refreshCRM,
    retryCRM
  } = useCRM();

  const {
    stats = {},
    leads = [],
    sentiments = [],
    intents = [],
    messagesPerDay = [],
    topProducts = [],
    recentInsights = []
  } = dashboardData || {};

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-whatsapp-dark text-whatsapp-text p-4 sm:p-6 lg:p-8 flex flex-col justify-between select-none space-y-6">
      
      <div className="space-y-6 max-w-7xl mx-auto w-full">
        
        {/* Header with Refresh and Live Indicators */}
        <DashboardHeader 
          onRefresh={refreshCRM}
          loading={loading}
          refreshing={refreshing}
          lastUpdated={lastRefreshTime}
        />

        {/* Cold-Start / Backend Connecting Alert (Render free tier) */}
        {isColdStarting && loading && (
          <div className="flex items-center justify-between p-3.5 bg-whatsapp-panel border border-whatsapp-border/30 rounded-lg text-whatsapp-text text-xs">
            <div className="flex items-center gap-2.5">
              <IoCloudUploadOutline className="w-4 h-4 text-whatsapp-green" />
              <div>
                <p className="font-medium text-whatsapp-text">Connecting to Backend Cloud Server...</p>
                <p className="text-[11px] text-whatsapp-gray">
                  Initial cold start may take ~15-25 seconds on free instances.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-whatsapp-green font-mono text-xs">
              <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-whatsapp-green border-t-transparent"></span>
              <span>Connecting...</span>
            </div>
          </div>
        )}

        {/* API Error Notification Banner (if any) */}
        {error && (
          <div className="flex items-center justify-between p-3.5 bg-red-950/30 border border-red-500/30 rounded-lg text-red-200 text-xs">
            <div className="flex items-center gap-2">
              <IoAlertCircleOutline className="w-4 h-4 text-red-400 flex-shrink-0" />
              <div>
                <span className="font-medium">Backend Sync Notice:</span> {error}
              </div>
            </div>
            <button
              onClick={retryCRM}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded border border-red-500/30 text-xs font-medium transition-colors cursor-pointer"
            >
              <IoRefreshOutline className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Loading Skeletons for initial fetch */}
        {loading && !stats.totalCustomers ? (
          <div className="space-y-6">
            {/* KPI Skeletons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-whatsapp-panel border border-whatsapp-border/30 rounded-lg p-4 animate-pulse h-24"></div>
              ))}
            </div>

            {/* Chart Skeletons */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-whatsapp-panel border border-whatsapp-border/30 rounded-lg p-4 animate-pulse h-[280px]"></div>
              ))}
            </div>

            {/* List Skeletons */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-whatsapp-panel border border-whatsapp-border/30 rounded-lg p-4 animate-pulse h-48"></div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* 1. Primary 4 KPI Cards Grid */}
            <StatsGrid stats={stats} />

            {/* 2. Charts Row: Messages Over Time (Line) + Customer Intents (Bar) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MessagesLineChart data={messagesPerDay} loading={refreshing} />
              <IntentBarChart data={intents} loading={refreshing} />
            </div>

            {/* 3. Horizontal Progress Lists: Lead Status + Customer Sentiment */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <LeadStatusList data={leads} loading={refreshing} />
              <SentimentList data={sentiments} loading={refreshing} />
            </div>

            {/* 4. Recent Conversations Table */}
            <RecentInsights insights={recentInsights} loading={refreshing} />

            {/* 5. Hot Leads & Top Products */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <HotLeads customers={customers} loading={refreshing} />
              <TopProducts products={topProducts} loading={refreshing} />
            </div>

            {/* 6. Action Playbook & Live Activity Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SalesSuggestions customers={customers} loading={refreshing} />
              <ActivityFeed events={activityEvents} loading={refreshing} />
            </div>
          </>
        )}
      </div>

      {/* Production Dashboard Footer */}
      <div className="max-w-7xl mx-auto w-full pt-4">
        <DashboardFooter lastUpdated={lastRefreshTime} />
      </div>

    </div>
  );
}
