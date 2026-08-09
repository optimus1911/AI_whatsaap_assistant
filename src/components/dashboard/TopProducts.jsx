import React from "react";
import { IoCubeOutline } from "react-icons/io5";

export default function TopProducts({ products = [], loading = false }) {
  const hasProducts = Array.isArray(products) && products.length > 0;
  const maxCount = hasProducts ? Math.max(...products.map(p => p.count || 1), 1) : 1;

  return (
    <div className="bg-whatsapp-panel border border-whatsapp-border/30 rounded-lg p-4 sm:p-5 flex flex-col justify-between select-none">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-whatsapp-border/20 mb-3">
          <div className="flex items-center gap-2">
            <IoCubeOutline className="w-4 h-4 text-whatsapp-gray" />
            <h3 className="text-xs sm:text-sm font-semibold text-whatsapp-text">Top Recommended Products</h3>
          </div>
          {hasProducts && (
            <span className="text-[11px] font-mono text-whatsapp-gray">
              {products.length} SKUs
            </span>
          )}
        </div>
        
        {/* Content */}
        {loading ? (
          <div className="space-y-2 py-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-whatsapp-sidebar rounded animate-pulse"></div>
            ))}
          </div>
        ) : !hasProducts ? (
          <div className="text-center py-6 text-whatsapp-gray text-xs">
            <p>No product matches recorded yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((prod, index) => {
              const relativePercent = Math.round(((prod.count || 0) / maxCount) * 100);
              return (
                <div 
                  key={index} 
                  className="p-2.5 bg-whatsapp-sidebar/60 border border-whatsapp-border/20 rounded"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-medium text-whatsapp-text truncate">
                      {prod.name}
                    </span>
                    <span className="text-[11px] font-mono text-whatsapp-green flex-shrink-0">
                      {prod.count} {prod.count === 1 ? 'match' : 'matches'}
                    </span>
                  </div>

                  <div className="w-full bg-whatsapp-panel rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-whatsapp-green h-full rounded-full transition-all duration-500"
                      style={{ width: `${relativePercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
