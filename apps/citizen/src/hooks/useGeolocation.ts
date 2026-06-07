'use client'
import { useState, useEffect, useCallback } from 'react'

export interface GeoState {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  loading: boolean
  error: string | null
}

// Fallback: Mahakumbh Prayagraj coordinates
const FALLBACK_LAT = 25.4358
const FALLBACK_LNG = 81.8463

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    loading: true,
    error: null,
  })

  const request = useCallback(() => {
    setState(s => ({ ...s, loading: true, error: null }))

    if (!navigator.geolocation) {
      setState({
        latitude: FALLBACK_LAT,
        longitude: FALLBACK_LNG,
        accuracy: null,
        loading: false,
        error: 'Geolocation not supported — using default location',
      })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          loading: false,
          error: null,
        })
      },
      (err) => {
        console.warn('Geolocation error, using fallback:', err.message)
        setState({
          latitude: FALLBACK_LAT,
          longitude: FALLBACK_LNG,
          accuracy: null,
          loading: false,
          error: `Using default location (${err.message})`,
        })
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    )
  }, [])

  useEffect(() => { request() }, [request])

  const coords = {
    lat: state.latitude ?? FALLBACK_LAT,
    lng: state.longitude ?? FALLBACK_LNG,
  }

  return { ...state, coords, refresh: request }
}