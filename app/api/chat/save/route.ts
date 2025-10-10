import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { Database } from '@/database/database';

// Client Supabase server-side con service role
const supabaseService = createServiceClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MessagePart {
  type: string;
  text?: string;
  state?: string;
  toolCallId?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  executionTime?: string;
  success?: boolean;
  error?: string;
}

interface SaveMessageRequest {
  sessionId: string;
  message: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    parts?: MessagePart[];
    metadata?: Record<string, unknown>;
    createdAt?: string;
    [key: string]: unknown;
  };
}

interface SaveMessagesRequest {
  sessionId: string;
  messages: SaveMessageRequest['message'][];
}

// Funzione per controllare se un messaggio è ancora in streaming
function isMessageStreaming(message: SaveMessageRequest['message']): boolean {
  if (!message.parts || !Array.isArray(message.parts)) return false;
  
  return message.parts.some((part: MessagePart) => {
    // Per i tool calls, controlla se hanno input ma non output (ancora in esecuzione)
    if (part.type?.startsWith('tool-')) {
      // Se ha input ma non output/result, è ancora in esecuzione
      const hasInput = !!(part.input || part.args);
      const hasOutput = !!(part.output || part.result);
      
      // Se ha input ma non output, è ancora in streaming
      if (hasInput && !hasOutput) {
        return true;
      }
      
      // Se ha stati di streaming espliciti
      return part.state === 'input-streaming' || part.state === 'output-streaming';
    }
    
    // Per i messaggi di testo
    return part.state === 'streaming' || 
           (part.type === 'text' && part.text === '' && part.state === 'streaming');
  });
}

// Funzione per verificare se un messaggio ha contenuto utile
function hasUsefulContent(message: SaveMessageRequest['message']): boolean {
  if (!message.parts || !Array.isArray(message.parts)) return false;
  
  return message.parts.some((part: MessagePart) => {
    // Testo non vuoto
    if (part.type === 'text' && part.text && part.text.trim().length > 0) {
      return true;
    }
    
    // Tool calls completati (hanno sia input che output)
    if (part.type?.startsWith('tool-')) {
      const hasInput = !!(part.input || part.args);
      const hasOutput = !!(part.output || part.result);
      return hasInput && hasOutput; // Solo tool calls completati
    }
    
    // Altri tipi di contenuto utile
    return part.type === 'step-start' || 
           part.type === 'step-finish' || 
           part.type === 'reasoning';
  });
}


// Funzione per processare le parti del messaggio e rimuovere i dati completi
function processMessageParts(parts: MessagePart[]): MessagePart[] {
  return parts.map(part => {
    // Se è una part di tipo tool (inizia con 'tool-'), rimuovi SEMPRE i dati
    if (part.type && part.type.startsWith('tool-')) {
      console.log(`🔍 Processing tool part: ${part.type}`, {
        hasResult: !!part.result,
        hasOutput: !!part.output,
        hasInput: !!part.input,
        hasArgs: !!part.args
      });
      
      // Funzione helper per pulire un oggetto rimuovendo results (dati pesanti)
      const cleanDataObject = (obj: Record<string, unknown>) => {
        const cleaned = { ...obj };
        
        // Rimuovi array results se presente (dati pesanti!)
        if (cleaned.results && Array.isArray(cleaned.results)) {
          const resultsCount = cleaned.results.length;
          console.log(`✂️  Removing ${resultsCount} data rows from ${part.type}, keeping metadata + structure`);
          cleaned.results = [];
          cleaned.dataRemoved = true;
          cleaned.originalRowCount = resultsCount;
        }
        
        // Rimuovi solo schema (se presente), ma MANTIENI queryResultStructure
        delete cleaned.schema;
        // queryResultStructure viene MANTENUTO - contiene solo metadati delle colonne (leggero e utile)
        
        return cleaned;
      };
      
      // Pulisci tutti i possibili campi che potrebbero contenere dati
      let cleanedResult = part.result;
      if (part.result && typeof part.result === 'object') {
        cleanedResult = cleanDataObject(part.result as Record<string, unknown>);
      }
      
      let cleanedOutput = part.output;
      if (part.output && typeof part.output === 'object') {
        cleanedOutput = cleanDataObject(part.output as Record<string, unknown>);
      }
      
      // Input e args di solito non contengono dati, ma controlliamo comunque
      const cleanedInput = part.input;
      const cleanedArgs = part.args;
      
      // Ritorna la part pulita
      return {
        ...part,
        result: cleanedResult,
        output: cleanedOutput,
        input: cleanedInput,
        args: cleanedArgs
      };
    }
    
    // Per gli altri tipi di parti, restituiscili invariati
    return part;
  });
}

