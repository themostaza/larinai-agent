'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Key, Building2, Trash2, LogOut, AlertTriangle, X, Loader2, AlertCircle } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  role: string;
}

interface UserProfile {
  email: string;
  id: string;
  organizations: Organization[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Password change state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Leave organization state
  const [showLeaveOrgDialog, setShowLeaveOrgDialog] = useState(false);
  const [orgToLeave, setOrgToLeave] = useState<Organization | null>(null);
  const [leaveOrgConfirmation, setLeaveOrgConfirmation] = useState('');
  const [isLeavingOrg, setIsLeavingOrg] = useState(false);
  const [leaveOrgError, setLeaveOrgError] = useState('');

  // Delete account state
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/profile');
      const data = await response.json();

      if (!data.success) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        setError(data.error || 'Errore nel caricamento del profilo');
        return;
      }

      setProfile(data.profile);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Errore di connessione');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess(false);

    // Validazione
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Tutti i campi sono obbligatori');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('La nuova password deve essere di almeno 8 caratteri');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Le password non coincidono');
      return;
    }

    try {
      setIsChangingPassword(true);
      const response = await fetch('/api/auth/profile/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setPasswordError(data.error || 'Errore nel cambio password');
        return;
      }

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        setShowPasswordDialog(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Error changing password:', err);
      setPasswordError('Errore di connessione');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLeaveOrganization = async () => {
    if (!orgToLeave) return;

    setLeaveOrgError('');

    // Validazione: l'utente deve scrivere il nome dell'organizzazione
    if (leaveOrgConfirmation !== orgToLeave.name) {
      setLeaveOrgError('Il nome dell\'organizzazione non corrisponde');
      return;
    }

    try {
      setIsLeavingOrg(true);
      const response = await fetch('/api/auth/profile/organization', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: orgToLeave.id,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setLeaveOrgError(data.error || 'Errore nell\'uscita dall\'organizzazione');
        return;
      }

      // Ricarica il profilo
      await fetchProfile();
      setShowLeaveOrgDialog(false);
      setOrgToLeave(null);
      setLeaveOrgConfirmation('');
    } catch (err) {
      console.error('Error leaving organization:', err);
      setLeaveOrgError('Errore di connessione');
    } finally {
      setIsLeavingOrg(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteAccountError('');

    // Validazione: l'utente deve scrivere "delete profile"
    if (deleteAccountConfirmation !== 'delete profile') {
      setDeleteAccountError('Devi scrivere esattamente "delete profile" per continuare');
      return;
    }

    try {
      setIsDeletingAccount(true);
      const response = await fetch('/api/auth/profile', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        setDeleteAccountError(data.error || 'Errore nell\'eliminazione dell\'account');
        return;
      }

      // Logout e redirect
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Error deleting account:', err);
      setDeleteAccountError('Errore di connessione');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const openLeaveOrgDialog = (org: Organization) => {
    setOrgToLeave(org);
    setLeaveOrgConfirmation('');
    setLeaveOrgError('');
    setShowLeaveOrgDialog(true);
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

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/back')}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                title="Torna indietro"
              >
                <ArrowLeft size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-500">{error}</p>
          </div>
        )}

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Profilo</h1>
          <p className="text-gray-400 text-sm mt-1">
            Gestisci le tue informazioni
          </p>
        </div>

        {/* Profile Content */}
        <div className="space-y-6">
          {/* Email Section */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Mail size={20} className="text-gray-400" />
              <h2 className="text-lg font-semibold">Email</h2>
            </div>
            <p className="text-gray-300 text-sm">{profile?.email}</p>
          </div>

          {/* Password Section */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Key size={20} className="text-gray-400" />
                <div>
                  <h2 className="text-lg font-semibold">Password</h2>
                  <p className="text-gray-400 text-sm mt-0.5">
                    Cambia la tua password di accesso
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPasswordDialog(true)}
                className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cambia Password
              </button>
            </div>
          </div>

          {/* Organizations Section */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Building2 size={20} className="text-gray-400" />
              <h2 className="text-lg font-semibold">Le Mie Organizzazioni</h2>
            </div>
            
            {!profile || profile.organizations.length === 0 ? (
              <div className="text-center py-8">
                <Building2 size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">
                  Non sei membro di nessuna organizzazione
                </p>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-700 border-b border-gray-600">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Nome
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Ruolo
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Azioni
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {profile.organizations.map((org) => (
                      <tr key={org.id} className="hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-white">
                          {org.name}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            org.role === 'admin' || org.role === 'owner'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/50'
                              : 'bg-gray-600 text-gray-300'
                          }`}>
                            {org.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => openLeaveOrgDialog(org)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                            title="Esci dall'organizzazione"
                          >
                            <LogOut size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Delete Account Section */}
          <div className="bg-gray-900 border border-red-900/50 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} className="text-red-400" />
                <div>
                  <h2 className="text-lg font-semibold text-red-400">Zona Pericolosa</h2>
                  <p className="text-gray-400 text-sm mt-0.5">
                    L&apos;eliminazione del tuo account è permanente e irreversibile
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteAccountDialog(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                Elimina Account
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Change Password Dialog */}
      {showPasswordDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 max-w-md w-full relative">
            <button
              onClick={() => {
                setShowPasswordDialog(false);
                setPasswordError('');
                setPasswordSuccess(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Cambia Password</h2>
              <p className="text-gray-400 text-sm">
                Inserisci la tua password attuale e la nuova password
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }} className="space-y-4">
              {passwordError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-red-500 text-sm">{passwordError}</p>
                </div>
              )}

              {passwordSuccess && (
                <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-green-500 text-sm">Password cambiata con successo!</p>
                </div>
              )}

              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300 mb-2">
                  Password Attuale
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-gray-500"
                  placeholder="Inserisci la password attuale"
                  disabled={isChangingPassword}
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-2">
                  Nuova Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-gray-500"
                  placeholder="Almeno 8 caratteri"
                  disabled={isChangingPassword}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                  Conferma Nuova Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-gray-500"
                  placeholder="Ripeti la nuova password"
                  disabled={isChangingPassword}
                />
              </div>

              <button
                type="submit"
                disabled={isChangingPassword}
                className="w-full px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Cambio in corso...
                  </>
                ) : (
                  <>
                    <Key size={20} />
                    Cambia Password
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Leave Organization Dialog */}
      {showLeaveOrgDialog && orgToLeave && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 max-w-md w-full relative">
            <button
              onClick={() => {
                setShowLeaveOrgDialog(false);
                setOrgToLeave(null);
                setLeaveOrgConfirmation('');
                setLeaveOrgError('');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle size={24} className="text-red-400" />
                <h2 className="text-2xl font-bold">Conferma Uscita</h2>
              </div>
              <p className="text-gray-400 text-sm">
                Questa azione non può essere annullata
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleLeaveOrganization(); }} className="space-y-4">
              {leaveOrgError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-red-500 text-sm">{leaveOrgError}</p>
                </div>
              )}

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <p className="text-white text-sm">
                  Stai per uscire dall&apos;organizzazione:
                </p>
                <p className="text-white font-semibold text-lg mt-2">
                  {orgToLeave.name}
                </p>
              </div>

              <div>
                <label htmlFor="leaveOrgConfirmation" className="block text-sm font-medium text-gray-300 mb-2">
                  Per confermare, scrivi il nome dell&apos;organizzazione
                </label>
                <input
                  id="leaveOrgConfirmation"
                  type="text"
                  value={leaveOrgConfirmation}
                  onChange={(e) => setLeaveOrgConfirmation(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-gray-500"
                  placeholder={orgToLeave.name}
                  disabled={isLeavingOrg}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveOrgDialog(false);
                    setOrgToLeave(null);
                    setLeaveOrgConfirmation('');
                    setLeaveOrgError('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isLeavingOrg || leaveOrgConfirmation !== orgToLeave.name}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isLeavingOrg ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Uscita...
                    </>
                  ) : (
                    'Conferma Uscita'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Dialog */}
      {showDeleteAccountDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg border border-red-900/50 p-8 max-w-md w-full relative">
            <button
              onClick={() => {
                setShowDeleteAccountDialog(false);
                setDeleteAccountConfirmation('');
                setDeleteAccountError('');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle size={24} className="text-red-400" />
                <h2 className="text-2xl font-bold text-red-400">Elimina Account</h2>
              </div>
              <p className="text-gray-400 text-sm">
                Questa azione è permanente e irreversibile
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleDeleteAccount(); }} className="space-y-4">
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
                <p className="text-red-300 font-semibold mb-2">⚠️ ATTENZIONE</p>
                <p className="text-gray-300 text-sm">
                  Tutti i tuoi dati verranno eliminati definitivamente.
                  Non sarà possibile recuperare il tuo account.
                </p>
              </div>

              {deleteAccountError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-red-500 text-sm">{deleteAccountError}</p>
                </div>
              )}

              <div>
                <label htmlFor="deleteConfirmation" className="block text-sm font-medium text-gray-300 mb-2">
                  Per confermare, scrivi <strong>&quot;delete profile&quot;</strong>
                </label>
                <input
                  id="deleteConfirmation"
                  type="text"
                  value={deleteAccountConfirmation}
                  onChange={(e) => setDeleteAccountConfirmation(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-gray-500"
                  placeholder="delete profile"
                  disabled={isDeletingAccount}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteAccountDialog(false);
                    setDeleteAccountConfirmation('');
                    setDeleteAccountError('');
                  }}
                  className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isDeletingAccount || deleteAccountConfirmation !== 'delete profile'}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isDeletingAccount ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Eliminazione...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Elimina Account
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

