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
  
  return message.parts.some((part: MessagePart) => 
    part.state === 'streaming' || 
    part.state === 'input-streaming' ||
    part.state === 'output-streaming' ||
    (part.type === 'text' && part.text === '' && part.state === 'streaming') ||
    // Tool calls in streaming
    (part.type?.startsWith('tool-') && (part.state === 'input-streaming' || part.state === 'output-streaming'))
  );
}

// Funzione per verificare se un messaggio ha contenuto utile
function hasUsefulContent(message: SaveMessageRequest['message']): boolean {
  if (!message.parts || !Array.isArray(message.parts)) return false;
  
  return message.parts.some((part: MessagePart) => 
    (part.type === 'text' && part.text && part.text.trim().length > 0) ||
    part.type?.startsWith('tool-') ||
    part.type === 'step-start' ||
    part.type === 'step-finish' ||
    part.type === 'reasoning'
  );
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

// Funzione per estrarre e salvare tutti i tool calls da un messaggio
async function saveToolExecutions(messageId: string, message: SaveMessageRequest['message']) {
  if (!message.parts || !Array.isArray(message.parts)) return;

  console.log(`Processing tool executions for message ${messageId}`);
  
  for (let partIndex = 0; partIndex < message.parts.length; partIndex++) {
    const part = message.parts[partIndex];
    
    try {
      // Gestisci tool calls di tipo read_sql_db
      if (part.type === 'tool-read_sql_db') {
        console.log(`Found SQL tool call at index ${partIndex}:`, {
          toolCallId: part.toolCallId,
          state: part.state,
          hasInput: !!part.input,
          hasOutput: !!part.output
        });
        
        // Salva solo se il tool call è completato (ha output)
        if (part.output || part.result) {
          const toolExecution = {
            message_id: messageId,
            tool_name: 'read_sql_db',
            input_data: (part.input || part.args || {}) as never,
            output_data: (part.output || part.result || null) as never,
            execution_time_ms: part.output?.executionTime ? 
              parseInt(String(part.output.executionTime).replace('ms', '') || '0') : null,
            success: part.output ? (part.output.success !== false) : null,
            error_message: part.output?.error ? String(part.output.error) : null
          };

          // Verifica se esiste già questo tool execution
          const { data: existing } = await supabase
            .from('tool_executions')
            .select('id')
            .eq('message_id', messageId)
            .eq('tool_name', 'read_sql_db')
            .eq('input_data', toolExecution.input_data as never)
            .single();

          if (!existing) {
            const { error } = await supabase
              .from('tool_executions')
              .insert(toolExecution);

            if (error) {
              console.error(`Error saving tool execution for message ${messageId}:`, error);
            } else {
              console.log(`Saved SQL tool execution for message ${messageId}`);
            }
          } else {
            console.log(`SQL tool execution already exists for message ${messageId}`);
          }
        } else {
          console.log(`SQL tool call at index ${partIndex} not yet completed (no output)`);
        }
      }
      
      // Gestisci altri tipi di tool calls se necessario
      else if (part.type?.startsWith('tool-') && part.type !== 'tool-read_sql_db') {
        console.log(`Found other tool call:`, part.type, {
          toolCallId: part.toolCallId,
          state: part.state,
          hasInput: !!part.input,
          hasOutput: !!part.output
        });
        
        // Salva solo se il tool call è completato
        if (part.output || part.result) {
          const toolExecution = {
            message_id: messageId,
            tool_name: part.type.replace('tool-', ''),
            input_data: (part.input || part.args || {}) as never,
            output_data: (part.output || part.result || null) as never,
            execution_time_ms: part.executionTime ? 
              parseInt(String(part.executionTime).replace('ms', '') || '0') : null,
            success: part.success !== false,
            error_message: part.error ? String(part.error) : null
          };

          const { error } = await supabase
            .from('tool_executions')
            .insert(toolExecution);

          if (error) {
            console.error(`Error saving tool execution for message ${messageId}:`, error);
          } else {
            console.log(`Saved ${part.type} tool execution for message ${messageId}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error processing tool execution at index ${partIndex}:`, error);
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

  // Salva tutte le tool executions usando una funzione dedicata
  await saveToolExecutions(message.id, message);

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

      console.log(`Saving message ${message.id} for session ${sessionId}`);

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
