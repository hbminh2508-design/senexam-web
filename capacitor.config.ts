import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'me.senexam.app',
  appName: 'SenExam',
  webDir: 'capacitor-www',
  server: {
    url: 'https://www.senexam.me',
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
}

export default config
