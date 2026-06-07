'use client'

const DB_NAME = 'sanjeevani-offline'
const STORE_NAME = 'pending-reports'
const DB_VERSION = 1

export interface PendingReport {
  id: string
  payload: Record<string, unknown>
  createdAt: number
  retries: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function enqueueReport(payload: Record<string, unknown>): Promise<string> {
  const db = await openDB()
  const id = `report_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const entry: PendingReport = { id, payload, createdAt: Date.now(), retries: 0 }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).add(entry)
    req.onsuccess = () => resolve(id)
    req.onerror = () => reject(req.error)
  })
}

export async function getPendingReports(): Promise<PendingReport[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function removeReport(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function incrementRetry(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const entry = getReq.result as PendingReport
      entry.retries += 1
      const putReq = store.put(entry)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function flushQueue(
  submitFn: (payload: Record<string, unknown>) => Promise<unknown>,
  onSuccess: (id: string) => void,
  onError: (id: string, err: Error) => void,
): Promise<{ sent: number; failed: number }> {
  const pending = await getPendingReports()
  let sent = 0, failed = 0

  for (const report of pending) {
    try {
      await submitFn(report.payload)
      await removeReport(report.id)
      onSuccess(report.id)
      sent++
    } catch (err) {
      await incrementRetry(report.id)
      onError(report.id, err as Error)
      failed++
    }
  }
  return { sent, failed }
}