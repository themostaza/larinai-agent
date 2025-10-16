'use client';

import React, { useState } from 'react';
import { Copy, Loader2, X, AlertCircle } from 'lucide-react';

interface DuplicateAgentDialogProps {
  agentId: string;
  agentName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DuplicateAgentDialog({ 
  agentId, 
  agentName, 
  onClose, 
  onSuccess 
}: DuplicateAgentDialogProps) {
  const [newName, setNewName] = useState(`Copy of ${agentName}`);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [error, setError] = useState('');

  const handleDuplicate = async () => {
    if (!newName.trim()) {
      setError('Il nome è obbligatorio');
      return;
    }

    setIsDuplicating(true);
    setError('');

    try {
      const response = await fetch(`/api/agents/${agentId}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newName: newName.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Errore nella duplicazione dell\'agent');
        setIsDuplicating(false);
        return;
      }

      // Chiudi modal e ricarica la lista
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error duplicating agent:', err);
      setError('Errore di connessione');
      setIsDuplicating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 max-w-md w-full relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          disabled={isDuplicating}
        >
          <X size={20} />
        </button>

        {/* Modal Content */}
        <div className="mb-6">
          <p className="text-gray-400 text-xl font-medium text-center mb-4">
            Vuoi duplicare <span className="text-white font-medium">{agentName}</span>?
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
              <p className="text-red-500 text-sm">{error}</p>
            </div>
          )}

          {/* Agent Name */}
            <div>
            <input
              id="newAgentName"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleDuplicate();
                }
              }}
              required
              autoFocus
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 text-white placeholder-gray-500"
              placeholder="es: Copy of Agent"
              disabled={isDuplicating}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isDuplicating}
              className="flex-1 px-6 py-3 bg-gray-800 border border-gray-700 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              onClick={handleDuplicate}
              disabled={isDuplicating || !newName.trim()}
              className="flex-1 px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isDuplicating ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Duplicazione...
                </>
              ) : (
                <>
                  <Copy size={20} />
                  Duplica
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

