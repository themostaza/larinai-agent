'use client';

import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, XCircle, AlertCircle, Calendar, FileText, Loader2, Settings, Mail } from 'lucide-react';

interface TaxData {
  type: string;
  value: string;
  country?: string;
}

interface PaymentSettings {
  id: string;
  organization_id: string;
  user_id: string;
  isactive: boolean;
  created_at: string;
  metadata: {
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    stripe_session_id?: string;
    plan_type?: string;
    amount_total?: number;
    currency?: string;
    payment_status?: string;
    subscription_status?: string;
    cancel_at_period_end?: boolean;
    cancel_at?: string;
    tax_data?: TaxData[];
    customer_email?: string;
    created_at?: string;
    [key: string]: unknown;
  };
}

interface PaymentsDashboardProps {
  organizationId: string;
}

export default function PaymentsDashboard({ organizationId }: PaymentsDashboardProps) {
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  useEffect(() => {
    fetchPaymentsData();
  }, [organizationId]);

  const fetchPaymentsData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/organizations/${organizationId}/payments`);
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Errore nel caricamento dei dati');
        return;
      }

      setPaymentSettings(data.paymentSettings);
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError('Errore di connessione');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getTaxTypeLabel = (type?: string) => {
    const labels: { [key: string]: string } = {
      'it_cf': 'Codice Fiscale',
      'eu_vat': 'Partita IVA',
      'it_sdi': 'Codice SDI',
    };
    return type ? labels[type] || type : 'Tax ID';
  };

  const handleOpenPortal = async () => {
    try {
      setIsOpeningPortal(true);
      const response = await fetch(`/api/organizations/${organizationId}/payments/portal`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!data.success) {
        setError(data.error || 'Errore nell\'apertura del portale');
        setIsOpeningPortal(false);
        return;
      }
      
      // Apri il Customer Portal in una nuova tab
      window.open(data.url, '_blank');
      setIsOpeningPortal(false);
    } catch (err) {
      console.error('Error opening portal:', err);
      setError('Errore di connessione');
      setIsOpeningPortal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="text-lg font-semibold text-red-500 mb-1">Errore</h3>
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!paymentSettings) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <AlertCircle size={32} className="text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Nessun Abbonamento Attivo</h3>
          <p className="text-gray-400 text-sm max-w-md">
            Questa organizzazione non ha un abbonamento attivo. Potrebbe essere stata creata manualmente o l&apos;abbonamento è scaduto.
          </p>
        </div>
      </div>
    );
  }

  const metadata = paymentSettings.metadata;
  const taxData = metadata.tax_data;
  const isCancelScheduled = metadata.cancel_at_period_end === true;
  const cancelAt = metadata.cancel_at as string | undefined;

  return (
    <div className="space-y-4">
      {/* Warning se cancellazione programmata */}
      {isCancelScheduled && cancelAt && (
        <div className="bg-orange-500/10 border border-orange-500/50 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-orange-500 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="text-orange-500 text-sm font-medium">
                Cancellazione Programmata
              </p>
              <p className="text-orange-400 text-xs mt-0.5">
                L&apos;abbonamento si cancellerà automaticamente il {formatDate(cancelAt)}. Puoi riattivarlo in qualsiasi momento prima di quella data.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Status */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold mb-1">Sottoscrizione</h2>
            <p className="text-gray-400 text-xs">
              Informazioni sulla tua subscription attiva
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              isCancelScheduled
                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/50'
                : paymentSettings.isactive 
                  ? 'bg-green-500/10 text-green-400 border border-green-500/50' 
                  : 'bg-red-500/10 text-red-400 border border-red-500/50'
            }`}>
              {isCancelScheduled ? (
                <>
                  <AlertCircle size={16} />
                  In scadenza
                </>
              ) : paymentSettings.isactive ? (
                <>
                  <CheckCircle size={16} />
                  Attivo
                </>
              ) : (
                <>
                  <XCircle size={16} />
                  Non Attivo
                </>
              )}
            </div>
            <button
              onClick={handleOpenPortal}
              disabled={isOpeningPortal}
              className="flex items-center gap-2 px-3 py-1.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-fit"
            >
              {isOpeningPortal ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Apertura...
                </>
              ) : (
                <>
                  <Settings size={16} />
                  Gestisci
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Piano */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard size={16} className="text-gray-400" />
              <span className="text-xs text-gray-400">Piano</span>
            </div>
            <p className="text-sm font-medium">
              {metadata.plan_type === 'organization_unlimited' ? 'Org Unlimited' : metadata.plan_type || 'Non specificato'}
            </p>
          </div>

          {/* Email */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Mail size={16} className="text-gray-400" />
              <span className="text-xs text-gray-400">Email</span>
            </div>
            <p className="text-sm font-medium break-all">
              {metadata.customer_email || 'Non disponibile'}
            </p>
          </div>

          {/* Data Creazione */}
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-xs text-gray-400">Creato il</span>
            </div>
            <p className="text-sm font-medium">
              {formatDate(paymentSettings.created_at)}
            </p>
          </div>
        </div>

        {/* Dati Fiscali */}
        {taxData && taxData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold">Dati Fiscali</h3>
            </div>
            <div className="space-y-2">
              {taxData.map((tax, index) => (
                <div key={index} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">{getTaxTypeLabel(tax.type)}</p>
                    <p className="text-sm font-medium font-mono">{tax.value}</p>
                  </div>
                  {tax.country && (
                    <span className="px-2 py-0.5 bg-gray-700 rounded text-xs font-medium">
                      {tax.country}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

