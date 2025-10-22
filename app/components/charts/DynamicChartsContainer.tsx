'use client';

import React, { useState, useEffect } from 'react';
import { BrainCircuit, AlertCircle, Trash2, Loader2, Maximize2, X } from 'lucide-react';
import KPICard from './KPICard';
import ChartRenderer from './ChartRenderer';
import ChartErrorBoundary from './ChartErrorBoundary';

interface KPIConfig {
  id: string;
  title: string;
  type: 'number' | 'percentage' | 'currency';
  query_field: string;
  format?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  icon?: string;
}

interface ChartConfig {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'doughnut';
  data: {
    x_field: string;
    y_field: string;
    group_by?: string;
  };
  options?: Record<string, unknown>;
}

interface ChartsKPIConfig {
  version: string;
  kpis?: KPIConfig[];
  charts?: ChartConfig[];
}

interface DynamicChartsContainerProps {
  config: ChartsKPIConfig | null;
  data: Record<string, unknown>[];
  onOpenAgentChat?: () => void;
  onDeleteKPI?: (kpiId: string) => void;
  onDeleteChart?: (chartId: string) => void;
  deletingKPIs?: Set<string>;
  deletingCharts?: Set<string>;
}

export default function DynamicChartsContainer({ config, data, onOpenAgentChat, onDeleteKPI, onDeleteChart, deletingKPIs = new Set(), deletingCharts = new Set() }: DynamicChartsContainerProps) {
  const [expandedKPI, setExpandedKPI] = useState<KPIConfig | null>(null);
  const [expandedChart, setExpandedChart] = useState<ChartConfig | null>(null);

  // Chiudi dialog con ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (expandedKPI) setExpandedKPI(null);
        if (expandedChart) setExpandedChart(null);
      }
    };

    if (expandedKPI || expandedChart) {
      document.addEventListener('keydown', handleEscape);
      // Previeni scroll della pagina quando dialog aperto
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [expandedKPI, expandedChart]);

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-8 text-center" style={{ width: '50vw' }}>
          <div className="flex items-center justify-center mb-4">
            <BrainCircuit className="w-8 h-8 text-gray-400 mr-3" />
            <h3 className="text-xl font-semibold text-gray-300">Grafici e KPI</h3>
          </div>
          <p className="text-gray-400 text-base mb-6 leading-relaxed">
            Nessuna configurazione di grafici trovata per questa query.
            <br />
            Usa l&apos;intelligenza artificiale per creare visualizzazioni personalizzate!
          </p>
          <div className="flex justify-center">
            {onOpenAgentChat && (
              <button
                onClick={onOpenAgentChat}
                className="group flex items-center p-2 rounded-lg border transition-all duration-300 overflow-hidden bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white"
              >
                <BrainCircuit size={16} className="flex-shrink-0" />
                <span className="whitespace-nowrap text-sm font-medium ml-2">
                  Chatta con l&apos;AI per creare grafici e KPI
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const hasKPIs = config.kpis && config.kpis.length > 0;
  const hasCharts = config.charts && config.charts.length > 0;

  if (!hasKPIs && !hasCharts) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-gray-900 rounded-lg border border-gray-700 p-8 text-center" style={{ width: '50vw' }}>
          <div className="flex items-center justify-center mb-4">
            <BrainCircuit className="w-12 h-12 text-blue-400 mr-3" />
            <h3 className="text-2xl font-semibold text-white">Crea la tua Dashboard</h3>
          </div>
          <p className="text-gray-300 text-base mb-6 leading-relaxed">
            La configurazione è vuota ma la query è salvata!
            <br />
            <span className="text-gray-400">Usa l&apos;intelligenza artificiale per generare grafici e KPI personalizzati.</span>
          </p>
          <div className="flex justify-center">
            {onOpenAgentChat && (
              <button
                onClick={onOpenAgentChat}
                className="group flex items-center px-6 py-3 rounded-lg border-2 transition-all duration-300 bg-blue-600 text-white border-blue-500 hover:bg-blue-700 hover:border-blue-600 shadow-lg hover:shadow-xl"
              >
                <BrainCircuit size={20} className="flex-shrink-0" />
                <span className="whitespace-nowrap text-base font-semibold ml-3">
                  Apri Chat AI per creare Grafici e KPI
                </span>
              </button>
            )}
          </div>
          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-xs text-gray-500">
              💡 L&apos;AI analizzerà la struttura dei tuoi dati e ti suggerirà le visualizzazioni più appropriate
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ChartErrorBoundary
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-gray-900 rounded-lg border border-red-900/50 p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-400 mb-2">Errore nella renderizzazione</h3>
            <p className="text-gray-400 text-sm">Si è verificato un errore nel caricamento dei grafici e KPI.</p>
          </div>
        </div>
      }
    >
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">

        {/* KPIs Section */}
        {hasKPIs && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {config.kpis!.map((kpiConfig) => {
              const isDeleting = deletingKPIs.has(kpiConfig.id);
              return (
                <ChartErrorBoundary key={kpiConfig.id} chartTitle={kpiConfig.title}>
                  <div className={`relative group ${isDeleting ? 'opacity-60' : ''}`}>
                    <KPICard
                      config={kpiConfig}
                      data={data}
                    />
                    <div className="absolute top-2 right-2 flex gap-1 z-10">
                      <button
                        onClick={() => setExpandedKPI(kpiConfig)}
                        className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        title="Ingrandisci KPI"
                      >
                        <Maximize2 size={14} />
                      </button>
                      {onDeleteKPI && (
                        <button
                          onClick={() => !isDeleting && onDeleteKPI(kpiConfig.id)}
                          disabled={isDeleting}
                          className={`p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md transition-opacity duration-200 ${
                            isDeleting ? 'opacity-100 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          title={isDeleting ? 'Eliminazione in corso...' : 'Elimina KPI'}
                        >
                          {isDeleting ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </ChartErrorBoundary>
              );
            })}
          </div>
        )}

        {/* Charts Section */}
        {hasCharts && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {config.charts!.map((chartConfig) => {
              const isDeleting = deletingCharts.has(chartConfig.id);
              return (
                <ChartErrorBoundary key={chartConfig.id} chartTitle={chartConfig.title}>
                  <div className={`relative group ${isDeleting ? 'opacity-60' : ''}`}>
                    <ChartRenderer
                      config={chartConfig}
                      data={data}
                    />
                    <div className="absolute top-2 right-2 flex gap-1 z-10">
                      <button
                        onClick={() => setExpandedChart(chartConfig)}
                        className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        title="Ingrandisci grafico"
                      >
                        <Maximize2 size={14} />
                      </button>
                      {onDeleteChart && (
                        <button
                          onClick={() => !isDeleting && onDeleteChart(chartConfig.id)}
                          disabled={isDeleting}
                          className={`p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md transition-opacity duration-200 ${
                            isDeleting ? 'opacity-100 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100'
                          }`}
                          title={isDeleting ? 'Eliminazione in corso...' : 'Elimina grafico'}
                        >
                          {isDeleting ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </ChartErrorBoundary>
              );
            })}
          </div>
        )}
      </div>

      {/* KPI Expanded Dialog */}
      {expandedKPI && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8"
          onClick={() => setExpandedKPI(null)}
        >
          <div 
            className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">
                {expandedKPI.title}
              </h2>
              <button
                onClick={() => setExpandedKPI(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8">
              <div className="flex items-center justify-center min-h-[400px]">
                <ChartErrorBoundary chartTitle={expandedKPI.title}>
                  <div className="w-full max-w-2xl">
                    <KPICard
                      config={{...expandedKPI}}
                      data={data}
                    />
                  </div>
                </ChartErrorBoundary>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart Expanded Dialog */}
      {expandedChart && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8"
          onClick={() => setExpandedChart(null)}
        >
          <div 
            className="bg-gray-900 rounded-lg border border-gray-700 w-full h-full max-w-7xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
              <h2 className="text-xl font-semibold text-white">
                {expandedChart.title}
              </h2>
              <button
                onClick={() => setExpandedChart(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 flex-1 overflow-hidden">
              <ChartErrorBoundary chartTitle={expandedChart.title}>
                <div className="w-full h-full">
                  <ChartRenderer
                    config={{...expandedChart}}
                    data={data}
                  />
                </div>
              </ChartErrorBoundary>
            </div>
          </div>
        </div>
      )}
    </ChartErrorBoundary>
  );
}
