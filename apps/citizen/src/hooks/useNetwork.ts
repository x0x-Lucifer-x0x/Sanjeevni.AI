'use client'

import { useState, useEffect, useCallback } from 'react'
import { flushQueue, getPendingReports } from '@/lib/offlineQueue'
import { submitIncident } from '@/lib/api'

export type NetworkState = 'online' | 'offline' | 'reconnecting'

export function useNetwork() {
  // Always start with the same value on server and client
  // to avoid hydration mismatches.
  const [networkState, setNetworkState] =
    useState<NetworkState>('online')

  const [pendingCount, setPendingCount] = useState(0)

  const refreshPendingCount = useCallback(async () => {
    const pending = await getPendingReports()
    setPendingCount(pending.length)
  }, [])

  const attemptFlush = useCallback(async () => {
    setNetworkState('reconnecting')

    const { sent } = await flushQueue(
      (payload) => submitIncident(payload as any),
      () => refreshPendingCount(),
      () => {}
    )

    setNetworkState('online')

    if (sent > 0) {
      await refreshPendingCount()
    }
  }, [refreshPendingCount])

  useEffect(() => {
    // Read actual network state only after hydration.
    setNetworkState(navigator.onLine ? 'online' : 'offline')

    refreshPendingCount()

    const handleOnline = () => {
      attemptFlush()
    }

    const handleOffline = () => {
      setNetworkState('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [attemptFlush, refreshPendingCount])

  return {
    networkState,
    pendingCount,
    refreshPendingCount,
    attemptFlush,
  }
}