'use client';

import React from 'react';
import { Database } from 'lucide-react';

interface DatabaseQueryButtonProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  part: any; // Use any to handle complex AI SDK types
  messageId: string;
  partIndex: number;
}

export default function DatabaseQueryButton({ part, messageId, partIndex }: DatabaseQueryButtonProps) {
  // Non abbiamo più bisogno del dialog state
  // const [isDialogOpen, setIsDialogOpen] = useState(false);
  // const [isQueryAccordionOpen, setIsQueryAccordionOpen] = useState(true);

  // I dati possono essere nella struttura dell'AI SDK (input/output) o nella vecchia struttura (args/result)
  const input = part.input || part.args || {};
  const output = part.output || part.result || {};
  
  const query = input.query || output.query || '';
  const database = input.database || output.database || 'N/A';
  const purpose = input.purpose || output.purpose || '';
  const result = output;

  // Genera l'ID della query per il routing
  const queryId = `${messageId}-${partIndex}`;

  // Funzione per aprire la query in una nuova tab
  const openQueryInNewTab = () => {
    // Estrai agentId e sessionId dall'URL corrente
    const currentPath = window.location.pathname;
    const pathMatch = currentPath.match(/\/agent\/([^\/]+)\/([^\/]+)/);
    const agentId = pathMatch ? pathMatch[1] : 'unknown';
    const sessionId = pathMatch ? pathMatch[2] : 'unknown';
    
    const queryUrl = `/agent/${agentId}/${sessionId}/query/${queryId}`;
    window.open(queryUrl, '_blank');
  };

  return (
    <>
      {/* Button Component */}
      <button
        onClick={openQueryInNewTab}
        className="w-full mt-3 p-4 bg-gray-800 hover:bg-gray-700 border border-blue-500 hover:border-blue-400 rounded-lg transition-all duration-200 text-left group"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            <Database className="w-5 h-5 text-blue-400 group-hover:text-blue-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-blue-400 group-hover:text-blue-300 text-sm font-semibold mb-1">
              Accesso al database: {database}
            </div>
            <div className="text-gray-300 text-xs font-normal break-all">
              {query.length > 100 ? `${query.substring(0, 100)}...` : query}
            </div>
            {purpose && (
              <div className="text-gray-400 text-xs mt-1">
                <strong>Scopo:</strong> {purpose}
              </div>
            )}
            <div className="text-xs text-gray-500 mt-2 flex items-center justify-between">
              {result?.success === false ? (
                <span className="text-red-400">❌ Errore</span>
              ) : (
                <span className="text-green-400">
                  ✓ {result?.totalCount || 0} totali
                  {result?.aiLimitApplied && result?.returnedCount && (
                    <span className="text-gray-400"> ({result.returnedCount} analizzati)</span>
                  )}
                  {' • '}{result?.executionTime || 'N/A'}
                </span>
              )}
              <span className="text-gray-400">Clicca per aprire in nuova tab →</span>
            </div>
          </div>
        </div>
      </button>
    </>
  );
}
