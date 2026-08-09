import React from "react";
import { 
  IoFlame, 
  IoChatbubbleOutline, 
  IoCubeOutline, 
  IoTrendingUpOutline, 
  IoHappyOutline, 
  IoWarningOutline, 
  IoPersonAddOutline, 
  IoPulseOutline 
} from "react-icons/io5";

export default function ActivityFeed({ events = [], loading = false }) {
  const getEventIcon = (type) => {
    switch (type) {
      case "hot-lead":
        return <div className="p-2 bg-red-500/15 text-red-400 border border-red-500/25 rounded-lg"><IoFlame className="w-4 h-4 animate-pulse" /></div>;
      case "message":
        return <div className="p-2 bg-whatsapp-teal/20 text-whatsapp-green border border-whatsapp-green/25 rounded-lg"><IoChatbubbleOutline className="w-4 h-4" /></div>;
      case "recommendation":
        return <div className="p-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-lg"><IoCubeOutline className="w-4 h-4" /></div>;
      case "score-up":
        return <div className="p-2 bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-lg"><IoTrendingUpOutline className="w-4 h-4" /></div>;
      case "sentiment":
        return <div className="p-2 bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 rounded-lg"><IoHappyOutline className="w-4 h-4" /></div>;
      case "priority":
        return <div className="p-2 bg-red-500/15 text-red-400 border border-red-500/25 rounded-lg"><IoWarningOutline className="w-4 h-4 animate-bounce" /></div>;
      case "new-user":
        return <div className="p-2 bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 rounded-lg"><IoPersonAddOutline className="w-4 h-4" /></div>;
      default:
        return <div className="p-2 bg-whatsapp-input text-whatsapp-gray border border-whatsapp-border/30 rounded-lg"><IoPulseOutline className="w-4 h-4" /></div>;
    }
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return "Just now";
    const date = new Date(timestamp);
    const diff = new Date() - date;
    const mins = Math.floor(diff / 60000);
    
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="bg-whatsapp-panel/90 backdrop-blur-sm border border-whatsapp-border/30 rounded-xl p-4 sm:p-5 shadow-sm h-full flex flex-col justify-between select-none">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-whatsapp-border/15 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-whatsapp-teal/15 text-whatsapp-green border border-whatsapp-green/20">
              <IoPulseOutline className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-whatsapp-text">Live CRM Activity Stream</h3>
              <p className="text-[10px] text-whatsapp-gray">Real-time customer triggers & AI updates</p>
            </div>
          </div>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-whatsapp-green opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-whatsapp-green"></span>
          </span>
        </div>
        
        {/* Content */}
        {loading && events.length === 0 ? (
          <div className="space-y-3 py-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-whatsapp-input/30 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-whatsapp-gray text-xs">
            <div className="w-9 h-9 rounded-full bg-whatsapp-input/50 flex items-center justify-center text-whatsapp-gray mx-auto mb-2">
              <IoPulseOutline className="w-4 h-4 opacity-60" />
            </div>
            <p className="font-semibold text-whatsapp-text">No Activity Recorded Yet</p>
            <p className="text-[10px] text-whatsapp-gray mt-0.5">
              Live customer events and AI responses will stream here.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {events.map((event, index) => (
              <div 
                key={event.id || index} 
                className="flex items-start space-x-3 text-xs leading-normal p-2 rounded-lg hover:bg-whatsapp-input/20 transition-colors"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-whatsapp-text font-medium break-words text-xs">
                    {event.description}
                  </div>
                  <div className="flex items-center space-x-2 mt-1 text-[10px] text-whatsapp-gray">
                    <span className="font-semibold text-whatsapp-green bg-whatsapp-teal/10 px-1.5 py-0.5 rounded border border-whatsapp-green/20">
                      {event.customerName}
                    </span>
                    <span>•</span>
                    <span className="font-mono">{formatRelativeTime(event.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
