import React from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { IoTrendingUpOutline } from "react-icons/io5";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-whatsapp-sidebar/95 border border-whatsapp-border/60 backdrop-blur-md px-3 py-2 rounded-lg shadow-xl text-xs">
        <p className="font-semibold text-whatsapp-text mb-0.5">{label}</p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-whatsapp-green"></span>
          <span className="text-whatsapp-gray">Messages:</span>
          <span className="font-mono font-bold text-whatsapp-green">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function MessagesLineChart({ data = [], loading = false }) {
  const hasData = Array.isArray(data) && data.length > 0 && data.some(d => (d.messages || 0) > 0);
  const totalMessages = hasData ? data.reduce((acc, curr) => acc + (curr.messages || 0), 0) : 0;

  return (
    <div className="bg-whatsapp-panel/90 backdrop-blur-sm border border-whatsapp-border/30 rounded-xl p-4 sm:p-5 shadow-sm h-[330px] flex flex-col justify-between select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-whatsapp-border/15">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-whatsapp-green border border-whatsapp-green/20">
            <IoTrendingUpOutline className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-whatsapp-text">Message Velocity</h3>
            <p className="text-[10px] text-whatsapp-gray">7-day WhatsApp inbound traffic</p>
          </div>
        </div>
        {hasData && (
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-whatsapp-input text-whatsapp-gray border border-whatsapp-border/20">
            {totalMessages} 7-day vol
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-whatsapp-green border-t-transparent"></div>
          <span className="text-[11px] text-whatsapp-gray">Plotting activity...</span>
        </div>
      ) : !hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <div className="w-10 h-10 rounded-full bg-whatsapp-input/50 flex items-center justify-center text-whatsapp-gray mb-2">
            <IoTrendingUpOutline className="w-5 h-5 opacity-60" />
          </div>
          <p className="text-xs font-semibold text-whatsapp-text">No Message Traffic Yet</p>
          <p className="text-[10px] text-whatsapp-gray max-w-[180px] mt-0.5">
            Daily WhatsApp inbound & outbound messages will be plotted over time.
          </p>
        </div>
      ) : (
        <div className="flex-1 w-full pt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
            >
              <defs>
                <linearGradient id="msgGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#25D366" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#25D366" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#222e35" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#8696a0" 
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#222e35' }}
              />
              <YAxis 
                stroke="#8696a0" 
                fontSize={10} 
                tickLine={false}
                axisLine={{ stroke: '#222e35' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="messages" 
                stroke="#25D366" 
                strokeWidth={2.5}
                fillOpacity={1} 
                fill="url(#msgGradient)" 
                dot={{ fill: "#25D366", stroke: "#0b141a", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: "#25D366", stroke: "#ffffff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}
