import React from "react";
import { useCRM } from "../../context/CRMContext";
import { 
  IoFlame, 
  IoChatbubbleEllipses, 
  IoSparkles, 
  IoHappy, 
  IoWarning, 
  IoClose,
  IoTrendingUp
} from "react-icons/io5";

export default function ToastContainer() {
  const { toasts = [], removeToast } = useCRM();

  const getToastStyles = (type) => {
    switch (type) {
      case "hot":
        return {
          bg: "bg-red-950/95 border-red-500/50 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.3)]",
          icon: <IoFlame className="w-5 h-5 text-red-400 animate-pulse flex-shrink-0" />
        };
      case "message":
        return {
          bg: "bg-whatsapp-panel/95 border-whatsapp-green/40 text-whatsapp-text shadow-[0_0_20px_rgba(37,211,102,0.2)]",
          icon: <IoChatbubbleEllipses className="w-5 h-5 text-whatsapp-green flex-shrink-0" />
        };
      case "score":
        return {
          bg: "bg-emerald-950/95 border-emerald-500/40 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.2)]",
          icon: <IoTrendingUp className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        };
      case "sentiment":
        return {
          bg: "bg-indigo-950/95 border-indigo-500/40 text-indigo-100 shadow-[0_0_20px_rgba(99,102,241,0.2)]",
          icon: <IoHappy className="w-5 h-5 text-indigo-400 flex-shrink-0" />
        };
      case "priority":
        return {
          bg: "bg-amber-950/95 border-amber-500/50 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.25)]",
          icon: <IoWarning className="w-5 h-5 text-amber-400 flex-shrink-0 animate-bounce" />
        };
      default:
        return {
          bg: "bg-whatsapp-panel/95 border-whatsapp-border/50 text-whatsapp-text shadow-xl",
          icon: <IoSparkles className="w-5 h-5 text-whatsapp-teal flex-shrink-0" />
        };
    }
  };

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map(toast => {
        const { bg, icon } = getToastStyles(toast.type);
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 p-3.5 rounded-xl border backdrop-blur-md pointer-events-auto transition-all duration-300 transform translate-y-0 scale-100 select-none animate-slide-in ${bg}`}
          >
            <div>{icon}</div>
            <div className="flex-1 text-xs font-semibold leading-normal">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-whatsapp-gray hover:text-white transition-colors p-1 rounded-md hover:bg-white/10"
              title="Dismiss"
            >
              <IoClose className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
