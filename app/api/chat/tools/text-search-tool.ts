import { tool } from 'ai';
import { z } from 'zod';

interface TextSearchToolConfig {
  description?: string;
  documentContent?: string;
  title?: string;
}

export const textSearchTool = (config?: unknown) => {
  const toolConfig = config as TextSearchToolConfig | undefined;
  
  const documentContent = toolConfig?.documentContent || '';
  const documentName = toolConfig?.title || 'Documento';
  const customDescription = toolConfig?.description || 'Cerca informazioni specifiche all\'interno di un documento testuale.';

  // Calcola statistiche del documento
  const docLength = documentContent.length;
  const docLines = documentContent.split('\n').length;
  const docWords = documentContent.split(/\s+/).filter(w => w.length > 0).length;

  const baseDescription = `

DOCUMENTO DISPONIBILE:
- Nome: ${documentName}
- Dimensione: ${docLength.toLocaleString()} caratteri, ${docLines.toLocaleString()} righe, ~${docWords.toLocaleString()} parole

Questo tool ti permette di cercare informazioni specifiche nel documento senza dover caricare tutto il contenuto nel contesto.
Quando l'utente fa domande relative al contenuto del documento, usa questo tool per trovare le sezioni rilevanti.

COME FUNZIONA:
- Specifica le parole chiave o la frase da cercare
- Il sistema troverà tutte le occorrenze e restituirà il contesto circostante
- Riceverai solo le parti rilevanti del documento, risparmiando token di contesto

QUANDO USARLO:
- L'utente chiede informazioni specifiche contenute nel documento
- Devi verificare se un certo argomento è trattato nel documento
- Devi citare parti specifiche del documento
- L'utente fa domande su procedure, policy, o istruzioni contenute nel documento`;

  const description = `${customDescription}${baseDescription}`;

  // Log della descrizione per debug
  console.log('📄 [TEXT-SEARCH-TOOL] Descrizione finale per l\'AI:', description);

  return tool({
    description,
    inputSchema: z.object({
      searchQuery: z.string().describe('Le parole chiave o la frase da cercare nel documento. Usa termini specifici e rilevanti alla domanda dell\'utente.'),
      contextLines: z.number().optional().describe('Quante righe di contesto includere prima e dopo ogni match (default: 15). Usa valori più alti per contesto più ampio.')
    }),
    execute: async ({ searchQuery, contextLines = 15 }) => {
      try {
        console.log(`🔍 [TEXT-SEARCH-TOOL] Ricerca di: "${searchQuery}" in "${documentName}"`);

        if (!documentContent || documentContent.trim().length === 0) {
          return {
            success: false,
            error: 'Nessun documento caricato nella configurazione del tool.',
            searchQuery
          };
        }

        // Dividi il documento in righe
        const lines = documentContent.split('\n');
        
        // Cerca la query (case-insensitive)
        const searchLower = searchQuery.toLowerCase();
        const matches: Array<{
          lineNumber: number;
          line: string;
          context: string[];
        }> = [];

        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(searchLower)) {
            // Calcola il range di righe da includere come contesto
            const startLine = Math.max(0, index - contextLines);
            const endLine = Math.min(lines.length - 1, index + contextLines);
            
            // Estrai il contesto
            const contextArr: string[] = [];
            for (let i = startLine; i <= endLine; i++) {
              const prefix = i === index ? '>>> ' : '    '; // Evidenzia la riga con il match
              contextArr.push(`${prefix}${i + 1}| ${lines[i]}`);
            }

            matches.push({
              lineNumber: index + 1,
              line: line,
              context: contextArr
            });
          }
        });

        if (matches.length === 0) {
          return {
            success: true,
            searchQuery,
            documentName,
            matchesFound: 0,
            message: `Nessun risultato trovato per "${searchQuery}" nel documento "${documentName}". Prova con termini di ricerca diversi o più generici.`
          };
        }

        // Restituisci TUTTI i risultati trovati
        return {
          success: true,
          searchQuery,
          documentName,
          matchesFound: matches.length,
          matchesReturned: matches.length,
          hasMore: false,
          matches: matches.map(m => ({
            lineNumber: m.lineNumber,
            matchedLine: m.line,
            context: m.context.join('\n')
          }))
        };

      } catch (error) {
        console.error('❌ [TEXT-SEARCH-TOOL] Errore durante la ricerca:', error);
        return {
          success: false,
          error: `Errore durante la ricerca: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
          searchQuery
        };
      }
    },
  });
};

