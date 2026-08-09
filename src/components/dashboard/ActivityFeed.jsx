import React from "react";
import { 
  IoFlameOutline, 
  IoChatbubbleOutline, 
  IoPulseOutline
} from "react-icons/io5";

export default function ActivityFeed({ events = [], loading = false }) {
  const getEventIcon = (type) => {
    switch (type) {
      case "hot-lead":
        return <IoFlameOutline className="w-3.5 h-3.5 text-red-400" />;
      case "message":
        return <IoChatbubbleOutline className="w-3.5 h-3.5 text-whatsapp-green" />;
      default:
        return <IoPulseOutline className="w-3.5 h-3.5 text-whatsapp-gray" />;
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
    <div className="bg-whatsapp-panel border border-whatsapp-border/30 rounded-lg p-4 sm:p-5 select-none">
      <div className="flex items-center justify-between pb-3 border-b border-whatsapp-border/20 mb-3">
        <div className="flex items-center gap-2">
          <IoPulseOutline className="w-4 h-4 text-whatsapp-gray" />
          <h3 className="text-xs sm:text-sm font-semibold text-whatsapp-text">Activity Stream</h3>
        </div>
        {events.length > 0 && (
          <span className="text-[11px] font-mono text-whatsapp-gray">
            {events.length} events
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 py-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 bg-whatsapp-sidebar rounded animate-pulse"></div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-6 text-whatsapp-gray text-xs">
          <p>No recent activity recorded</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.slice(0, 5).map((event) => (
            <div 
              key={event.id}
              className="flex items-center justify-between p-2 rounded bg-whatsapp-sidebar/40 border border-whatsapp-border/10 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                {getEventIcon(event.type)}
                <span className="text-whatsapp-text truncate">
                  {event.text}
                </span>
              </div>
              <span className="font-mono text-[10px] text-whatsapp-gray flex-shrink-0">
                {formatRelativeTime(event.time)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
