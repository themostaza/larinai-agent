'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  TimeSeriesScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
// Note: TimeScale requires an adapter like chartjs-adapter-date-fns to work
// If not installed, time-based charts will fail gracefully with ErrorBoundary
ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  TimeSeriesScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface ChartConfig {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'doughnut';
  data: {
    x_field: string;
    y_field: string;
    group_by?: string;
    aggregate?: 'count' | 'sum' | 'avg';
  };
  options?: Record<string, unknown>;
}

interface ChartRendererProps {
  config: ChartConfig;
  data: Record<string, unknown>[];
}

export default function ChartRenderer({ config, data }: ChartRendererProps) {
  const processData = () => {
    try {
      if (!data || data.length === 0) {
        return {
          labels: [],
          datasets: []
        };
      }

      const { x_field, y_field, group_by, aggregate } = config.data;
      
      // Validazione campi
      if (!x_field || !y_field) {
        console.error('❌ [CHART] Missing required fields:', { x_field, y_field });
        return { labels: [], datasets: [] };
      }

    if (group_by) {
      // Group data by the specified field
      const groups = data.reduce((acc: Record<string, Record<string, unknown>[]>, row) => {
        const groupKey = String(row[group_by] || 'Unknown');
        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(row);
        return acc;
      }, {});

      const labels = [...new Set(data.map(row => String(row[x_field] || '')))].sort();
      
      const datasets = Object.entries(groups).map(([groupName, groupData], index) => {
        const colors = [
          'rgb(59, 130, 246)',   // blue
          'rgb(16, 185, 129)',   // green
          'rgb(245, 158, 11)',   // yellow
          'rgb(239, 68, 68)',    // red
          'rgb(139, 92, 246)',   // purple
          'rgb(236, 72, 153)',   // pink
        ];
        
        const color = colors[index % colors.length];
        const typedGroupData = groupData as Record<string, unknown>[];
        
        return {
          label: groupName,
          data: labels.map(label => {
            const matchingRows = typedGroupData.filter((row: Record<string, unknown>) => String(row[x_field]) === label);
            const sum = matchingRows.reduce((acc: number, row: Record<string, unknown>) => {
              const value = row[y_field];
              return acc + (typeof value === 'number' ? value : parseFloat(String(value)) || 0);
            }, 0);
            return sum;
          }),
          backgroundColor: config.type === 'line' ? 'transparent' : color,
          borderColor: color,
          borderWidth: 2,
          fill: false,
        };
      });

      return { labels, datasets };
    } else {
      // Simple chart without grouping - aggregate by x_field
      if (aggregate === 'count' || config.type === 'pie' || config.type === 'doughnut') {
        // Count occurrences of each x_field value
        const counts = data.reduce((acc: Record<string, number>, row) => {
          const key = String(row[x_field] || 'Unknown');
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});

        const labels = Object.keys(counts);
        const values = Object.values(counts);

        const colors = [
          'rgb(59, 130, 246)',   // blue
          'rgb(16, 185, 129)',   // green  
          'rgb(245, 158, 11)',   // yellow
          'rgb(239, 68, 68)',    // red
          'rgb(139, 92, 246)',   // purple
          'rgb(236, 72, 153)',   // pink
          'rgb(34, 197, 94)',    // emerald
          'rgb(168, 85, 247)',   // violet
          'rgb(251, 146, 60)',   // orange
          'rgb(14, 165, 233)',   // sky
        ];

        return {
          labels,
          datasets: [{
            label: config.title,
            data: values,
            backgroundColor: colors,
            borderColor: colors,
            borderWidth: 2,
            fill: false,
          }]
        };
      } else {
        // Original logic for non-aggregated data
        const labels = data.map(row => String(row[x_field] || ''));
        const values = data.map(row => {
          const value = row[y_field];
          return typeof value === 'number' ? value : parseFloat(String(value)) || 0;
        });

        return {
          labels,
          datasets: [{
            label: config.title,
            data: values,
            backgroundColor: 'rgb(59, 130, 246)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 2,
            fill: false,
          }]
        };
      }
    }
    } catch (error) {
      console.error('❌ [CHART] Error processing data for', config.title, ':', error);
      return { labels: [], datasets: [] };
    }
  };

  const chartData = processData();

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#D1D5DB', // gray-300
        }
      },
      title: {
        display: true,
        text: config.title,
        color: '#FFFFFF',
        font: {
          size: 16,
          weight: 'bold' as const,
        }
      },
    },
    scales: config.type !== 'pie' && config.type !== 'doughnut' ? {
      x: {
        ticks: {
          color: '#9CA3AF', // gray-400
        },
        grid: {
          color: '#374151', // gray-700
        }
      },
      y: {
        ticks: {
          color: '#9CA3AF', // gray-400
        },
        grid: {
          color: '#374151', // gray-700
        }
      }
    } : undefined,
    ...config.options
  };

  const renderChart = () => {
    try {
      const commonProps = {
        data: chartData,
        options: defaultOptions
      };

      switch (config.type) {
        case 'line':
          return <Line {...commonProps} />;
        case 'bar':
          return <Bar {...commonProps} />;
        case 'pie':
          return <Pie {...commonProps} />;
        case 'doughnut':
          return <Doughnut {...commonProps} />;
        default:
          return <div className="text-red-400">Tipo di grafico non supportato: {config.type}</div>;
      }
    } catch (error) {
      console.error('❌ [CHART] Error rendering chart', config.title, ':', error);
      return (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-center">
          <div className="text-red-400 text-sm">Errore nel rendering del grafico</div>
          <div className="text-red-300 text-xs mt-1">{error instanceof Error ? error.message : 'Errore sconosciuto'}</div>
        </div>
      );
    }
  };

  if (chartData.labels.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-center">
        <div className="text-gray-400">Nessun dato disponibile per il grafico</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
      <div className="h-64">
        {renderChart()}
      </div>
    </div>
  );
}
