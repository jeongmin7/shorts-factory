import { startScheduler } from '@/services/scheduler'

let initialized = false

export function initializeApp() {
  if (initialized) return
  initialized = true

  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULER === 'true') {
    startScheduler()
  }
}
