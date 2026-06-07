'use client'
import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Incident, Resource } from '@/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface RealtimeCallbacks {
  onIncidentInsert?: (incident: Incident) => void
  onIncidentUpdate?: (incident: Incident) => void
  onResourceUpdate?: (resource: Resource) => void
}

export function useRealtimeUpdates(eventId: string | null, callbacks: RealtimeCallbacks) {
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  useEffect(() => {
    if (!eventId) return

    const channel = supabase
      .channel(`event-${eventId}`)

      // New incidents
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'incidents',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          callbacksRef.current.onIncidentInsert?.(payload.new as Incident)
        },
      )

      // Updated incidents (status changes, AI results)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'incidents',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          callbacksRef.current.onIncidentUpdate?.(payload.new as Incident)
        },
      )

      // Resource status changes
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'resources',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          callbacksRef.current.onResourceUpdate?.(payload.new as Resource)
        },
      )

      .subscribe((status) => {
        console.log('[Sanjeevani Realtime]', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [eventId])
}