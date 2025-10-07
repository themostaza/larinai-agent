'use client';

import React from 'react';
import { BrainCircuit } from 'lucide-react';
import KPICard from './KPICard';
import ChartRenderer from './ChartRenderer';

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
}

export default function DynamicChartsContainer({ config, data, onOpenAgentChat }: DynamicChartsContainerProps) {
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
    <div className="flex-1 p-6 space-y-6 overflow-y-auto">

      {/* KPIs Section */}
      {hasKPIs && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {config.kpis!.map((kpiConfig) => (
            <KPICard
              key={kpiConfig.id}
              config={kpiConfig}
              data={data}
            />
          ))}
        </div>
      )}

      {/* Charts Section */}
      {hasCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {config.charts!.map((chartConfig) => (
            <ChartRenderer
              key={chartConfig.id}
              config={chartConfig}
              data={data}
            />
          ))}
        </div>
      )}
    </div>
  );
}
