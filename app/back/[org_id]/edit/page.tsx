'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Loader2, AlertCircle, Trash2, UserCog, X } from 'lucide-react';
import PaymentsDashboard from '@/app/components/PaymentsDashboard';

interface Organization {
  id: string;
  name: string;
  createdAt: string;
  settings: unknown;
  usersCount: number;
}

interface PaymentSettings {
  isactive: boolean;
  metadata: {
    cancel_at_period_end?: boolean;
    cancel_at?: string;
    [key: string]: unknown;
  };
}

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.org_id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Change Name State
  const [newName, setNewName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState(false);

  // Delete Organization State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    fetchOrganization();
  }, [orgId]);

  const fetchOrganization = async () => {
    try {
      setIsLoading(true);
      
      // Fetch organization data
      const orgResponse = await fetch(`/api/organizations/${orgId}`);
      const orgData = await orgResponse.json();

      if (!orgData.success) {
        if (orgResponse.status === 403) {
          setError('Non hai i permessi per accedere a questa organizzazione');
        } else if (orgResponse.status === 404) {
          setError('Organizzazione non trovata');
        } else {
          setError(orgData.error || 'Errore nel caricamento dell\'organizzazione');
        }
        return;
      }

      setOrganization(orgData.organization);
      setNewName(orgData.organization.name || '');

      // Fetch payment settings
      const paymentsResponse = await fetch(`/api/organizations/${orgId}/payments`);
      const paymentsData = await paymentsResponse.json();
      
      if (paymentsData.success && paymentsData.paymentSettings) {
        setPaymentSettings(paymentsData.paymentSettings);
      }
    } catch (err) {
      console.error('Error fetching organization:', err);
      setError('Errore di connessione');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      setNameError('Il nome è obbligatorio');
      return;
    }

    if (newName.trim().length > 50) {
      setNameError('Il nome non può superare i 50 caratteri');
      return;
    }

    if (newName.trim() === organization?.name) {
      setNameError('Il nome non è cambiato');
      return;
    }

    setIsSavingName(true);
    setNameError('');
    setNameSuccess(false);

    try {
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newName.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setNameError(data.error || 'Errore nell\'aggiornamento del nome');
        setIsSavingName(false);
        return;
      }

      setOrganization(prev => prev ? { ...prev, name: data.organization.name } : null);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating organization name:', err);
      setNameError('Errore di connessione');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleDeleteOrganization = async () => {
    if (deleteConfirmName !== organization?.name) {
      setDeleteError('Il nome inserito non corrisponde');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      const response = await fetch(`/api/organizations/${orgId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        setDeleteError(data.error || 'Errore nell\'eliminazione dell\'organizzazione');
        setIsDeleting(false);
        return;
      }

      // Redirect alla pagina principale
      router.push('/back');
      router.refresh();
    } catch (err) {
      console.error('Error deleting organization:', err);
      setDeleteError('Errore di connessione');
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin" size={32} />
          <span className="text-xl">Caricamento...</span>
        </div>
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="min-h-screen bg-black text-white">
        <header className="border-b border-gray-800 bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <button
                onClick={() => router.push('/back')}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
                <span>Torna indietro</span>
              </button>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0" size={24} />
              <div>
                <h2 className="text-xl font-semibold text-red-500 mb-2">Errore</h2>
                <p className="text-red-400">{error || 'Impossibile caricare l\'organizzazione'}</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <button
              onClick={() => router.push('/back')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Torna indietro</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">{organization.name}</h1>
          <p className="text-gray-400 text-sm">
            Gestisci le impostazioni della tua organizzazione
          </p>
        </div>

        <div className="space-y-4">
          {/* Change Name Section */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-1">Nome Organizzazione</h2>
            <p className="text-gray-400 text-xs mb-3">
              Modifica il nome della tua organizzazione
            </p>

            <div className="space-y-3">
              {nameError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-2 flex items-start gap-2">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={14} />
                  <p className="text-red-500 text-xs">{nameError}</p>
                </div>
              )}

              {nameSuccess && (
                <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-2">
                  <p className="text-green-500 text-xs">Nome aggiornato con successo!</p>
                </div>
              )}

              <div>
                <label htmlFor="orgName" className="block text-xs font-medium text-gray-300 mb-1.5">
                  Nome
                </label>
                <input
                  id="orgName"
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setNameError('');
                  }}
                  maxLength={50}
                  className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-gray-500 text-sm"
                  placeholder="Nome organizzazione"
                  disabled={isSavingName}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {newName.length}/50 caratteri
                </p>
              </div>

              <button
                onClick={handleSaveName}
                disabled={isSavingName || !newName.trim() || newName.trim() === organization.name}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingName ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Salva
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Payments Dashboard */}
          <PaymentsDashboard organizationId={orgId} />

          {/* Transfer Ownership Section - Only UI */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-1">Trasferimento Proprietà</h2>
            <p className="text-gray-400 text-xs mb-3">
              Trasferisci la proprietà di questa organizzazione ad un altro utente
            </p>

            <button
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
              disabled
              title="Funzionalità in arrivo"
            >
              <UserCog size={16} />
              Trasferisci Proprietà (In arrivo)
            </button>
          </div>

          {/* Delete Organization Section */}
          <div className="bg-red-500/5 border border-red-500/30 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-red-500 mb-1">Zona Pericolosa</h2>
            <p className="text-gray-400 text-xs mb-3">
              Elimina definitivamente questa organizzazione. Questa azione non può essere annullata.
            </p>

            {paymentSettings && paymentSettings.isactive && (
              <div className="bg-orange-500/10 border border-orange-500/50 rounded-lg p-3 mb-3 flex items-start gap-2">
                <AlertCircle className="text-orange-500 flex-shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="text-orange-500 text-xs font-medium mb-1">
                    Abbonamento Attivo
                  </p>
                  <p className="text-orange-400 text-xs">
                    {paymentSettings.metadata?.cancel_at_period_end 
                      ? `Non puoi eliminare l'organizzazione con un abbonamento attivo. La tua sottoscrizione terminerà il ${new Date(paymentSettings.metadata.cancel_at as string).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}. Potrai eliminare l'organizzazione dopo quella data.`
                      : 'Non puoi eliminare l\'organizzazione con un abbonamento attivo. Cancella prima l\'abbonamento tramite "Gestisci Abbonamento".'
                    }
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={paymentSettings?.isactive === true}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/50 text-red-500 text-sm font-medium rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-500/10"
            >
              <Trash2 size={16} />
              Elimina Organizzazione
            </button>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg border border-red-500/30 p-6 max-w-md w-full relative">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmName('');
                setDeleteError('');
              }}
              className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
              disabled={isDeleting}
            >
              <X size={18} />
            </button>

            {/* Modal Content */}
            <div className="mb-4">
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Trash2 size={24} className="text-red-500" />
              </div>
              <h2 className="text-xl font-bold mb-2 text-center text-red-500">
                Elimina Organizzazione
              </h2>
              <p className="text-gray-400 text-xs text-center mb-3">
                Questa azione è irreversibile. Tutti i dati associati verranno eliminati definitivamente.
              </p>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
                <p className="text-gray-300 text-xs">
                  Per confermare, digita il nome dell&apos;organizzazione:{' '}
                  <span className="font-bold text-white">{organization.name}</span>
                </p>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-3">
              {deleteError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-2 flex items-start gap-2">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={14} />
                  <p className="text-red-500 text-xs">{deleteError}</p>
                </div>
              )}

              <div>
                <input
                  type="text"
                  value={deleteConfirmName}
                  onChange={(e) => {
                    setDeleteConfirmName(e.target.value);
                    setDeleteError('');
                  }}
                  className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/50 text-white placeholder-gray-500 text-sm"
                  placeholder="Nome organizzazione"
                  disabled={isDeleting}
                  autoFocus
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmName('');
                    setDeleteError('');
                  }}
                  disabled={isDeleting}
                  className="flex-1 px-3 py-1.5 bg-gray-800 border border-gray-700 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDeleteOrganization}
                  disabled={isDeleting || deleteConfirmName !== organization.name}
                  className="flex-1 px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Eliminazione...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Elimina Definitivamente
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

