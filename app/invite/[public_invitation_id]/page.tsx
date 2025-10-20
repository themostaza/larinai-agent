'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, AlertCircle, Clock } from 'lucide-react';

interface InviteData {
  id: number;
  email: string;
  organization_id: string;
  organization_name: string;
  role: string;
  status: string | null;
  created_at: string;
  isExpired: boolean;
}

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const publicInvitationId = params.public_invitation_id as string;

  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  useEffect(() => {
    fetchInviteData();
  }, [publicInvitationId]);

  const fetchInviteData = async () => {
    try {
      setIsLoading(true);
      setError('');

      const response = await fetch(`/api/invitations/${publicInvitationId}`);
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Invito non trovato');
        setIsLoading(false);
        return;
      }

      setInviteData(data.invite);
      setCurrentUserEmail(data.currentUserEmail || '');
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching invite:', err);
      setError('Errore di connessione');
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    setIsProcessing(true);
    setError('');

    try {
      const response = await fetch(`/api/invitations/${publicInvitationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'accept',
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Errore nell\'accettazione dell\'invito');
        setIsProcessing(false);
        return;
      }

      // Reindirizza alla pagina principale dell'organizzazione
      router.push('/back');
    } catch (err) {
      console.error('Error accepting invite:', err);
      setError('Errore di connessione');
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!confirm('Sei sicuro di voler rifiutare questo invito?')) {
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const response = await fetch(`/api/invitations/${publicInvitationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reject',
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Errore nel rifiuto dell\'invito');
        setIsProcessing(false);
        return;
      }

      // Reindirizza alla home
      router.push('/');
    } catch (err) {
      console.error('Error rejecting invite:', err);
      setError('Errore di connessione');
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin" size={32} />
          <span className="text-xl">Caricamento invito...</span>
        </div>
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 rounded-lg border border-gray-800 p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="text-red-500" size={32} />
            <h1 className="text-2xl font-bold">Invito non valido</h1>
          </div>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            Torna alla home
          </button>
        </div>
      </div>
    );
  }

  if (!inviteData) {
    return null;
  }

  // Mostra stato se l'invito è già stato processato
  if (inviteData.status === 'confirmed') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 rounded-lg border border-gray-800 p-8">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="text-green-500" size={32} />
            <h1 className="text-2xl font-bold">Invito già accettato</h1>
          </div>
          <p className="text-gray-400 mb-6">
            Hai già accettato l&apos;invito a <strong>{inviteData.organization_name}</strong>.
          </p>
          <button
            onClick={() => router.push('/back')}
            className="w-full px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            Vai al back office
          </button>
        </div>
      </div>
    );
  }

  if (inviteData.status === 'rejected' || inviteData.isExpired) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 rounded-lg border border-gray-800 p-8">
          <div className="flex items-center gap-3 mb-4">
            <XCircle className="text-red-500" size={32} />
            <h1 className="text-2xl font-bold">
              {inviteData.isExpired ? 'Invito scaduto' : 'Invito rifiutato'}
            </h1>
          </div>
          <p className="text-gray-400 mb-6">
            {inviteData.isExpired
              ? 'Questo invito è scaduto. Gli inviti sono validi per 3 giorni.'
              : 'Hai rifiutato questo invito.'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            Torna alla home
          </button>
        </div>
      </div>
    );
  }

  // Verifica se l'email dell'utente corrisponde
  const emailMismatch = !!currentUserEmail && currentUserEmail.toLowerCase() !== inviteData.email.toLowerCase();

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-900 rounded-lg border border-gray-800 p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Invito all&apos;organizzazione</h1>
          <p className="text-gray-400 text-sm">
            Hai ricevuto un invito per entrare in un&apos;organizzazione
          </p>
        </div>

        {/* Invite Details */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 space-y-3">
          <div>
            <span className="text-gray-400 text-sm">Organizzazione:</span>
            <p className="text-white font-semibold text-lg">{inviteData.organization_name}</p>
          </div>
          <div>
            <span className="text-gray-400 text-sm">Ruolo:</span>
            <p className="text-white font-semibold capitalize">{inviteData.role}</p>
          </div>
          <div>
            <span className="text-gray-400 text-sm">Email destinataria:</span>
            <p className="text-white">{inviteData.email}</p>
          </div>
          <div className="flex items-center gap-2 text-yellow-400 text-sm pt-2 border-t border-gray-700">
            <Clock size={16} />
            <span>Valido per 3 giorni dalla ricezione</span>
          </div>
        </div>

        {/* Email Mismatch Warning */}
        {emailMismatch && (
          <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-2">
              <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-yellow-500 font-semibold text-sm mb-1">Attenzione</p>
                <p className="text-yellow-400 text-sm">
                  L&apos;account attualmente in uso è <strong>{currentUserEmail}</strong>, ma l&apos;invito è destinato a <strong>{inviteData.email}</strong>.
                  {' '}Per accettare questo invito, è necessario effettuare il logout e accedere con l&apos;email corretta.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleAccept}
            disabled={isProcessing || emailMismatch}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Elaborazione...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                Accetta invito
              </>
            )}
          </button>

          <button
            onClick={handleReject}
            disabled={isProcessing || emailMismatch}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 border border-gray-700 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle size={20} />
            Rifiuta invito
          </button>
        </div>

        {/* Footer */}
        <p className="text-gray-500 text-xs text-center mt-6">
          Se non ti aspettavi questo invito, puoi tranquillamente rifiutarlo o ignorarlo.
        </p>
      </div>
    </div>
  );
}

