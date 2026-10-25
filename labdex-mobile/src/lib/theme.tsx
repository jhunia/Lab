import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import type { StorageTemp } from '@shared/types'

// "Logbook" design: a specimen register — paper, ink and printed labels.
// Colour is reserved for urgency (red = overdue/rejected, amber = due soon) and tube caps.
const light = {
  bg: '#F4F1E8', // register paper
  surface: '#FBF9F3', // fresh sheet (cards, inputs)
  surface2: '#EFEBE0',
  surface3: '#E7E2D5',
  ink: '#1B1A17',
  ink2: '#3D3A33',
  muted: '#7A7468',
  line: '#DDD7C9', // ruled lines
  lineStrong: '#CFC9BA',
  margin: '#D4A59A', // the red-ruled margin of a logbook page
  accent: '#1B1A17', // primary actions are black ink
  accentInk: '#F4F1E8',
  accentSoft: 'rgba(27,26,23,0.07)',
  amber: '#9A6100',
  warnBg: '#F1D58A',
  warnInk: '#4D3400',
  danger: '#B3261E',
  dangerSoft: '#F6E1DB',
  urgent: '#B3261E',
  success: '#3F7D58',
  note: '#FFFDF6', // handover note slip
  glass: 'rgba(27,26,23,0.05)',
  glassStroke: 'rgba(27,26,23,0.32)',
  label: '#FFFFFF',
  readout: '#1B1A17',
  stamp: {
    RECEIVED: '#2556A3',
    IN_PROGRESS: '#6A3DB0',
    PENDING: '#9A6100',
    SENT_OUT: '#1F6F8B',
    COMPLETED: '#3F7D58',
    REJECTED: '#B3261E'
  } as Record<'RECEIVED' | 'IN_PROGRESS' | 'PENDING' | 'SENT_OUT' | 'COMPLETED' | 'REJECTED', string>,
  storage: {
    ROOM: { fg: '#8A5A12', bg: '#F3E6CC' },
    FRIDGE: { fg: '#1F5F8B', bg: '#DCE8F0' },
    FROZEN: { fg: '#2F4FA0', bg: '#DEE3F2' },
    DEEP_FROZEN: { fg: '#5A3EA8', bg: '#E6DFF3' }
  } as Record<StorageTemp, { fg: string; bg: string }>
}

// Night register: the same book under a desk lamp.
const dark: typeof light = {
  bg: '#151410',
  surface: '#1D1B16',
  surface2: '#23211B',
  surface3: '#2B2821',
  ink: '#EDE7D8',
  ink2: '#CFC8B6',
  muted: '#948D7E',
  line: '#34312A',
  lineStrong: '#444036',
  margin: '#7A4E44',
  accent: '#EDE7D8',
  accentInk: '#151410',
  accentSoft: 'rgba(237,231,216,0.08)',
  amber: '#E3B04B',
  warnBg: '#5A4410',
  warnInk: '#F4D58A',
  danger: '#F07A65',
  dangerSoft: 'rgba(240,122,101,0.14)',
  urgent: '#F07A65',
  success: '#7CC49A',
  note: '#26231C',
  glass: 'rgba(255,255,255,0.05)',
  glassStroke: 'rgba(255,255,255,0.30)',
  label: '#E9E4D6',
  readout: '#0B0A08',
  stamp: {
    RECEIVED: '#7FA7E8',
    IN_PROGRESS: '#B89AF0',
    PENDING: '#E3B04B',
    SENT_OUT: '#6FC2DB',
    COMPLETED: '#7CC49A',
    REJECTED: '#F07A65'
  },
  storage: {
    ROOM: { fg: '#E3B04B', bg: 'rgba(227,176,75,0.14)' },
    FRIDGE: { fg: '#7FB6DE', bg: 'rgba(127,182,222,0.14)' },
    FROZEN: { fg: '#93A9EC', bg: 'rgba(147,169,236,0.14)' },
    DEEP_FROZEN: { fg: '#B89AF0', bg: 'rgba(184,154,240,0.14)' }
  }
}

export type Colors = typeof light

/** Custom fonts need one family per weight in React Native. */
export const font = {
  /** Condensed "printed label" face for titles, lab numbers and stamps. */
  display: 'BarlowCondensed_700Bold',
  displayBold: 'BarlowCondensed_700Bold',
  displaySemi: 'BarlowCondensed_600SemiBold',
  displayMedium: 'BarlowCondensed_500Medium',
  body: 'IBMPlexSans_400Regular',
  bodyMedium: 'IBMPlexSans_500Medium',
  bodySemi: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemi: 'IBMPlexMono_600SemiBold'
}

export type ThemePref = 'system' | 'light' | 'dark'

interface ThemeCtx {
  c: Colors
  mode: 'light' | 'dark'
  pref: ThemePref
  setPref: (p: ThemePref) => void
}

const Ctx = createContext<ThemeCtx>({ c: light, mode: 'light', pref: 'system', setPref: () => {} })
const KEY = 'labdex.theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme()
  const [pref, setPrefState] = useState<ThemePref>('system')

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => v && setPrefState(v as ThemePref))
      .catch(() => {})
  }, [])

  const value = useMemo<ThemeCtx>(() => {
    const mode = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref
    return {
      c: mode === 'dark' ? dark : light,
      mode,
      pref,
      setPref: (p) => {
        setPrefState(p)
        AsyncStorage.setItem(KEY, p).catch(() => {})
      }
    }
  }, [pref, system])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
