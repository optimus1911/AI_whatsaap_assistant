import React from "react";
import Sidebar from "../components/chat/Sidebar";
import ChatArea from "../components/chat/ChatArea";
import Dashboard from "./Dashboard";
import { CRMProvider, useCRM } from "../context/CRMContext";
import ToastContainer from "../components/common/ToastContainer";

function ChatPageContent() {
  const { activeTab } = useCRM();

  return (
    <div className="flex h-screen bg-whatsapp-dark overflow-hidden">
      {/* Sidebar is always visible and shares CRM state */}
      <Sidebar />

      {/* Main Workspace content depends on the active tab */}
      {activeTab === "dashboard" ? (
        <Dashboard />
      ) : (
        <ChatArea />
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <CRMProvider>
      <ChatPageContent />
      <ToastContainer />
    </CRMProvider>
  );
}
