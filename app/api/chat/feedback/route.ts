import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageId, feedbackType } = body;

    if (!messageId || !feedbackType) {
      return NextResponse.json(
        { success: false, error: 'messageId e feedbackType sono obbligatori' },
        { status: 400 }
      );
    }

    if (feedbackType !== 'up' && feedbackType !== 'down') {
      return NextResponse.json(
        { success: false, error: 'feedbackType deve essere "up" o "down"' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Recupera lo stato attuale del messaggio (usa message_id, non id)
    const { data: currentMessage, error: fetchError } = await supabase
      .from('chat_messages')
      .select('thumb_up, thumb_down')
      .eq('message_id', messageId)
      .single();

    if (fetchError) {
      console.error('Error fetching message:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Messaggio non trovato' },
        { status: 404 }
      );
    }

    // Determina i nuovi valori in base al feedback type e allo stato attuale
    let newThumbUp = currentMessage.thumb_up;
    let newThumbDown = currentMessage.thumb_down;

    if (feedbackType === 'up') {
      // Se già thumb up, rimuovi il feedback (toggle)
      if (currentMessage.thumb_up) {
        newThumbUp = null;
      } else {
        // Altrimenti, imposta thumb up e rimuovi thumb down
        newThumbUp = true;
        newThumbDown = null;
      }
    } else if (feedbackType === 'down') {
      // Se già thumb down, rimuovi il feedback (toggle)
      if (currentMessage.thumb_down) {
        newThumbDown = null;
      } else {
        // Altrimenti, imposta thumb down e rimuovi thumb up
        newThumbDown = true;
        newThumbUp = null;
      }
    }

    // Aggiorna il messaggio nel database (usa message_id, non id)
    const { data, error } = await supabase
      .from('chat_messages')
      .update({
        thumb_up: newThumbUp,
        thumb_down: newThumbDown,
      })
      .eq('message_id', messageId)
      .select()
      .single();

    if (error) {
      console.error('Error updating feedback:', error);
      return NextResponse.json(
        { success: false, error: 'Errore durante l\'aggiornamento del feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback aggiornato con successo',
      data: {
        thumb_up: data.thumb_up,
        thumb_down: data.thumb_down,
      },
    });
  } catch (error) {
    console.error('Error in feedback route:', error);
    return NextResponse.json(
      { success: false, error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

