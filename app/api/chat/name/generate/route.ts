import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/database/database';
import { generateText } from 'ai';
import { registry } from '@/lib/ai/models';

// Client Supabase server-side
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST: Genera automaticamente un titolo per la chat
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    console.log(`🤖 [NAME-GEN] Generating title for session ${sessionId}`);

    // 1. Recupera i messaggi della sessione dal database
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('role, parts, message_content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(10); // Primi 10 messaggi sono sufficienti per capire il tema

    if (messagesError || !messages || messages.length === 0) {
      console.error('🤖 [NAME-GEN] Error fetching messages:', messagesError);
      return NextResponse.json(
        { success: false, error: 'No messages found for this session' },
        { status: 404 }
      );
    }

    console.log(`🤖 [NAME-GEN] Found ${messages.length} messages`);

    // 2. Costruisci il contesto della conversazione
    const conversationContext = messages
      .map((msg) => {
        // Estrai il testo dalle parts
        const textContent = msg.parts
          ? (msg.parts as Array<{ type: string; text?: string }>)
              .filter((part) => part.type === 'text')
              .map((part) => part.text || '')
              .join(' ')
          : '';
        
        return `${msg.role === 'user' ? 'Utente' : 'Assistant'}: ${textContent}`;
      })
      .join('\n\n');

    console.log(`🤖 [NAME-GEN] Conversation context length: ${conversationContext.length} chars`);

    // 3. Usa GPT-5 Mini per generare il titolo
    const { text: generatedTitle } = await generateText({
      model: registry.languageModel('openai:gpt-5-mini'),
      prompt: `Analizza questa conversazione e crea un titolo breve e descrittivo (massimo 50 caratteri) che catturi l'argomento principale.

Conversazione:
${conversationContext}

Rispondi SOLO con il titolo, senza virgolette o punteggiatura finale. Deve essere conciso, chiaro e professionale.`,
      temperature: 0.7,
    });

    // Pulisci il titolo generato
    let cleanTitle = generatedTitle
      .trim()
      .replace(/^["']|["']$/g, '') // Rimuovi virgolette all'inizio/fine
      .replace(/\.$/, '') // Rimuovi punto finale
      .slice(0, 50); // Max 50 caratteri

    // Se il titolo è vuoto o troppo corto, usa un fallback
    if (cleanTitle.length < 3) {
      cleanTitle = 'Nuova Conversazione';
    }

    console.log(`🤖 [NAME-GEN] Generated title: "${cleanTitle}"`);

    // 4. Salva il titolo nel database chiamando l'endpoint esistente
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000';
    const updateResponse = await fetch(`${baseUrl}/api/chat/name`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: cleanTitle,
        sessionId: sessionId,
      }),
    });

    const updateResult = await updateResponse.json();

    if (!updateResult.success) {
      console.error('🤖 [NAME-GEN] Error updating title:', updateResult.error);
      return NextResponse.json(
        { success: false, error: 'Failed to save generated title' },
        { status: 500 }
      );
    }

    console.log(`🤖 [NAME-GEN] Title saved successfully`);

    return NextResponse.json({
      success: true,
      title: cleanTitle,
      sessionId: sessionId,
      message: 'Chat title generated and saved successfully',
    });

  } catch (error) {
    console.error('🤖 [NAME-GEN] Error generating chat title:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

