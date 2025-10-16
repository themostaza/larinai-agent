'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, Trash2, Loader2, AlertCircle, X } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  role: string;
}

interface User {
  id: string;
  email: string;
  role: string;
  created_at: string;
  status: 'active' | 'invited'; // active = già registrato, invited = pre-invitato
  inviteId?: number; // ID dell'invito se status = invited
}

export default function ManageUsersPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [users, setUsers] = useState<User[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [error, setError] = useState('');
  
  // Add User Modal State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [addUserError, setAddUserError] = useState('');

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      fetchUsers(selectedOrgId);
      // Salva la selezione in localStorage
      localStorage.setItem('selectedOrganizationId', selectedOrgId);
    }
  }, [selectedOrgId]);

  const fetchOrganizations = async () => {
    try {
      setIsLoadingOrgs(true);
      const response = await fetch('/api/organizations');
      const data = await response.json();

      if (!data.success) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        setError(data.error || 'Errore nel caricamento delle organizzazioni');
        return;
      }

      // Filtra solo organizzazioni dove l'utente è admin
      const adminOrgs = data.organizations.filter((org: Organization) => org.role === 'admin');
      
      if (adminOrgs.length === 0) {
        setError('Non hai permessi di admin per nessuna organizzazione');
        setIsLoadingOrgs(false);
        return;
      }

      setOrganizations(adminOrgs);
      
      // Ripristina l'organizzazione selezionata da localStorage
      const savedOrgId = localStorage.getItem('selectedOrganizationId');
      
      if (adminOrgs.length > 0) {
        // Verifica se l'organizzazione salvata è ancora valida
        const isValidOrg = savedOrgId && adminOrgs.some((org: Organization) => org.id === savedOrgId);
        
        if (isValidOrg) {
          // Ripristina l'organizzazione salvata
          setSelectedOrgId(savedOrgId);
        } else {
          // Altrimenti seleziona la prima organizzazione
          setSelectedOrgId(adminOrgs[0].id);
        }
      }
      
      setUserRole('admin');
    } catch (err) {
      console.error('Error fetching organizations:', err);
      setError('Errore di connessione');
    } finally {
      setIsLoadingOrgs(false);
    }
  };

  const fetchUsers = async (organizationId: string) => {
    try {
      setIsLoadingUsers(true);
      const response = await fetch(`/api/organizations/users?organizationId=${organizationId}`);
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Errore nel caricamento degli utenti');
        return;
      }

      setUsers(data.users);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Errore di connessione');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError('');
    setIsAddingUser(true);

    try {
      const response = await fetch('/api/organizations/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          email: newUserEmail,
          role: newUserRole,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setAddUserError(data.error || 'Errore nell\'aggiunta dell\'utente');
        setIsAddingUser(false);
        return;
      }

      // Ricarica la lista utenti
      await fetchUsers(selectedOrgId);
      
      // Chiudi il modal e resetta il form
      setShowAddUserModal(false);
      setNewUserEmail('');
      setNewUserRole('user');
      setIsAddingUser(false);
    } catch (err) {
      console.error('Error adding user:', err);
      setAddUserError('Errore di connessione. Riprova.');
      setIsAddingUser(false);
    }
  };

  const handleRemoveUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Sei sicuro di voler rimuovere ${userEmail} dall'organizzazione?`)) {
      return;
    }

    try {
      const response = await fetch('/api/organizations/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: selectedOrgId,
          userId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Errore nella rimozione dell\'utente');
        return;
      }

      // Ricarica la lista utenti
      await fetchUsers(selectedOrgId);
    } catch (err) {
      console.error('Error removing user:', err);
      setError('Errore di connessione');
    }
  };

  const handleRemoveInvite = async (inviteId: number, userEmail: string) => {
    if (!confirm(`Sei sicuro di voler eliminare l'invito per ${userEmail}?`)) {
      return;
    }

    try {
      const response = await fetch('/api/organizations/invites', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inviteId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Errore nell\'eliminazione dell\'invito');
        return;
      }

      // Ricarica la lista utenti
      await fetchUsers(selectedOrgId);
    } catch (err) {
      console.error('Error removing invite:', err);
      setError('Errore di connessione');
    }
  };

  if (isLoadingOrgs) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin" size={32} />
          <span className="text-xl">Caricamento...</span>
        </div>
      </div>
    );
  }

  const isAdmin = userRole === 'admin';

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Back Button + Organization Select */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/back')}
                className="p-1.5 text-gray-400 hover:text-white transition-colors"
                title="Torna indietro"
              >
                <ArrowLeft size={20} />
              </button>

              {organizations.length > 0 && (
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 min-w-[200px]"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name || 'Organizzazione senza nome'}
                    </option>
                  ))}
                </select>
              )}
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Gestione Utenti</h1>
            <p className="text-gray-400 text-sm mt-1">
              Gestisci gli utenti dell&apos;organizzazione
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowAddUserModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
            >
              <UserPlus size={16} />
              <span>Aggiungi Utente</span>
            </button>
          )}
        </div>

        {/* Users Table */}
        {isLoadingUsers ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-800">
            <UserPlus size={48} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">
              Nessun utente trovato per questa organizzazione.
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
                    Ruolo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Aggiunto il
                  </th>
                  {isAdmin && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Azioni
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white">{user.email}</span>
                        {user.status === 'invited' && (
                          <span className="px-2 py-0.5 text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/50 rounded-full">
                            Invitato
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        user.role === 'admin' 
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/50'
                          : 'bg-gray-700 text-gray-300'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {new Date(user.created_at).toLocaleDateString('it-IT')}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => user.status === 'invited' 
                            ? handleRemoveInvite(user.inviteId!, user.email)
                            : handleRemoveUser(user.id, user.email)
                          }
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                          title={user.status === 'invited' ? 'Elimina invito' : 'Rimuovi utente'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 max-w-md w-full relative">
            {/* Close Button */}
            <button
              onClick={() => {
                setShowAddUserModal(false);
                setAddUserError('');
                setNewUserEmail('');
                setNewUserRole('user');
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            {/* Modal Content */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Aggiungi Utente</h2>
              <p className="text-gray-400 text-sm">
                Inserisci l&apos;email dell&apos;utente da aggiungere all&apos;organizzazione
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleAddUser} className="space-y-4">
              {/* Error */}
              {addUserError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-red-500 text-sm">{addUserError}</p>
                </div>
              )}

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-gray-500"
                  placeholder="utente@esempio.com"
                  disabled={isAddingUser}
                />
              </div>

              {/* Role */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-300 mb-2">
                  Ruolo
                </label>
                <select
                  id="role"
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'user' | 'admin')}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white"
                  disabled={isAddingUser}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isAddingUser}
                className="w-full px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAddingUser ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Aggiunta in corso...
                  </>
                ) : (
                  <>
                    <UserPlus size={20} />
                    Aggiungi
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


