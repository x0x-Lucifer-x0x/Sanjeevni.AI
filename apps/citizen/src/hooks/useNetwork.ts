'use client'
import { useState, useEffect, useCallback } from 'react'
import { flushQueue, getPendingReports } from '@/lib/offlineQueue'
import { submitIncident } from '@/lib/api'

export type NetworkState = 'online' | 'offline' | 'reconnecting'

export function useNetwork() {
  // Always start with 'online' — same on server and client, avoiding hydration mismatch.
  // Real navigator.onLine value is read inside useEffect after hydration.
  const [networkState, setNetworkState] = useState<NetworkState>('online')
  const [pendingCount, setPendingCount] = useState(0)

  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await getPendingReports()
      setPendingCount(pending.length)
    } catch {
      // IndexedDB may not be available during SSR
    }
  }, [])

  const attemptFlush = useCallback(async () => {
    setNetworkState('reconnecting')
    try {
      const { sent } = await flushQueue(
        (payload) => submitIncident(payload as any),
        () => refreshPendingCount(),
        () => {},
      )
      if (sent > 0) await refreshPendingCount()
    } catch {
      // ignore flush errors
    }
    setNetworkState('online')
  }, [refreshPendingCount])

  useEffect(() => {
    // Sync real network state after hydration — safe to read navigator here
    setNetworkState(navigator.onLine ? 'online' : 'offline')
    refreshPendingCount()

    const handleOnline = () => attemptFlush()
    const handleOffline = () => setNetworkState('offline')

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [attemptFlush, refreshPendingCount])

  return { networkState, pendingCount, refreshPendingCount, attemptFlush }
}