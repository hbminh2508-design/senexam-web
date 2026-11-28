export const SEN_AI_MODES = {
  rose: { name: 'Rose', thinking: 'LOW', label: 'Low' },
  tulip: { name: 'Tulip', thinking: 'MEDIUM', label: 'Medium' },
  orchid: { name: 'Orchid', thinking: 'HIGH', label: 'High' },
} as const

export type SenAiMode = keyof typeof SEN_AI_MODES
export const SEN_AI_FILE_LIMIT = 2_500_000
export const SEN_AI_FILE_COUNT = 3
export const SEN_AI_FILE_TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  pdf: 'application/pdf', txt: 'text/plain', md: 'text/plain', csv: 'text/plain', json: 'text/plain',
} as const
export type SenAiAttachment = { name: string; mimeType: string; base64: string }
