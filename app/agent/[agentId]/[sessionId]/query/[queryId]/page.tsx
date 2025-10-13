'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Download, Heart, Info, X, Check, AlertCircle, RefreshCw, BrainCircuit, Code, ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import AgentChatSidebar from '@/app/components/AgentChatSidebar';
import DynamicChartsContainer from '@/app/components/charts/DynamicChartsContainer';

// Definizione tipi per grafici e KPI
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

interface QueryData {
  queryId: string;
  messageId: string;
  partIndex: number;
  part: {
    type: string;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    args?: Record<string, unknown>;
    result?: Record<string, unknown>;
    [key: string]: unknown;
  };
  message: {
    id: string;
    role: string;
    createdAt?: string;
    dbId?: string; // ID della riga nella tabella chat_messages
  };
  session: {
    id: string;
    title: string;
    createdAt: string;
  } | null;
}

export default function QueryPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const agentId = params.agentId as string;
  const sessionId = params.sessionId as string;
  const queryId = params.queryId as string;
  
  const [queryData, setQueryData] = useState<QueryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isQueryAccordionOpen, setIsQueryAccordionOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [queryTitle, setQueryTitle] = useState('');
  const [isEditMode, setIsEditMode] = useState(false); // Track if we're editing or creating new
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isQuerySaved, setIsQuerySaved] = useState(false);
  // Inizializza activeTab dal parametro URL o default a 'data'
  const [activeTab, setActiveTab] = useState<'data' | 'charts' | 'python'>(() => {
    const tabParam = searchParams.get('tab') as 'data' | 'charts' | 'python';
    return ['data', 'charts', 'python'].includes(tabParam) ? tabParam : 'data';
  });
  const [isAgentSidebarOpen, setIsAgentSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(25); // Default 25% of viewport width
  const [chartsConfig, setChartsConfig] = useState<ChartsKPIConfig | null>(null); // Chart/KPI configuration from saved query
  const [isRefreshing, setIsRefreshing] = useState(false); // Loading state for refresh
  const [refreshedData, setRefreshedData] = useState<Record<string, unknown> | null>(null); // Refreshed data from API
  const [savedQueryTitle, setSavedQueryTitle] = useState<string | null>(null); // Title from query_saved table
  const [showDownloadMenu, setShowDownloadMenu] = useState(false); // Show download format menu
  const [isDownloading, setIsDownloading] = useState(false); // Loading state for download
  const [currentPage, setCurrentPage] = useState(1); // Pagina corrente per paginazione
  const [pageSize, setPageSize] = useState(100); // Numero di record per pagina
  const [isLoadingFreshData, setIsLoadingFreshData] = useState(false); // Loading per dati freschi all'apertura
  const [freshData, setFreshData] = useState<unknown[] | null>(null); // Dati freschi caricati automaticamente
  const [freshDataTimestamp, setFreshDataTimestamp] = useState<string | null>(null); // Timestamp del caricamento fresh data

  // Funzione per caricare i dati freschi dal DB all'apertura
  const loadFreshData = async (messageId: string, isSaved: boolean, partIndex?: number) => {
    console.log('🔄 [QUERY-PAGE] Loading fresh data:', { messageId, isSaved, partIndex, agentId });
    setIsLoadingFreshData(true);
    try {
      // Usa execute (query salvate) o refresh (query da chat)
      const endpoint = isSaved ? '/api/query/execute' : '/api/query/refresh';
      
      console.log('📡 [QUERY-PAGE] Calling endpoint:', endpoint);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatMessageId: messageId,
          agentId: agentId,
          partIndex: partIndex // Passa il partIndex per identificare la query specifica
        })
      });

      console.log('📥 [QUERY-PAGE] Response status:', response.status);
      const result = await response.json();
      console.log('📊 [QUERY-PAGE] Response data:', { 
        success: result.success, 
        hasResults: !!(result.data?.results),
        resultsCount: result.data?.results?.length,
        error: result.error 
      });
      
      if (result.success && result.data && result.data.results) {
        setFreshData(result.data.results);
        setFreshDataTimestamp(new Date().toISOString()); // Salva timestamp del caricamento
        setCurrentPage(1); // Reset alla prima pagina
        console.log('✅ [QUERY-PAGE] Fresh data loaded successfully');
      } else {
        console.warn('⚠️ [QUERY-PAGE] Failed to load fresh data:', result.error);
      }
    } catch (error) {
      console.error('💥 [QUERY-PAGE] Error loading fresh data:', error);
    } finally {
      setIsLoadingFreshData(false);
    }
  };

  // Funzione per ricaricare la configurazione chart_kpi
  const reloadChartConfig = async () => {
    try {
      const messageDbId = queryData?.message?.dbId;
      if (!messageDbId) {
        console.warn('⚠️ [QUERY-PAGE] Cannot reload: messageDbId missing');
        return;
      }

      console.log('🔄 [QUERY-PAGE] Reloading chart config for:', messageDbId);
      
      const checkResponse = await fetch(`/api/query/save?chatMessageId=${messageDbId}`);
      const checkResult = await checkResponse.json();
      
      console.log('📊 [QUERY-PAGE] Fetch result:', checkResult);
      
      if (checkResult.success && checkResult.data && checkResult.data.length > 0) {
        const savedQuery = checkResult.data[0];
        
        console.log('📋 [QUERY-PAGE] Saved query chart_kpi:', savedQuery.chart_kpi);
        
        if (savedQuery.chart_kpi) {
          try {
            const config = typeof savedQuery.chart_kpi === 'string' 
              ? JSON.parse(savedQuery.chart_kpi) 
              : savedQuery.chart_kpi;
            
            console.log('✅ [QUERY-PAGE] Setting new chart config:', config);
            setChartsConfig(config);
            
            // Mostra notifica di successo
            setNotification({
              type: 'success',
              message: '✨ Dashboard aggiornata con successo!'
            });
          } catch (error) {
            console.error('❌ [QUERY-PAGE] Error parsing charts config:', error);
          }
        } else {
          console.log('ℹ️ [QUERY-PAGE] No chart_kpi found in saved query');
        }
      } else {
        console.warn('⚠️ [QUERY-PAGE] No saved query found');
      }
    } catch (error) {
      console.error('❌ [QUERY-PAGE] Error reloading chart config:', error);
    }
  };

  useEffect(() => {
    const loadQueryData = async () => {
      try {
        console.log('🔍 [QUERY-PAGE] Loading query data for queryId:', queryId);
        setIsLoading(true);
        const response = await fetch(`/api/chat/query/${queryId}`);
        const result = await response.json();

        console.log('📥 [QUERY-PAGE] Query data loaded:', { 
          success: result.success, 
          hasData: !!result.data,
          messageId: result.data?.message?.id,
          dbId: result.data?.message?.dbId
        });

        if (!result.success) {
          console.error('❌ [QUERY-PAGE] Failed to load query data:', result.error);
          setError(result.error || 'Failed to load query data');
          return;
        }

        setQueryData(result.data);
        
        // Per le API refresh/execute, dobbiamo usare sempre l'ID del messaggio AI, non l'ID della riga del DB
        const messageId = result.data.message.id; // ID del messaggio AI 
        const messageDbId = result.data.message.dbId; // ID della riga nel DB (per reference)
        console.log('🔑 [QUERY-PAGE] Using messageId for APIs:', { messageId, messageDbId });
        
        // Controlla se la query è già salvata
        console.log('🔍 [QUERY-PAGE] Checking if query is saved...');
        const checkResponse = await fetch(`/api/query/save?chatMessageId=${messageDbId}`);
        const checkResult = await checkResponse.json();
        
        console.log('💾 [QUERY-PAGE] Saved query check result:', { 
          success: checkResult.success, 
          dataLength: checkResult.data?.length 
        });
        
        const isSaved = checkResult.success && checkResult.data && checkResult.data.length > 0;
        setIsQuerySaved(isSaved);
        console.log('📌 [QUERY-PAGE] Query is saved:', isSaved);
        
        // Se salvata, carica anche chart config e titolo
        if (isSaved) {
          const savedQuery = checkResult.data[0];
          
          if (savedQuery.title) {
            setSavedQueryTitle(savedQuery.title);
          }
          
          if (savedQuery.chart_kpi) {
            try {
              const config = typeof savedQuery.chart_kpi === 'string' 
                ? JSON.parse(savedQuery.chart_kpi) 
                : savedQuery.chart_kpi;
              setChartsConfig(config);
            } catch (error) {
              console.error('Error parsing charts config:', error);
            }
          }
        }
        
        // Carica SEMPRE i dati freschi dal DB (sia salvata che non)
        console.log('🚀 [QUERY-PAGE] Starting fresh data load...');
        await loadFreshData(messageId, isSaved, result.data.partIndex);
      } catch (err) {
        console.error('💥 [QUERY-PAGE] Error in loadQueryData:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        console.log('✅ [QUERY-PAGE] Query data loading complete');
        setIsLoading(false);
      }
    };

    if (queryId) {
      loadQueryData();
    }
  }, [queryId]);

  // Auto-hide notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Close download menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showDownloadMenu && !target.closest('.relative')) {
        setShowDownloadMenu(false);
      }
    };
    
    if (showDownloadMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDownloadMenu]);

  // Helper per mostrare il dialog di salvataggio se non è già salvata
  const promptSaveIfNeeded = (action: string): boolean => {
    if (!isQuerySaved) {
      // Personalizza il messaggio in base all'azione
      let message = '';
      switch (action) {
        case 'download':
          message = 'Salva questa query per ritrovarla facilmente in futuro e gestire i download!';
          break;
        case 'refresh':
          message = 'Salva questa query per ritrovarla facilmente in futuro e aggiornare i dati!';
          break;
        case 'charts':
          message = 'Salva questa query per ritrovarla facilmente in futuro e creare grafici personalizzati!';
          break;
        case 'agent':
          message = 'Salva questa query per ritrovarla facilmente in futuro e analizzarla con l\'Agent!';
          break;
        default:
          message = 'Salva questa query per ritrovarla facilmente in futuro!';
      }
      
      setNotification({
        type: 'error',
        message
      });
      
      // Apri il dialog di salvataggio
      openSaveDialog();
      return false; // Blocca l'azione
    }
    return true; // Continua con l'azione
  };

  // Funzione per cambiare tab e aggiornare URL
  const handleTabChange = (newTab: 'data' | 'charts' | 'python') => {
    // Se cambio a charts, chiedi di salvare se non salvata
    if (newTab === 'charts' && !promptSaveIfNeeded('charts')) {
      return;
    }
    
    setActiveTab(newTab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', newTab);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  // Funzione per aggiornare i dati della query
  const refreshQueryData = async () => {
    // Check se deve salvare prima
    if (!promptSaveIfNeeded('refresh')) {
      return;
    }
    
    if (!queryData?.message?.id) {
      setNotification({
        type: 'error',
        message: 'Impossibile aggiornare: dati mancanti'
      });
      return;
    }

    setIsRefreshing(true);
    try {
      const response = await fetch('/api/query/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatMessageId: queryData.message.id, // Usa l'ID del messaggio AI per refresh
          agentId: agentId,
          partIndex: queryData.partIndex // Passa il partIndex per identificare la query specifica
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setRefreshedData(result.data);
        setFreshData(null); // Pulisci i dati freschi quando fai refresh manuale
        setFreshDataTimestamp(null); // Pulisci anche il timestamp
        setCurrentPage(1); // Reset alla prima pagina
        setNotification({
          type: 'success',
          message: 'Dati aggiornati con successo!'
        });
      } else {
        setNotification({
          type: 'error',
          message: 'Errore nell\'aggiornamento: ' + (result.error || 'Errore sconosciuto')
        });
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      setNotification({
        type: 'error',
        message: 'Errore nell\'aggiornamento dei dati'
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatTableData = () => {
    // Priorità: refreshedData > freshData > dati originali
    let data;
    
    if (refreshedData?.results) {
      data = refreshedData.results;
    } else if (freshData) {
      data = freshData;
    } else if (queryData?.part) {
      const output = queryData.part.output || queryData.part.result || {};
      if (!output || !output.results) return null;
      data = output.results;
    } else {
      return null;
    }
    
    try {
      if (Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === 'object') {
        const headers = Object.keys(data[0] as Record<string, unknown>);
        return { headers, rows: data };
      }
    } catch (e) {
      console.error('Error formatting table data:', e);
    }
    return null;
  };

  // Funzione per ottenere i dati paginati
  const getPaginatedData = () => {
    const allData = formatTableData();
    if (!allData) return null;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedRows = allData.rows.slice(startIndex, endIndex);

    return {
      headers: allData.headers,
      rows: paginatedRows,
      totalRows: allData.rows.length,
      totalPages: Math.ceil(allData.rows.length / pageSize),
      currentPage,
      pageSize
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-white rounded-full animate-bounce"></div>
          <div className="w-4 h-4 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-4 h-4 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    );
  }

  if (error || !queryData) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">❌ Errore</div>
          <div className="text-gray-300 mb-6">{error || 'Query non trovata'}</div>
          <button
            onClick={() => router.push(`/agent/${agentId}/${sessionId}`)}
            className="px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors"
          >
            Torna alla Chat
          </button>
        </div>
      </div>
    );
  }

  // Estrai i dati dalla query (stessa logica del DatabaseQueryButton)
  const input = queryData.part.input || queryData.part.args || {};
  const output = queryData.part.output || queryData.part.result || {};
  
  const query = input.query || output.query || '';
  const database = input.database || output.database || 'N/A';
  const purpose = input.purpose || output.purpose || '';
  const result = output;

  const tableData = formatTableData();
  const paginatedData = getPaginatedData();

  // Funzione per aprire il dialog di salvataggio (nuovo)
  const openSaveDialog = () => {
    const purpose = queryData?.part?.input?.purpose || queryData?.part?.output?.purpose || queryData?.part?.args?.purpose || '';
    setQueryTitle(String(purpose));
    setIsEditMode(false);
    setIsSaveDialogOpen(true);
  };

  // Funzione per aprire il dialog in modalità modifica
  const openEditDialog = () => {
    if (savedQueryTitle) {
      setQueryTitle(savedQueryTitle);
      setIsEditMode(true);
      setIsSaveDialogOpen(true);
    }
  };

  // Funzione per salvare o aggiornare la query
  const saveQuery = async () => {
    if (!queryData || !queryTitle.trim()) return;

    try {
      if (isEditMode) {
        // Modalità modifica: aggiorna solo il titolo
        const response = await fetch('/api/query/save', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatMessageId: queryData.message.dbId, // Usa l'ID della riga del DB per save
            title: queryTitle.trim()
          })
        });

        const result = await response.json();
        
        if (result.success) {
          setIsSaveDialogOpen(false);
          setSavedQueryTitle(queryTitle.trim()); // Update the displayed title
          setQueryTitle('');
          setNotification({
            type: 'success',
            message: 'Titolo aggiornato con successo!'
          });
        } else {
          setNotification({
            type: 'error',
            message: 'Errore nell\'aggiornamento: ' + (result.error || 'Errore sconosciuto')
          });
        }
      } else {
        // Modalità nuovo salvataggio
        const input = queryData.part.input || queryData.part.args || {};
        const output = queryData.part.output || queryData.part.result || {};
        
        const response = await fetch('/api/query/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatMessageId: queryData.message.dbId, // Usa l'ID della riga del DB per save
            query: input.query || output.query || '',
            title: queryTitle.trim(),
            body: {
              input,
              output,
              queryId: queryData.queryId,
              partIndex: queryData.partIndex
            }
          })
        });

        const result = await response.json();
        
        if (result.success) {
          setIsSaveDialogOpen(false);
          setSavedQueryTitle(queryTitle.trim()); // Update the displayed title
          setQueryTitle('');
          setIsQuerySaved(true); // Marca la query come salvata
          setNotification({
            type: 'success',
            message: 'Query salvata tra i preferiti!'
          });
        } else {
          setNotification({
            type: 'error',
            message: 'Errore nel salvataggio: ' + (result.error || 'Errore sconosciuto')
          });
        }
      }
    } catch (error) {
      console.error('Error saving/updating query:', error);
      setNotification({
        type: 'error',
        message: isEditMode ? 'Errore nell\'aggiornamento del titolo' : 'Errore nel salvataggio della query'
      });
    }
  };

  // Funzione per recuperare i dati dal DB
  const fetchDataForDownload = async () => {
    if (!queryData || !isQuerySaved) {
      setNotification({
        type: 'error',
        message: 'Impossibile scaricare: query non salvata'
      });
      return null;
    }

    try {
      // Esegui la query sul database oggetto di analisi
      const response = await fetch('/api/query/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatMessageId: queryData.message.dbId, // Usa l'ID della riga del DB per execute
          agentId: agentId
        })
      });

      const result = await response.json();
      
      if (!result.success || !result.data || !result.data.results) {
        setNotification({
          type: 'error',
          message: 'Errore nel recupero dei dati: ' + (result.error || 'Errore sconosciuto')
        });
        return null;
      }

      const data = result.data.results;
      
      if (!Array.isArray(data) || data.length === 0) {
        setNotification({
          type: 'error',
          message: 'Nessun dato disponibile per il download'
        });
        return null;
      }

      return {
        data,
        metadata: {
          totalCount: result.data.totalCount,          // Totale record nel DB
          returnedCount: result.data.returnedCount,    // Record effettivamente restituiti
          executionTime: result.data.executionTime,
          database: result.data.database,
          query: result.data.query,
          purpose: result.data.purpose,
          executedAt: result.data.executedAt,
          aiLimitApplied: result.data.aiLimitApplied   // Flag se è stato applicato un limite
        }
      };
    } catch (error) {
      console.error('Error fetching data:', error);
      setNotification({
        type: 'error',
        message: 'Errore durante il recupero dei dati'
      });
      return null;
    }
  };

  // Funzione per scaricare i dati come CSV
  const downloadCSV = async () => {
    // Check se deve salvare prima
    if (!promptSaveIfNeeded('download')) {
      setShowDownloadMenu(false);
      return;
    }
    
    setIsDownloading(true);
    setShowDownloadMenu(false); // Chiudi il menu
    try {
      const result = await fetchDataForDownload();
      if (!result) return;

      const { data } = result;
      const headers = Object.keys(data[0] as Record<string, unknown>);
      
      // Header CSV
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => {
            const value = String((row as Record<string, unknown>)[header] ?? '');
            // Escape virgolette e racchiudi in virgolette se contiene virgole o virgolette
            const escapedValue = value.replace(/"/g, '""');
            return value.includes(',') || value.includes('"') || value.includes('\n') 
              ? `"${escapedValue}"` 
              : escapedValue;
          }).join(',')
        )
      ].join('\n');
      
      // Crea e scarica il file
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      
      // Nome file con timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `query-${queryData?.queryId}-${timestamp}.csv`;
      link.download = filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      setNotification({
        type: 'success',
        message: 'CSV scaricato con successo!'
      });
      setShowDownloadMenu(false);
    } finally {
      setIsDownloading(false);
    }
  };

  // Funzione per scaricare i dati come XLSX
  const downloadXLSX = async () => {
    // Check se deve salvare prima
    if (!promptSaveIfNeeded('download')) {
      setShowDownloadMenu(false);
      return;
    }
    
    setIsDownloading(true);
    setShowDownloadMenu(false); // Chiudi il menu
    try {
      const result = await fetchDataForDownload();
      if (!result) return;

      const { data, metadata } = result;
      
      // Crea un nuovo workbook
      const workbook = XLSX.utils.book_new();
      
      // Foglio 1: Dati
      const dataSheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, dataSheet, 'Data');
      
      // Foglio 2: Download Info
      const downloadInfo = [
        { Property: 'Query Title', Value: savedQueryTitle || metadata.purpose || 'N/A' },
        { Property: 'Database', Value: metadata.database || 'N/A' },
        { Property: 'Total Records (DB)', Value: metadata.totalCount || 0 },
        { Property: 'Records Returned', Value: metadata.returnedCount || 0 },
        { Property: 'Execution Time', Value: metadata.executionTime || 'N/A' },
        { Property: 'Executed At', Value: new Date(metadata.executedAt).toLocaleString('it-IT') },
        { Property: 'Downloaded At', Value: new Date().toLocaleString('it-IT') },
        { Property: 'Limited', Value: metadata.aiLimitApplied ? 'Yes' : 'No' },
        { Property: 'Query ID', Value: queryData?.queryId || 'N/A' },
        { Property: 'Session ID', Value: sessionId || 'N/A' },
        { Property: '', Value: '' },
        { Property: 'SQL Query', Value: '' },
        { Property: metadata.query || '', Value: '' }
      ];
      
      const infoSheet = XLSX.utils.json_to_sheet(downloadInfo);
      
      // Imposta la larghezza delle colonne per il foglio info
      infoSheet['!cols'] = [
        { wch: 20 },  // Property column
        { wch: 60 }   // Value column
      ];
      
      XLSX.utils.book_append_sheet(workbook, infoSheet, 'Download Info');
      
      // Genera il file
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `query-${queryData?.queryId}-${timestamp}.xlsx`;
      XLSX.writeFile(workbook, filename);
      
      setNotification({
        type: 'success',
        message: 'XLSX scaricato con successo!'
      });
      setShowDownloadMenu(false);
    } catch (error) {
      console.error('Error creating XLSX:', error);
      setNotification({
        type: 'error',
        message: 'Errore durante la creazione del file XLSX'
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="h-screen bg-black text-white flex overflow-hidden">
      <style jsx>{`
        .custom-scrollbar {
          scrollbar-width: auto;
          scrollbar-color: #6B7280 #374151;
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #374151;
          border-radius: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #6B7280;
          border-radius: 6px;
          border: 2px solid #374151;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9CA3AF;
        }
        
        .custom-scrollbar::-webkit-scrollbar-corner {
          background: #374151;
        }
      `}</style>
      
      {/* Main Content */}
      <div 
        className="flex-1 flex flex-col overflow-hidden transition-all duration-300"
        style={{
          marginRight: isAgentSidebarOpen ? `${sidebarWidth}vw` : '0'
        }}
      >
        {/* Header con fisarmonica */}
        <div className="border-b border-gray-700">
        <div className="flex items-center justify-between px-6 py-3 hover:bg-gray-900/30 transition-colors">
          <div 
            className="flex items-center gap-3 flex-1 cursor-pointer"
            onClick={() => setIsQueryAccordionOpen(!isQueryAccordionOpen)}
          >
            {isQueryAccordionOpen ? (
              <ChevronUp className="w-6 h-6 text-blue-400" />
            ) : (
              <ChevronDown className="w-6 h-6 text-blue-400" />
            )}
            {(savedQueryTitle || purpose) && (
              <span 
                className={`text-lg font-medium text-white ${isQuerySaved ? 'hover:text-blue-400 transition-colors' : ''}`}
                onClick={isQuerySaved ? (e) => {
                  e.stopPropagation();
                  openEditDialog();
                } : undefined}
                title={isQuerySaved ? 'Clicca per modificare il titolo' : undefined}
              >
                {String(savedQueryTitle || purpose)}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative group">
              <Info className="w-5 h-5 text-gray-400 hover:text-gray-300 cursor-help" />
              <div className="absolute right-0 top-8 bg-gray-800 text-white text-xs rounded-lg p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 w-64">
                Salvando la query tra le preferite sarà più facile ritrovarla in futuro per riutilizzarla
              </div>
            </div>
            
            <button
              onClick={isQuerySaved ? undefined : openSaveDialog}
              disabled={isQuerySaved}
              className={`group flex items-center p-2 rounded-lg border text-sm transition-all duration-300 overflow-hidden ${
                isQuerySaved
                  ? 'bg-gray-800/50 border-gray-500/50 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-800 hover:bg-gray-700 border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white'
              }`}
              title={isQuerySaved ? "Query già salvata tra i preferiti" : "Salva query tra i preferiti"}
            >
              <Heart className={`w-4 h-4 flex-shrink-0 ${isQuerySaved ? 'text-red-400' : ''}`} />
              <span className="whitespace-nowrap font-medium opacity-0 group-hover:opacity-100 max-w-0 group-hover:max-w-xs group-hover:ml-2 transition-all duration-300">
                {isQuerySaved ? 'Query salvata' : 'Salva query'}
              </span>
            </button>
            
            <button
              onClick={() => {
                // Se già aperta, chiudi senza check
                if (isAgentSidebarOpen) {
                  setIsAgentSidebarOpen(false);
                  return;
                }
                // Se non aperta, check se deve salvare prima di aprire
                if (promptSaveIfNeeded('agent')) {
                  setIsAgentSidebarOpen(true);
                }
              }}
              className={`group flex items-center p-2 rounded-lg border transition-all duration-300 overflow-hidden ${
                isAgentSidebarOpen
                  ? 'bg-white text-black border-gray-300 hover:bg-gray-100'
                  : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'
              }`}
              title={isAgentSidebarOpen ? "Chiudi Agent AI" : "Apri Agent AI"}
            >
              <BrainCircuit size={16} className="flex-shrink-0" />
              <span className="whitespace-nowrap text-sm font-medium opacity-0 group-hover:opacity-100 max-w-0 group-hover:max-w-xs group-hover:ml-2 transition-all duration-300">
                Agent
              </span>
            </button>
          </div>
        </div>
        {isQueryAccordionOpen && (
          <div className="px-6 pb-6">
            <h1 className="text-lg font-medium text-white mb-4">Query</h1>
            <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
              <pre className="text-gray-300 text-sm font-mono whitespace-pre-wrap overflow-x-auto">
                {String(query)}
              </pre>
            </div>
            
            {/* Dati aggiuntivi visibili solo con fisarmonica aperta */}
            <div className="mt-4 pt-4 border-t border-gray-800 text-sm text-gray-500 space-y-1">
              <div>Database: <span className="text-gray-400">{String(database)}</span></div>
              {queryData.session?.title && (
                <div>Sessione: <span className="text-gray-400">{queryData.session.title}</span></div>
              )}
              <div>Query ID: <span className="text-gray-400">{queryData.queryId}</span></div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs Section */}
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <button
                onClick={() => handleTabChange('data')}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  activeTab === 'data'
                    ? 'bg-gray-800 border-gray-600 text-white'
                    : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-gray-800 hover:border-gray-600'
                }`}
              >
                Dati
              </button>
              <button
                onClick={() => handleTabChange('charts')}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  activeTab === 'charts'
                    ? 'bg-gray-800 border-gray-600 text-white'
                    : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-gray-800 hover:border-gray-600'
                }`}
              >
                Grafici e KPI
              </button>
              <button
                onClick={() => handleTabChange('python')}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  activeTab === 'python'
                    ? 'bg-gray-800 border-gray-600 text-white'
                    : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-gray-800 hover:border-gray-600'
                }`}
              >
                Analisi pro con python
              </button>
            </div>
            
            {/* Info e controlli - visibili per entrambe le tab */}
            {result?.success !== false && (
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-400">
                  {paginatedData ? (
                    <>
                      {paginatedData.totalRows} record
                      {paginatedData.totalRows > pageSize && (
                        <span className="ml-2">
                          (pagina {currentPage} di {paginatedData.totalPages})
                        </span>
                      )}
                      {/* Execution time e timestamp */}
                      <span className="ml-2">
                        • {String(refreshedData?.executionTime || result?.executionTime || 'N/A')}
                      </span>
                      <span className="ml-2">
                        • {
                          refreshedData?.refreshedAt 
                            ? new Date(String(refreshedData.refreshedAt)).toLocaleString('it-IT', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })
                            : freshDataTimestamp 
                              ? new Date(freshDataTimestamp).toLocaleString('it-IT', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })
                              : 'N/A'
                        }
                      </span>
                    </>
                  ) : (
                    `${String(refreshedData?.totalCount || result?.totalCount || 0)} record totali`
                  )}
                  {isLoadingFreshData && (
                    <span className="ml-2 text-blue-400">⏳ Caricamento...</span>
                  )}
                </div>
                {tableData && (
                  <div className="flex gap-2">
                    <div className="relative">
                      <button
                        onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                        disabled={isDownloading}
                        className="group flex items-center p-2 bg-gray-800 text-gray-300 rounded-lg border border-gray-700 hover:bg-gray-700 hover:text-white disabled:bg-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed transition-all duration-300 overflow-hidden"
                        title="Scarica dati (esegue query sul DB)"
                      >
                        {isDownloading ? (
                          <RefreshCw size={16} className="flex-shrink-0 animate-spin" />
                        ) : (
                          <Download size={16} className="flex-shrink-0" />
                        )}
                        <span className="whitespace-nowrap text-sm font-medium opacity-0 group-hover:opacity-100 max-w-0 group-hover:max-w-xs group-hover:ml-2 transition-all duration-300">
                          {isDownloading ? 'Download...' : 'Scarica'}
                        </span>
                      </button>
                      
                      {/* Download Menu */}
                      {showDownloadMenu && !isDownloading && (
                        <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[180px]">
                          <button
                            onClick={downloadCSV}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors rounded-t-lg"
                          >
                            <Download size={16} />
                            <span>Scarica CSV</span>
                          </button>
                          <button
                            onClick={downloadXLSX}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors rounded-b-lg border-t border-gray-700"
                          >
                            <FileSpreadsheet size={16} />
                            <span>Scarica XLSX</span>
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={refreshQueryData}
                      disabled={isRefreshing}
                      className="group flex items-center p-2 bg-gray-800 text-gray-300 rounded-lg border border-gray-700 hover:bg-gray-700 hover:text-white disabled:bg-gray-600 disabled:text-gray-500 disabled:cursor-not-allowed transition-all duration-300 overflow-hidden"
                      title="Aggiorna dati dal database"
                    >
                      <RefreshCw size={16} className={`flex-shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span className="whitespace-nowrap text-sm font-medium opacity-0 group-hover:opacity-100 max-w-0 group-hover:max-w-xs group-hover:ml-2 transition-all duration-300">
                        {isRefreshing ? 'Aggiornamento...' : 'Aggiorna'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 px-6 flex flex-col overflow-hidden">
          {activeTab === 'data' && (
            <>
              {result?.success === false ? (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 text-center">
              <div className="text-red-400 text-lg mb-2">❌ Errore nell&apos;esecuzione della query</div>
              <div className="text-red-300 text-sm">
                {String(result.error || 'Errore sconosciuto')}
              </div>
            </div>
           ) : paginatedData ? (
             <div className="flex-1 flex flex-col min-h-0 gap-3">
               {/* Controlli paginazione superiori */}
               {paginatedData.totalRows > pageSize && (
                 <div className="flex items-center justify-between bg-gray-900 rounded-lg border border-gray-700 px-4 py-2">
                   <div className="flex items-center gap-2">
                     <span className="text-sm text-gray-400">Righe per pagina:</span>
                     <select
                       value={pageSize}
                       onChange={(e) => {
                         setPageSize(Number(e.target.value));
                         setCurrentPage(1);
                       }}
                       className="bg-gray-800 text-white text-sm rounded border border-gray-600 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                     >
                       <option value={100}>100</option>
                       <option value={200}>200</option>
                       <option value={500}>500</option>
                     </select>
                   </div>
                   <div className="flex items-center gap-3">
                     <span className="text-sm text-gray-400">
                       Mostrando {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, paginatedData.totalRows)} di {paginatedData.totalRows}
                     </span>
                     <div className="flex gap-1">
                       <button
                         onClick={() => setCurrentPage(1)}
                         disabled={currentPage === 1}
                         className="px-3 py-1 text-sm bg-gray-800 text-gray-300 rounded border border-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                       >
                         Prima
                       </button>
                       <button
                         onClick={() => setCurrentPage(currentPage - 1)}
                         disabled={currentPage === 1}
                         className="px-3 py-1 text-sm bg-gray-800 text-gray-300 rounded border border-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                       >
                         ← Prec
                       </button>
                       <button
                         onClick={() => setCurrentPage(currentPage + 1)}
                         disabled={currentPage === paginatedData.totalPages}
                         className="px-3 py-1 text-sm bg-gray-800 text-gray-300 rounded border border-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                       >
                         Succ →
                       </button>
                       <button
                         onClick={() => setCurrentPage(paginatedData.totalPages)}
                         disabled={currentPage === paginatedData.totalPages}
                         className="px-3 py-1 text-sm bg-gray-800 text-gray-300 rounded border border-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                       >
                         Ultima
                       </button>
                     </div>
                   </div>
                 </div>
               )}
               
               {/* Tabella dati */}
               <div className="flex-1 bg-gray-900 rounded-lg border border-gray-700 overflow-hidden min-h-0">
                 <div className="overflow-auto h-full custom-scrollbar">
                   <table className="w-full text-sm min-w-max">
                     <thead className="bg-gray-800 sticky top-0 z-10">
                       <tr>
                         {paginatedData.headers.map((header, index) => (
                           <th key={index} className="px-4 py-3 text-left text-gray-300 font-medium border-b border-gray-600 whitespace-nowrap">
                             {header}
                           </th>
                         ))}
                       </tr>
                     </thead>
                     <tbody>
                       {paginatedData.rows.map((row, rowIndex) => (
                         <tr key={rowIndex} className="border-b border-gray-800 hover:bg-gray-800/50">
                           {paginatedData.headers.map((header, colIndex) => (
                             <td key={colIndex} className="px-4 py-3 text-gray-300 whitespace-nowrap">
                               {String((row as Record<string, unknown>)[header] ?? '')}
                             </td>
                           ))}
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
             </div>
          ) : (
            <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-center">
              <div className="text-gray-400">
                {isLoadingFreshData ? 'Caricamento dati in corso...' : 'Nessun dato da visualizzare'}
              </div>
            </div>
          )}
            </>
          )}
          
          {activeTab === 'charts' && (
            <DynamicChartsContainer
              config={chartsConfig}
              data={tableData?.rows || []} // Usa tutti i dati per i grafici, non paginati
              onOpenAgentChat={() => {
                // Check se deve salvare prima di aprire l'Agent
                if (promptSaveIfNeeded('agent')) {
                  setIsAgentSidebarOpen(true);
                }
              }}
            />
          )}
          
          {activeTab === 'python' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="bg-gray-900 rounded-lg border border-gray-700 p-8 text-center" style={{ width: '50vw' }}>
                <div className="flex items-center justify-center mb-4">
                  <Code className="w-8 h-8 text-gray-400 mr-3" />
                  <h3 className="text-xl font-semibold text-gray-300">Analisi Dati con Python</h3>
                </div>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  <span className="text-yellow-300 text-sm font-medium">In sviluppo</span>
                </div>
                <p className="text-gray-400 text-base leading-relaxed">
                  Stiamo lavorando all&apos;implementazione di questa funzionalità e sarà presto disponibile in beta.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Agent Chat Sidebar */}
      <div 
        className={`fixed top-0 right-0 h-full transform transition-all duration-300 z-40 ${
          isAgentSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          width: `${sidebarWidth}vw`
        }}
      >
        <AgentChatSidebar
          isOpen={isAgentSidebarOpen}
          onClose={() => setIsAgentSidebarOpen(false)}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          queryContext={{
            query: String(query),
            database: String(database),
            purpose: String(purpose),
            sessionId,
            queryId,
            chatMessageId: queryData?.message?.dbId || queryData?.message?.id
          }}
          onChartsUpdated={reloadChartConfig}
        />
      </div>

      {/* Dialog per salvare query */}
      {isSaveDialogOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setIsSaveDialogOpen(false)}
        >
          <div 
            className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl min-w-[60vw] max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-lg font-medium text-white">
                {isEditMode ? 'Modifica Titolo Query' : 'Salva Query Preferita'}
              </h2>
              <button
                onClick={() => setIsSaveDialogOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <label htmlFor="queryTitle" className="block text-sm font-medium text-gray-300 mb-2">
                  Titolo della query
                </label>
                <input
                  id="queryTitle"
                  type="text"
                  value={queryTitle}
                  onChange={(e) => setQueryTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Inserisci un titolo per la query..."
                  autoFocus
                />
              </div>
              
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsSaveDialogOpen(false)}
                  className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={saveQuery}
                  disabled={!queryTitle.trim()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-600 disabled:cursor-not-allowed border border-gray-600 hover:border-gray-500 disabled:border-gray-600 rounded-md text-sm text-gray-300 hover:text-white disabled:text-gray-500 transition-all duration-200"
                >
                  <Heart className="w-4 h-4" />
                  {isEditMode ? 'Aggiorna' : 'Salva'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
            notification.type === 'success' 
              ? 'bg-green-900/90 border-green-500/50 text-green-100' 
              : 'bg-red-900/90 border-red-500/50 text-red-100'
          } backdrop-blur-sm`}>
            {notification.type === 'success' ? (
              <Check className="w-5 h-5 text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
