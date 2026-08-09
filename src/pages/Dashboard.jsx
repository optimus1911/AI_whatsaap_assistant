import React from "react";
import { useCRM } from "../context/CRMContext";
import { IoAlertCircleOutline, IoRefreshOutline, IoCloudUploadOutline } from "react-icons/io5";

// Component imports
import DashboardHeader from "../components/dashboard/DashboardHeader";
import StatsGrid from "../components/dashboard/StatsGrid";
import LeadPieChart from "../components/dashboard/LeadPieChart";
import SentimentPieChart from "../components/dashboard/SentimentPieChart";
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
          <div className="flex items-center justify-between p-4 bg-whatsapp-panel border border-whatsapp-green/30 rounded-xl text-whatsapp-text text-xs shadow-lg animate-slide-in">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-whatsapp-teal/20 text-whatsapp-green">
                <IoCloudUploadOutline className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="font-bold text-whatsapp-text">Connecting to Render Cloud Backend...</p>
                <p className="text-[11px] text-whatsapp-gray mt-0.5">
                  Render services wake up automatically. First connection may take ~15-25 seconds.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-whatsapp-green font-mono text-xs">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-whatsapp-green border-t-transparent"></span>
              <span>Waking up...</span>
            </div>
          </div>
        )}

        {/* API Error Notification Banner (if any) */}
        {error && (
          <div className="flex items-center justify-between p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-200 text-xs shadow-lg animate-slide-in">
            <div className="flex items-center gap-2.5">
              <IoAlertCircleOutline className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <span className="font-bold">Backend Sync Notice:</span> {error}
              </div>
            </div>
            <button
              onClick={retryCRM}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg border border-red-500/30 font-semibold transition-all cursor-pointer"
            >
              <IoRefreshOutline className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Loading Skeletons for initial fetch */}
        {loading && !stats.totalCustomers ? (
          <div className="space-y-6">
            {/* KPI Skeletons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-whatsapp-panel/80 border border-whatsapp-border/30 rounded-xl p-4 animate-pulse h-28"></div>
              ))}
            </div>

            {/* Chart Skeletons */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-whatsapp-panel/80 border border-whatsapp-border/30 rounded-xl p-4 animate-pulse h-[330px]"></div>
              ))}
            </div>

            {/* Bottom Row Skeletons */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-whatsapp-panel/80 border border-whatsapp-border/30 rounded-xl p-4 animate-pulse h-80"></div>
              <div className="bg-whatsapp-panel/80 border border-whatsapp-border/30 rounded-xl p-4 animate-pulse h-80"></div>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Cards Grid */}
            <StatsGrid stats={stats} />

            {/* Recharts Distributions (4 columns on lg, 2 on md, 1 on mobile) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <LeadPieChart data={leads} loading={refreshing} />
              <SentimentPieChart data={sentiments} loading={refreshing} />
              <IntentBarChart data={intents} loading={refreshing} />
              <MessagesLineChart data={messagesPerDay} loading={refreshing} />
            </div>

            {/* Recent AI Insights (2/3) and Top Products / Hot Leads (1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <RecentInsights insights={recentInsights} loading={refreshing} />
              </div>
              <div className="flex flex-col gap-6">
                <HotLeads customers={customers} loading={refreshing} />
                <TopProducts products={topProducts} loading={refreshing} />
              </div>
            </div>

            {/* AI Action Playbook & Live Activity Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SalesSuggestions customers={customers} loading={refreshing} />
              <ActivityFeed events={activityEvents} loading={refreshing} />
            </div>
          </>
        )}
      </div>

      {/* Production Dashboard Footer */}
      <div className="max-w-7xl mx-auto w-full">
        <DashboardFooter lastUpdated={lastRefreshTime} />
      </div>

    </div>
  );
}
