import React from "react";
import { IoCubeOutline } from "react-icons/io5";

export default function TopProducts({ products = [], loading = false }) {
  const hasProducts = Array.isArray(products) && products.length > 0;
  const maxCount = hasProducts ? Math.max(...products.map(p => p.count || 1), 1) : 1;

  return (
    <div className="bg-whatsapp-panel/90 backdrop-blur-sm border border-whatsapp-border/30 rounded-xl p-4 sm:p-5 shadow-sm h-full flex flex-col justify-between select-none">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-whatsapp-border/15 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-whatsapp-teal/15 text-whatsapp-green border border-whatsapp-green/20">
              <IoCubeOutline className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-whatsapp-text">Top Recommended Products</h3>
              <p className="text-[10px] text-whatsapp-gray">AI matched product demand</p>
            </div>
          </div>
          {hasProducts && (
            <span className="text-[10px] font-mono text-whatsapp-gray bg-whatsapp-input px-2 py-0.5 rounded-full">
              {products.length} SKUs
            </span>
          )}
        </div>
        
        {/* Content */}
        {loading ? (
          <div className="space-y-2 py-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-whatsapp-input/30 rounded-lg animate-pulse"></div>
            ))}
          </div>
        ) : !hasProducts ? (
          <div className="text-center py-8 text-whatsapp-gray text-xs">
            <div className="w-9 h-9 rounded-full bg-whatsapp-input/50 flex items-center justify-center text-whatsapp-gray mx-auto mb-2">
              <IoCubeOutline className="w-4 h-4 opacity-60" />
            </div>
            <p className="font-semibold text-whatsapp-text">No Product Matches Yet</p>
            <p className="text-[10px] text-whatsapp-gray mt-0.5">
              Recommendations will appear when AI identifies product fit.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {products.map((prod, index) => {
              const relativePercent = Math.round(((prod.count || 0) / maxCount) * 100);
              return (
                <div 
                  key={index} 
                  className="p-3 bg-whatsapp-input/30 border border-whatsapp-border/20 rounded-xl hover:border-whatsapp-teal/40 hover:bg-whatsapp-input/50 transition-all duration-200"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-whatsapp-panel text-whatsapp-green font-mono font-extrabold text-[10px] flex items-center justify-center border border-whatsapp-border/30 flex-shrink-0">
                        #{index + 1}
                      </span>
                      <span className="text-xs font-semibold text-whatsapp-text truncate">
                        {prod.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold bg-whatsapp-teal/15 text-whatsapp-green px-2 py-0.5 rounded-full border border-whatsapp-green/25 flex-shrink-0">
                      {prod.count} {prod.count === 1 ? 'lead' : 'leads'}
                    </span>
                  </div>

                  {/* Relative bar */}
                  <div className="w-full bg-whatsapp-input rounded-full h-1 overflow-hidden">
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
