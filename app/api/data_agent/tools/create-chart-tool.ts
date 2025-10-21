import { tool } from 'ai';
import { z } from 'zod';

// Schema per la configurazione KPI
const KPIConfigSchema = z.object({
  id: z.string().describe('ID univoco per il KPI'),
  title: z.string().describe('Titolo del KPI da visualizzare'),
  type: z.enum(['number', 'percentage', 'currency']).describe('Tipo di formattazione del valore'),
  query_field: z.string().describe('Nome del campo nei dati da cui estrarre il valore'),
  format: z.string().optional().describe('Formato personalizzato (es. "0,0" per numeri con migliaia)'),
  aggregation: z.enum(['sum', 'avg', 'count', 'min', 'max']).optional().describe('Tipo di aggregazione da applicare ai dati'),
  icon: z.string().optional().describe('Nome icona Lucide React (es. "TrendingUp", "Users", "DollarSign")')
});

// Schema per la configurazione Chart
const ChartConfigSchema = z.object({
  id: z.string().describe('ID univoco per il grafico'),
  title: z.string().describe('Titolo del grafico da visualizzare'),
  type: z.enum(['line', 'bar', 'pie', 'doughnut']).describe('Tipo di grafico'),
  data: z.object({
    x_field: z.string().describe('Campo dati per asse X (categorie, date, etc.)'),
    y_field: z.string().describe('Campo dati per asse Y (valori numerici)'),
    group_by: z.string().optional().describe('Campo per raggruppare i dati (per serie multiple)')
  }),
  options: z.record(z.string(), z.unknown()).optional().describe('Opzioni aggiuntive per Chart.js')
});

// Schema per la configurazione completa
const ChartsKPIConfigSchema = z.object({
  version: z.string().describe('Versione della configurazione (usa "1.0")'),
  kpis: z.array(KPIConfigSchema).optional().describe('Array di configurazioni KPI'),
  charts: z.array(ChartConfigSchema).optional().describe('Array di configurazioni grafici')
});

export const createChartTool = tool({
  description: `
Crea una configurazione JSON per grafici e KPI da salvare nel database per visualizzazioni future.

STRUTTURA DATI ATTESA DAL RENDERIZZATORE:

**KPI Configuration:**
- id: identificatore univoco (es. "total_sales", "avg_order_value")
- title: titolo visualizzato (es. "Vendite Totali", "Valore Medio Ordine")
- type: "number" (numeri interi), "percentage" (con %), "currency" (con €)
- query_field: nome ESATTO del campo nei dati (case-sensitive)
- aggregation: come aggregare i dati - "sum" (somma), "avg" (media), "count" (conteggio), "min", "max"
- format: formato numerico opzionale (usa "0,0" per migliaia, "0,0.00" per decimali)
- icon: nome icona Lucide React (es. "TrendingUp", "Users", "DollarSign", "ShoppingCart")

**Chart Configuration:**
- id: identificatore univoco (es. "sales_by_month", "top_products")  
- title: titolo del grafico
- type: "line" (linee per trend), "bar" (barre per confronti), "pie"/"doughnut" (torte per %)
- data.x_field: campo per asse X (categorie, date) - nome ESATTO dal dataset
- data.y_field: campo per asse Y (valori numerici) - nome ESATTO dal dataset  
- data.group_by: campo opzionale per serie multiple (es. per linee multiple)

**ESEMPI PRATICI:**

Per dati vendite con campi [product_name, sales_amount, order_date, quantity]:

KPI esempio:
{
  "id": "total_revenue",
  "title": "Fatturato Totale", 
  "type": "currency",
  "query_field": "sales_amount",
  "aggregation": "sum",
  "icon": "DollarSign"
}

Grafico esempio:
{
  "id": "sales_trend",
  "title": "Trend Vendite nel Tempo",
  "type": "line", 
  "data": {
    "x_field": "order_date",
    "y_field": "sales_amount"
  }
}

**REGOLE IMPORTANTI:**
1. I nomi dei campi (query_field, x_field, y_field) devono corrispondere ESATTAMENTE ai nomi delle colonne nei dati
2. Usa aggregation per KPI quando hai più righe da aggregare
3. Per grafici temporali usa type "line", per confronti usa "bar", per distribuzioni usa "pie"
4. Crea sempre almeno 1 KPI per le metriche principali
5. Non superare 4-5 grafici per evitare sovraccarico visivo
6. Per pie/doughnut limita a max 8 categorie

Il tool salverà automaticamente la configurazione nel database per la query corrente.

**IMPORTANTE:** Usa sempre il Chat Message ID fornito nel contesto della conversazione per il parametro chatMessageId.
`,
  inputSchema: z.object({
    chatMessageId: z.string().describe('ID del messaggio chat associato alla query salvata'),
    config: ChartsKPIConfigSchema.describe('Configurazione completa di grafici e KPI')
  }),
  execute: async ({ config, chatMessageId }: { config: z.infer<typeof ChartsKPIConfigSchema>; chatMessageId: string }) => {
    console.log(`🎨 [CREATE-CHART-TOOL] ============ TOOL EXECUTION START ============`);
    console.log(`🎨 [CREATE-CHART-TOOL] Creating chart config for message ID: ${chatMessageId}`);
    console.log(`🎨 [CREATE-CHART-TOOL] Config:`, JSON.stringify(config, null, 2));
    console.log(`🎨 [CREATE-CHART-TOOL] Timestamp: ${new Date().toISOString()}`);
    
    try {
      // Chiamata all'API per salvare la configurazione
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
        process.env.NEXTAUTH_URL || 
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      const apiUrl = `${baseUrl}/api/query/save`;
      
      console.log(`🎨 [CREATE-CHART-TOOL] Making request to: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        method: 'PUT', // Usa PUT per update
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatMessageId,
          chart_kpi: config
        })
      });

      console.log(`🎨 [CREATE-CHART-TOOL] Response status: ${response.status}`);
      
      if (!response.ok) {
        console.log(`🎨 [CREATE-CHART-TOOL] Response not ok: ${response.status} ${response.statusText}`);
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          chatMessageId,
          config
        };
      }

      const result = await response.json();
      console.log(`🎨 [CREATE-CHART-TOOL] Save result:`, { success: result.success });

      if (!result.success) {
        console.log(`🎨 [CREATE-CHART-TOOL] Save failed:`, result.error);
        return {
          success: false,
          error: result.error,
          chatMessageId,
          config
        };
      }

      console.log(`🎨 [CREATE-CHART-TOOL] Chart configuration saved successfully`);
      return {
        success: true,
        message: 'Configurazione grafici e KPI salvata con successo!',
        chatMessageId,
        config,
        kpis_created: config.kpis?.length || 0,
        charts_created: config.charts?.length || 0
      };

    } catch (error) {
      console.error('🎨 [CREATE-CHART-TOOL] Error saving chart config:', error);
      return {
        success: false,
        error: `Errore nel salvataggio: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
        chatMessageId,
        config
      };
    }
  },
});
