import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/database/database';

// Client Supabase server-side con tipi
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Usa anon key dato che non abbiamo RLS attive
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

// Funzione per creare una sessione se non esiste
async function ensureSessionExists(sessionId: string) {
  const { data: existingSession } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('id', sessionId)
    .single();

  if (!existingSession) {
    const { error } = await supabase
      .from('chat_sessions')
      .insert({
        id: sessionId,
        title: 'Nuova Conversazione',
        user_id: null // Per ora senza autenticazione, poi potrai aggiungere auth.uid()
      });

    if (error && error.code !== '23505') { // Ignora errore di duplicato
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }
}

// Funzione per salvare un singolo messaggio
async function saveMessage(sessionId: string, message: SaveMessageRequest['message']) {
  // Controlla se il messaggio è già stato salvato
  const { data: existingMessage } = await supabase
    .from('chat_messages')
    .select('id')
    .eq('message_id', message.id)
    .single();

  if (existingMessage) {
    console.log(`Message ${message.id} already exists, skipping`);
    return { success: true, action: 'skipped' };
  }

  // Prepara il contenuto completo del messaggio
  const completeMessageContent = {
    id: message.id,
    role: message.role,
    parts: message.parts || [],
    metadata: message.metadata || {},
    createdAt: message.createdAt || new Date().toISOString(),
    // Aggiungi qualsiasi altro campo presente nel messaggio
    ...Object.fromEntries(
      Object.entries(message).filter(([key]) => 
        !['id', 'role', 'parts', 'metadata', 'createdAt'].includes(key)
      )
    )
  };

  // Salva il messaggio
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      message_id: message.id,
      role: message.role,
      parts: (message.parts || []) as never,
      message_content: completeMessageContent as never
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
    
    // Supporta sia singolo messaggio che array di messaggi
    if (body.message) {
      // Singolo messaggio
      const { sessionId, message }: SaveMessageRequest = body;

      if (!sessionId || !message || !message.id) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields: sessionId, message.id' },
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

      //console.log(`Saving message ${message.id} for session ${sessionId}`);

      // Assicurati che la sessione esista
      await ensureSessionExists(sessionId);

      // Salva il messaggio
      const result = await saveMessage(sessionId, message);

      return NextResponse.json({
        success: true,
        message: `Message ${result.action}`,
        data: result.data
      });

    } else if (body.messages) {
      // Array di messaggi
      const { sessionId, messages }: SaveMessagesRequest = body;

      if (!sessionId || !Array.isArray(messages)) {
        return NextResponse.json(
          { success: false, error: 'Missing required fields: sessionId, messages array' },
          { status: 400 }
        );
      }

      console.log(`Saving ${messages.length} messages for session ${sessionId}`);

      // Assicurati che la sessione esista
      await ensureSessionExists(sessionId);

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

    // Conta i messaggi nella sessione
    const { count, error } = await supabase
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