// Funzione per salvare un singolo messaggio
async function saveMessage(sessionId: string, message: SaveMessageRequest['message']) {
  // Controlla se il messaggio è già stato salvato
  const { data: existingMessage } = await supabaseService
    .from('chat_messages')
    .select('id')
    .eq('message_id', message.id)
    .single();

  if (existingMessage) {
    console.log(`Message ${message.id} already exists, skipping`);
    return { success: true, action: 'skipped' };
  }

  // Processa le parti per rimuovere i dati completi
  const processedParts = processMessageParts(message.parts || []);

  // Salva il messaggio SOLO con parts processate (senza dati)
  const { data, error } = await supabaseService
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      message_id: message.id,
      role: message.role,
      parts: processedParts as never,
      created_at: message.createdAt || new Date().toISOString()
    })
    .select();

  if (error) {
    throw new Error(`Failed to save message: ${error.message}`);
  }

  // Non salviamo più in tool_executions - le informazioni sono già nelle parts

  return { success: true, action: 'saved', data };
}

// POST: Salva uno o più messaggi
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = body.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    // Importa createClient per ottenere l'utente autenticato
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    // Verifica che la sessione appartenga all'utente
    const { data: session } = await supabaseService
      .from('chat_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Sessione non trovata' },
        { status: 404 }
      );
    }

    if (session.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Non hai accesso a questa sessione' },
        { status: 403 }
      );
    }
    
    // Supporta sia singolo messaggio che array di messaggi
    if (body.message) {
      // Singolo messaggio
      const { message }: SaveMessageRequest = body;

      if (!message || !message.id) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields: message.id' },
          { status: 400 }
        );
      }

      // Controlla se il messaggio è ancora in streaming
      if (isMessageStreaming(message)) {
        return NextResponse.json({
          success: false,
          error: 'Message is still streaming',
          shouldRetry: true
        });
      }

      // Controlla se il messaggio ha contenuto utile
      if (!hasUsefulContent(message)) {
        return NextResponse.json({
          success: false,
          error: 'Message has no useful content',
          shouldRetry: false
        });
      }

      // Salva il messaggio
      const result = await saveMessage(sessionId, message);

      return NextResponse.json({
        success: true,
        message: `Message ${result.action}`,
        data: result.data
      });

    } else if (body.messages) {
      // Array di messaggi
      const { messages }: SaveMessagesRequest = body;

      if (!Array.isArray(messages)) {
        return NextResponse.json(
          { success: false, error: 'Missing required field: messages array' },
          { status: 400 }
        );
      }

      console.log(`Saving ${messages.length} messages for session ${sessionId}`);

      const results = [];
      for (const message of messages) {
        if (!message.id) continue;

        // Salta messaggi in streaming o senza contenuto
        if (isMessageStreaming(message) || !hasUsefulContent(message)) {
          continue;
        }

        try {
          const result = await saveMessage(sessionId, message);
          results.push({ messageId: message.id, ...result });
        } catch (error) {
          console.error(`Error saving message ${message.id}:`, error);
          results.push({ 
            messageId: message.id, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: `Processed ${results.length} messages`,
        results
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid request format. Expected "message" or "messages" field' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error in save messages API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

// GET: Verifica lo stato di una sessione
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    // Ottieni l'utente autenticato
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Utente non autenticato' },
        { status: 401 }
      );
    }

    // Verifica che la sessione appartenga all'utente
    const { data: session } = await supabaseService
      .from('chat_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Sessione non trovata' },
        { status: 404 }
      );
    }

    if (session.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Non hai accesso a questa sessione' },
        { status: 403 }
      );
    }

    // Conta i messaggi nella sessione
    const { count, error } = await supabaseService
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    if (error) {
      throw new Error(`Failed to count messages: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      sessionId,
      messageCount: count || 0
    });

  } catch (error) {
    console.error('Error in get session status API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}
