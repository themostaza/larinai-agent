// Schema per la configurazione di grafici e KPI
export interface ChartKPIConfig {
  version: string; // Schema version per backwards compatibility
  layout: {
    columns: number; // Griglia responsive (1-4 colonne)
    gap: number; // Spacing tra i componenti
  };
  components: Array<KPIComponent | ChartComponent>;
}

export interface BaseComponent {
  id: string;
  type: 'kpi' | 'chart';
  title: string;
  position: {
    row: number;
    col: number;
    width: number; // Span di colonne (1-4)
    height: number; // Altezza in unità grid
  };
  dataSource: {
    column: string; // Nome colonna dai risultati query
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last';
    filter?: {
      column: string;
      operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
      value: string | number;
    };
  };
}

export interface KPIComponent extends BaseComponent {
  type: 'kpi';
  config: {
    format: 'number' | 'currency' | 'percentage' | 'date';
    prefix?: string;
    suffix?: string;
    decimals?: number;
    trend?: {
      column: string; // Colonna per confronto trend
      format: 'percentage' | 'absolute';
    };
    color: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';
    icon?: string; // Nome icona Lucide
  };
}

export interface ChartComponent extends BaseComponent {
  type: 'chart';
  config: {
    chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'area';
    xAxis?: {
      column: string;
      label?: string;
      type?: 'category' | 'number' | 'date';
    };
    yAxis?: {
      column: string;
      label?: string;
      aggregation?: 'sum' | 'avg' | 'count';
    };
    colors: string[]; // Array di colori hex
    options?: {
      showLegend: boolean;
      showGrid: boolean;
      responsive: boolean;
    };
  };
}

// Esempio di configurazione predefinita
export const DEFAULT_CHART_CONFIG: ChartKPIConfig = {
  version: "1.0",
  layout: {
    columns: 2,
    gap: 4
  },
  components: [
    {
      id: "total-records",
      type: "kpi",
      title: "Totale Record",
      position: { row: 1, col: 1, width: 1, height: 1 },
      dataSource: {
        column: "*",
        aggregation: "count"
      },
      config: {
        format: "number",
        color: "blue",
        icon: "Database"
      }
    },
    {
      id: "summary-chart",
      type: "chart",
      title: "Distribuzione Dati",
      position: { row: 1, col: 2, width: 1, height: 2 },
      dataSource: {
        column: "auto" // Auto-detect prima colonna categorica
      },
      config: {
        chartType: "bar",
        colors: ["#3B82F6", "#10B981", "#F59E0B"],
        options: {
          showLegend: true,
          showGrid: true,
          responsive: true
        }
      }
    }
  ]
};
