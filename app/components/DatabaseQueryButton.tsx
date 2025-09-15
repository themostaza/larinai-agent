'use client';

import React, { useState } from 'react';
import { Database, X } from 'lucide-react';

interface DatabaseQueryButtonProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  part: any; // Use any to handle complex AI SDK types
  messageId: string;
  partIndex: number;
}

export default function DatabaseQueryButton({ part }: DatabaseQueryButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // I dati possono essere nella struttura dell'AI SDK (input/output) o nella vecchia struttura (args/result)
  const input = part.input || part.args || {};
  const output = part.output || part.result || {};
  
  const query = input.query || output.query || '';
  const database = input.database || output.database || 'N/A';
  const purpose = input.purpose || output.purpose || '';
  const result = output;

  const formatTableData = () => {
    if (!result || !result.results) return null;
    
    try {
      const data = result.results;
      if (Array.isArray(data) && data.length > 0 && data[0] && typeof data[0] === 'object') {
        const headers = Object.keys(data[0] as Record<string, unknown>);
        return { headers, rows: data };
      }
    } catch (e) {
      console.error('Error formatting table data:', e);
    }
    return null;
  };

  const tableData = formatTableData();

  return (
    <>
      {/* Button Component */}
      <button
        onClick={() => setIsDialogOpen(true)}
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
                  ✓ {result?.rowCount || 0} righe • {result?.executionTime || 'N/A'}
                </span>
              )}
              <span className="text-gray-400">Clicca per vedere dettagli →</span>
            </div>
          </div>
        </div>
      </button>

      {/* Full-Screen Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Database className="w-6 h-6 text-blue-400" />
              <div>
                <h2 className="text-xl font-semibold text-white">Query Database</h2>
                <p className="text-sm text-gray-400">{database}</p>
              </div>
            </div>
            <button
              onClick={() => setIsDialogOpen(false)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-400 hover:text-white" />
            </button>
          </div>

          {/* Query Section */}
          <div className="p-6 border-b border-gray-800">
            <h3 className="text-lg font-medium text-white mb-3">Query Eseguita</h3>
            <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
              <pre className="text-gray-300 text-sm font-mono whitespace-pre-wrap overflow-x-auto">
                {query}
              </pre>
            </div>
            {purpose && (
              <div className="mt-3 text-sm text-gray-400">
                <strong>Scopo:</strong> {purpose}
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="flex-1 p-6 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">Risultati</h3>
              {result?.success !== false && (
                <div className="text-sm text-gray-400">
                  {result?.rowCount || 0} righe • {result?.executionTime || 'N/A'}
                  {result?.truncated && (
                    <span className="text-yellow-400 ml-2">⚠️ Troncato</span>
                  )}
                </div>
              )}
            </div>

            {result?.success === false ? (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 text-center">
                <div className="text-red-400 text-lg mb-2">❌ Errore nell&apos;esecuzione della query</div>
                <div className="text-red-300 text-sm">
                  {result.error || 'Errore sconosciuto'}
                </div>
              </div>
            ) : tableData ? (
              <div className="flex-1 overflow-auto bg-gray-900 rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 sticky top-0">
                    <tr>
                      {tableData.headers.map((header, index) => (
                        <th key={index} className="px-4 py-3 text-left text-gray-300 font-medium border-b border-gray-600">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-gray-800 hover:bg-gray-800/50">
                        {tableData.headers.map((header, colIndex) => (
                          <td key={colIndex} className="px-4 py-3 text-gray-300 max-w-xs truncate">
                            {String((row as Record<string, unknown>)[header] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 text-center">
                <div className="text-gray-400">Nessun dato da visualizzare</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
