'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

export default function NewChatRedirect() {
  const router = useRouter();
  const params = useParams();
  const agentId = params.agentId as string;

  useEffect(() => {
    // Genera un nuovo session ID e redirect
    const newSessionId = uuidv4();
    router.replace(`/agent/${agentId}/${newSessionId}`);
  }, [agentId, router]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 bg-white rounded-full animate-bounce"></div>
        <div className="w-4 h-4 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-4 h-4 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </div>
  );
}

