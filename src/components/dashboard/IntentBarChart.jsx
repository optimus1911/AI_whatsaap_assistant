import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { IoCompassOutline } from "react-icons/io5";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-whatsapp-sidebar/95 border border-whatsapp-border/60 backdrop-blur-md px-3 py-2 rounded-lg shadow-xl text-xs">
        <p className="font-semibold text-whatsapp-text mb-0.5">{label}</p>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-whatsapp-teal"></span>
          <span className="text-whatsapp-gray">Conversations:</span>
          <span className="font-mono font-bold text-whatsapp-green">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function IntentBarChart({ data = [], loading = false }) {
  const hasData = Array.isArray(data) && data.length > 0 && data.some(d => (d.value || 0) > 0);

  return (
    <div className="bg-whatsapp-panel/90 backdrop-blur-sm border border-whatsapp-border/30 rounded-xl p-4 sm:p-5 shadow-sm h-[330px] flex flex-col justify-between select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-whatsapp-border/15">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <IoCompassOutline className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-whatsapp-text">Customer Intents</h3>
            <p className="text-[10px] text-whatsapp-gray">Detected buying & query topics</p>
          </div>
        </div>
        {hasData && (
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-whatsapp-input text-whatsapp-gray border border-whatsapp-border/20">
            {data.length} categories
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-whatsapp-green border-t-transparent"></div>
          <span className="text-[11px] text-whatsapp-gray">Classifying intents...</span>
        </div>
      ) : !hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <div className="w-10 h-10 rounded-full bg-whatsapp-input/50 flex items-center justify-center text-whatsapp-gray mb-2">
            <IoCompassOutline className="w-5 h-5 opacity-60" />
          </div>
          <p className="text-xs font-semibold text-whatsapp-text">No Intent Data Yet</p>
          <p className="text-[10px] text-whatsapp-gray max-w-[180px] mt-0.5">
            Pricing, demo, and product queries will be clustered here.
          </p>
        </div>
      ) : (
        <div className="flex-1 w-full pt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#222e35" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="#8696a0" 
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#222e35' }}
                interval={0}
                tickFormatter={(val) => val.length > 10 ? `${val.substring(0, 9)}…` : val}
              />
              <YAxis 
                stroke="#8696a0" 
                fontSize={10} 
                tickLine={false}
                axisLine={{ stroke: '#222e35' }}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar 
                dataKey="value" 
                fill="#00a884" 
                radius={[6, 6, 0, 0]} 
                barSize={24}
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`bar-${index}`} 
                    fill={index % 2 === 0 ? "#00a884" : "#25d366"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}
