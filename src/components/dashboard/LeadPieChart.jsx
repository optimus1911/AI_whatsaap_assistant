import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { IoPieChartOutline } from "react-icons/io5";

const COLORS = {
  Hot: "#ef4444",   // Red
  Warm: "#f97316",  // Orange
  Cold: "#3b82f6"   // Blue
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-whatsapp-sidebar/95 border border-whatsapp-border/60 backdrop-blur-md px-3 py-2 rounded-lg shadow-xl text-xs">
        <div className="flex items-center gap-2">
          <span 
            className="w-2.5 h-2.5 rounded-full" 
            style={{ backgroundColor: COLORS[data.name] || "#94a3b8" }}
          />
          <span className="font-semibold text-whatsapp-text">{data.name} Leads:</span>
          <span className="font-mono font-bold text-white">{data.value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function LeadPieChart({ data = [], loading = false }) {
  const hasData = Array.isArray(data) && data.some(d => (d.value || 0) > 0);
  const totalLeads = hasData ? data.reduce((acc, curr) => acc + (curr.value || 0), 0) : 0;

  return (
    <div className="bg-whatsapp-panel/90 backdrop-blur-sm border border-whatsapp-border/30 rounded-xl p-4 sm:p-5 shadow-sm h-[330px] flex flex-col justify-between select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-whatsapp-border/15">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
            <IoPieChartOutline className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-whatsapp-text">Lead Distribution</h3>
            <p className="text-[10px] text-whatsapp-gray">Hot vs Warm vs Cold categorization</p>
          </div>
        </div>
        {hasData && (
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-whatsapp-input text-whatsapp-gray border border-whatsapp-border/20">
            {totalLeads} total
          </span>
        )}
      </div>

      {/* Chart Content or Loading / Empty */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-whatsapp-green border-t-transparent"></div>
          <span className="text-[11px] text-whatsapp-gray">Analyzing leads...</span>
        </div>
      ) : !hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <div className="w-10 h-10 rounded-full bg-whatsapp-input/50 flex items-center justify-center text-whatsapp-gray mb-2">
            <IoPieChartOutline className="w-5 h-5 opacity-60" />
          </div>
          <p className="text-xs font-semibold text-whatsapp-text">No Lead Data Yet</p>
          <p className="text-[10px] text-whatsapp-gray max-w-[180px] mt-0.5">
            Incoming WhatsApp chats will be categorized by buying intent.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-full h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="#202c33"
                  strokeWidth={2}
                >
                  {data.map((entry, index) => (
                    <Cell 
                      key={`lead-cell-${index}`} 
                      fill={COLORS[entry.name] || "#94a3b8"} 
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Custom Sleek Legend */}
          <div className="flex items-center justify-center gap-4 text-[11px] pt-1">
            {data.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: COLORS[entry.name] || "#94a3b8" }}
                />
                <span className="text-whatsapp-gray font-medium">{entry.name}:</span>
                <span className="font-mono font-bold text-whatsapp-text">{entry.value || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
