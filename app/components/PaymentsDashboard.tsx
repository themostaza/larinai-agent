'use client';

import { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, XCircle, AlertCircle, Calendar, Euro, FileText, Loader2, Receipt, ExternalLink } from 'lucide-react';

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
    tax_data?: TaxData[];
    customer_email?: string;
    created_at?: string;
    [key: string]: unknown;
  };
}

interface Payment {
  id: string;
  pay_settings_id: string;
  created_at: string;
  metadata: {
    type?: string;
    stripe_invoice_id?: string;
    stripe_session_id?: string;
    amount_paid?: number;
    amount_total?: number;
    amount_due?: number;
    currency?: string;
    status?: string;
    payment_status?: string;
    period_start?: string;
    period_end?: string;
    billing_reason?: string;
    attempt_count?: number;
    next_payment_attempt?: string;
    [key: string]: unknown;
  };
}

interface PaymentsDashboardProps {
  organizationId: string;
}

export default function PaymentsDashboard({ organizationId }: PaymentsDashboardProps) {
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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
      setPayments(data.payments || []);
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError('Errore di connessione');
    } finally {
      setIsLoading(false);
    }
  };

  const formatAmount = (amount?: number, currency?: string) => {
    if (!amount) return '€0,00';
    const formatted = (amount / 100).toFixed(2).replace('.', ',');
    return currency?.toUpperCase() === 'EUR' ? `€${formatted}` : `${formatted} ${currency}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  const getInvoiceUrl = (invoiceId: string) => {
    // Link diretto alla fattura nella Dashboard di Stripe
    // Funziona sia in test mode che in live mode
    return `https://dashboard.stripe.com/invoices/${invoiceId}`;
  };

  const handleViewInvoice = (invoiceId: string) => {
    // Apri direttamente la fattura in Stripe
    window.open(getInvoiceUrl(invoiceId), '_blank');
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
            <CreditCard size={32} className="text-gray-500" />
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

  return (
    <div className="space-y-4">
      {/* Subscription Status */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold mb-1">Stato Abbonamento</h2>
            <p className="text-gray-400 text-xs">
              Informazioni sulla tua subscription attiva
            </p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            paymentSettings.isactive 
              ? 'bg-green-500/10 text-green-400 border border-green-500/50' 
              : 'bg-red-500/10 text-red-400 border border-red-500/50'
          }`}>
            {paymentSettings.isactive ? (
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
              <Receipt size={16} className="text-gray-400" />
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

      {/* Storico Pagamenti */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-1">Storico Transazioni</h2>
        <p className="text-gray-400 text-xs mb-4">
          {payments.length > 0 
            ? `${payments.length} ${payments.length === 1 ? 'transazione' : 'transazioni'} registrata${payments.length === 1 ? '' : 'e'}`
            : 'Nessuna transazione ancora registrata'
          }
        </p>

        {payments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Receipt size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nessuna transazione</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => {
              const meta = payment.metadata;
              const type = meta.type;
              const amount = meta.amount_paid || meta.amount_total || meta.amount_due;
              const hasInvoice = meta.stripe_invoice_id && type !== 'failed_payment';
              const isFailed = type === 'failed_payment';

              return (
                <div key={payment.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isFailed ? 'bg-red-400' : 'bg-green-400'}`} />
                      <div>
                        <p className="text-sm font-medium">
                          {formatAmount(amount, meta.currency)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatDate(payment.created_at)}
                        </p>
                      </div>
                    </div>
                    
                    {hasInvoice && meta.stripe_invoice_id && (
                      <button
                        onClick={() => handleViewInvoice(meta.stripe_invoice_id!)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white text-xs font-medium rounded transition-colors"
                        title="Visualizza fattura"
                      >
                        <FileText size={14} />
                        <span>Fattura</span>
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

