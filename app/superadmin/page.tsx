'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle, Key, X } from 'lucide-react';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export default function SuperAdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    checkAuthAndLoadUsers();
  }, []);

  const checkAuthAndLoadUsers = async () => {
    try {
      setIsLoading(true);
      
      // Verifica se l'utente è il super admin
      const authResponse = await fetch('/api/auth/user');
      const authData = await authResponse.json();

      if (!authData.user) {
        router.push('/login');
        return;
      }

      const userEmail = authData.user.email;
      setCurrentUserEmail(userEmail);

      // Controlla se è il super admin
      if (userEmail !== 'paolo@neocode.dev') {
        setError('Accesso negato. Solo il super admin può accedere a questa pagina.');
        setIsLoading(false);
        return;
      }

      setIsAuthorized(true);

      // Carica tutti gli utenti
      const usersResponse = await fetch('/api/superadmin/users');
      const usersData = await usersResponse.json();

      if (!usersData.success) {
        setError(usersData.error || 'Errore nel caricamento degli utenti');
        setIsLoading(false);
        return;
      }

      setUsers(usersData.users);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Errore di connessione');
    } finally {
      setIsLoading(false);
    }
  };

  const openPasswordModal = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');
    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setSelectedUser(null);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('La password deve essere di almeno 6 caratteri');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Le password non coincidono');
      return;
    }

    if (!selectedUser) return;

    setIsChangingPassword(true);

    try {
      const response = await fetch('/api/superadmin/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          newPassword: newPassword,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setPasswordError(data.error || 'Errore nel cambio password');
        setIsChangingPassword(false);
        return;
      }

      setPasswordSuccess('Password modificata con successo!');
      
      // Chiudi il modal dopo 1.5 secondi
      setTimeout(() => {
        closePasswordModal();
      }, 1500);
    } catch (err) {
      console.error('Error changing password:', err);
      setPasswordError('Errore di connessione. Riprova.');
    } finally {
      setIsChangingPassword(false);
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

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-1" size={24} />
              <div>
                <h2 className="text-xl font-bold text-red-500 mb-2">Accesso Negato</h2>
                <p className="text-gray-300">{error}</p>
                <button
                  onClick={() => router.push('/')}
                  className="mt-4 px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Torna alla Home
                </button>
              </div>
            </div>
          </div>
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
                onClick={() => router.push('/')}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                title="Torna alla home"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-lg font-semibold">Super Admin</h1>
            </div>
            <div className="text-sm text-gray-400">
              Loggato come: <span className="text-white font-medium">{currentUserEmail}</span>
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
          <h2 className="text-2xl font-bold">Gestione Password Utenti</h2>
          <p className="text-gray-400 text-sm mt-1">
            Modifica le password di qualsiasi utente nel sistema
          </p>
        </div>

        {/* Users Table */}
        {users.length === 0 ? (
          <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-800">
            <AlertCircle size={48} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">
              Nessun utente trovato nel sistema.
            </p>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    ID Utente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Registrato il
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Ultimo accesso
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium">{user.email}</span>
                        {user.email === currentUserEmail && (
                          <span className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/50 rounded-full">
                            Tu
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-400 font-mono">{user.id.substring(0, 8)}...</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {new Date(user.created_at).toLocaleDateString('it-IT', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {user.last_sign_in_at 
                        ? new Date(user.last_sign_in_at).toLocaleDateString('it-IT', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        : 'Mai'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openPasswordModal(user)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500/10 text-blue-400 border border-blue-500/50 rounded-lg hover:bg-blue-500/20 transition-colors"
                        title="Cambia password"
                      >
                        <Key size={14} />
                        Cambia Password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Change Password Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 max-w-md w-full relative">
            {/* Close Button */}
            <button
              onClick={closePasswordModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              disabled={isChangingPassword}
            >
              <X size={20} />
            </button>

            {/* Modal Content */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Key size={24} className="text-blue-400" />
                <h2 className="text-2xl font-bold">Cambia Password</h2>
              </div>
              <p className="text-gray-400 text-sm">
                Stai modificando la password per: <span className="text-white font-medium">{selectedUser.email}</span>
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Error */}
              {passwordError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-red-500 text-sm">{passwordError}</p>
                </div>
              )}

              {/* Success */}
              {passwordSuccess && (
                <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-3">
                  <p className="text-green-500 text-sm">{passwordSuccess}</p>
                </div>
              )}

              {/* New Password */}
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
                  minLength={6}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white placeholder-gray-500"
                  placeholder="Minimo 6 caratteri"
                  disabled={isChangingPassword || !!passwordSuccess}
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                  Conferma Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white placeholder-gray-500"
                  placeholder="Ripeti la password"
                  disabled={isChangingPassword || !!passwordSuccess}
                />
              </div>

              {/* Submit */}
              {!passwordSuccess && (
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Modifica in corso...
                    </>
                  ) : (
                    <>
                      <Key size={20} />
                      Cambia Password
                    </>
                  )}
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

