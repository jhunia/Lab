import type { LabDexApi } from '@shared/types'

declare global {
  interface Window {
    labdex: LabDexApi
  }
}

export {}
