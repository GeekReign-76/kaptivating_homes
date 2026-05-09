'use client';

import { useEffect, useRef, useState } from 'react';
import { type Socket }                  from 'socket.io-client';
import { getSocket, disconnectSocket }  from '@/lib/socket';
import { isTestMode }                   from '@/lib/testMode';
import { createClient }                 from '@/lib/supabase/client';

/**
 * Connects to Socket.io using the current Supabase session token.
 * In test mode returns a no-op stub so components don't need branches.
 */
export function useSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (isTestMode()) {
      // Stub — no real connection needed
      setConnected(true);
      return;
    }

    let mounted = true;

    async function connect() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !mounted) return;

      const socket = getSocket(session.access_token);
      socketRef.current = socket;

      socket.on('connect',    () => mounted && setConnected(true));
      socket.on('disconnect', () => mounted && setConnected(false));
    }

    connect();

    return () => {
      mounted = false;
      disconnectSocket();
    };
  }, []);

  return { socket: socketRef.current, connected };
}
