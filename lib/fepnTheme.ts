import { Baloo_2, Nunito } from 'next/font/google'
import { getModernThemeVars } from '@/app/components/modernTheme'

export const headingFont = Baloo_2({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-fepn-heading',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const bodyFont = Nunito({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-fepn-body',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export { getModernThemeVars }
