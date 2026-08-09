import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { IoCompassOutline } from "react-icons/io5";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-whatsapp-sidebar border border-whatsapp-border/60 px-3 py-2 rounded shadow-md text-xs">
        <p className="font-medium text-whatsapp-text mb-0.5">{label}</p>
        <div className="flex items-center gap-2">
          <span className="text-whatsapp-gray">Conversations:</span>
          <span className="font-mono font-semibold text-whatsapp-green">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function IntentBarChart({ data = [], loading = false }) {
  const hasData = Array.isArray(data) && data.length > 0 && data.some(d => (d.value || 0) > 0);

  return (
    <div className="bg-whatsapp-panel border border-whatsapp-border/30 rounded-lg p-4 sm:p-5 flex flex-col justify-between select-none h-[280px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-whatsapp-border/20 mb-2">
        <div className="flex items-center gap-2">
          <IoCompassOutline className="w-4 h-4 text-whatsapp-gray" />
          <h3 className="text-xs sm:text-sm font-semibold text-whatsapp-text">Customer Intents</h3>
        </div>
        {hasData && (
          <span className="text-[11px] font-mono text-whatsapp-gray">
            {data.length} topics
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-whatsapp-green border-t-transparent"></div>
          <span className="text-xs text-whatsapp-gray">Classifying intents...</span>
        </div>
      ) : !hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <p className="text-xs text-whatsapp-gray">No intent data recorded yet</p>
        </div>
      ) : (
        <div className="flex-1 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 12, left: -24, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#202c33" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="#8696a0" 
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#222e35' }}
                tickFormatter={(val) => val.length > 12 ? `${val.substring(0, 11)}…` : val}
              />
              <YAxis 
                stroke="#8696a0" 
                fontSize={11} 
                tickLine={false}
                axisLine={{ stroke: '#222e35' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar 
                dataKey="value" 
                fill="#00a884" 
                radius={[3, 3, 0, 0]} 
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
