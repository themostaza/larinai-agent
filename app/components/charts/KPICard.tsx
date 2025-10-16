'use client';

import React from 'react';

interface KPIConfig {
  id: string;
  title: string;
  subtitle?: string;
  type: 'number' | 'percentage' | 'currency';
  query_field: string;
  format?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'count_where' | 'min' | 'max';
  filter?: Record<string, string | number | boolean>;
  icon?: string;
}

interface KPICardProps {
  config: KPIConfig;
  data: Record<string, unknown>[];
}

export default function KPICard({ config, data }: KPICardProps) {
  const calculateValue = (): number => {
    try {
      if (!data || data.length === 0) return 0;

      // Validazione campo
      if (!config.query_field) {
        console.error('❌ [KPI] Missing query_field in config:', config);
        return 0;
      }

      // Apply filter if specified
      let filteredData = data;
      if (config.filter && config.aggregation === 'count_where') {
        filteredData = data.filter(row => {
          return Object.entries(config.filter!).every(([key, value]) => {
            return row[key] === value;
          });
        });
      }

      const values = filteredData
        .map(row => {
          const value = row[config.query_field];
          return typeof value === 'number' ? value : parseFloat(String(value)) || 0;
        })
        .filter(val => !isNaN(val));

      if (values.length === 0) return 0;

      switch (config.aggregation || 'sum') {
        case 'sum':
          return values.reduce((acc, val) => acc + val, 0);
        case 'avg':
          return values.reduce((acc, val) => acc + val, 0) / values.length;
        case 'count':
          return values.length;
        case 'count_where':
          return filteredData.length;
        case 'min':
          return Math.min(...values);
        case 'max':
          return Math.max(...values);
        default:
          return values.reduce((acc, val) => acc + val, 0);
      }
    } catch (error) {
      console.error('❌ [KPI] Error calculating value for', config.title, ':', error);
      return 0;
    }
  };

  const formatValue = (value: number): string => {
    try {
      switch (config.type) {
        case 'currency':
          return new Intl.NumberFormat('it-IT', {
            style: 'currency',
            currency: 'EUR'
          }).format(value);
        case 'percentage':
          return `${value.toFixed(1)}%`;
        case 'number':
        default:
          return new Intl.NumberFormat('it-IT').format(value);
      }
    } catch (error) {
      console.error('❌ [KPI] Error formatting value:', error);
      return String(value);
    }
  };

  const value = calculateValue();
  const formattedValue = formatValue(value);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-400 mb-1">
            {config.title}
          </h3>
          <div className="text-2xl font-bold text-white">
            {formattedValue}
          </div>
        </div>
        {config.icon && (
          <div className="text-2xl text-gray-500">
            {config.icon}
          </div>
        )}
      </div>
      
      {/* Optional subtitle */}
      {config.subtitle && (
        <div className="mt-2 text-xs text-gray-500">
          {config.subtitle}
        </div>
      )}
    </div>
  );
}
