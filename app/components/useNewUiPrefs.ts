'use client'

import { useEffect, useState } from 'react'

export type UiDensity = 'comfortable' | 'compact'
export type UiMode = 'legacy' | 'modern' | 'glass'

export const UI_PREFS_CHANGED_EVENT = 'senexam-ui-prefs-changed'

const DEFAULT_PREFS = {
  uiMode: 'modern' as UiMode,
  isGlass: false,
  isModern: true,
  newUiEnabled: true,
  themeColor: 'indigo',
  density: 'comfortable' as UiDensity,
  animationsEnabled: true,
  isBetaTester: false,
}

function readPrefs() {
  if (typeof window === 'undefined') {
    return DEFAULT_PREFS
  }

  try {
    const rawUiMode = localStorage.getItem('senexam_ui_mode')
    let uiMode: UiMode = 'modern'
    if (rawUiMode === 'glass' || rawUiMode === 'modern' || rawUiMode === 'legacy') {
      uiMode = rawUiMode
    } else if (localStorage.getItem('senexam_new_ui') === '0') {
      uiMode = 'legacy'
    }

    return {
      uiMode,
      isGlass: uiMode === 'glass',
      isModern: uiMode === 'modern',
      newUiEnabled: uiMode !== 'legacy',
      themeColor: localStorage.getItem('senexam_theme_color') || 'indigo',
      density: (localStorage.getItem('senexam_density') === 'compact' ? 'compact' : 'comfortable') as UiDensity,
      animationsEnabled: localStorage.getItem('senexam_animations') !== '0',
      isBetaTester: localStorage.getItem('senexam_beta_tester') === '1',
    }
  } catch (err) {
    return DEFAULT_PREFS
  }
}

export function useNewUiPrefs() {
  const [prefs, setPrefs] = useState(readPrefs)

  useEffect(() => {
    setPrefs(readPrefs())
    const handleChange = () => setPrefs(readPrefs())
    window.addEventListener(UI_PREFS_CHANGED_EVENT, handleChange)
    window.addEventListener('storage', handleChange)
    return () => {
      window.removeEventListener(UI_PREFS_CHANGED_EVENT, handleChange)
      window.removeEventListener('storage', handleChange)
    }
  }, [])

  return prefs
}
