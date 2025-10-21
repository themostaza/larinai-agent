import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const supabase = await createClient();
    const { orgId } = await params;

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // Verifica che l'utente sia owner o admin dell'organizzazione
    const { data: membership } = await supabase
      .from('link_organization_user')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json(
        { success: false, error: 'Non hai i permessi per visualizzare i pagamenti' },
        { status: 403 }
      );
    }

    // Recupera i payment settings
    const { data: paymentSettings, error: settingsError } = await supabase
      .from('payments_settings')
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching payment settings:', settingsError);
      return NextResponse.json(
        { success: false, error: 'Errore nel recupero delle impostazioni di pagamento' },
        { status: 500 }
      );
    }

    // Se non ci sono payment settings, ritorna null
    if (!paymentSettings) {
      return NextResponse.json({
        success: true,
        paymentSettings: null,
        payments: [],
      });
    }

    // Recupera lo storico pagamenti
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq('pay_settings_id', paymentSettings.id)
      .order('created_at', { ascending: false });

    if (paymentsError) {
      console.error('Error fetching payments:', paymentsError);
      return NextResponse.json(
        { success: false, error: 'Errore nel recupero dei pagamenti' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentSettings,
      payments: payments || [],
    });

  } catch (error) {
    console.error('Error in payments API:', error);
    return NextResponse.json(
      { success: false, error: 'Errore del server' },
      { status: 500 }
    );
  }
}

