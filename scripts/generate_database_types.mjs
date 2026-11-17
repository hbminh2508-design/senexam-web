import fs from 'fs'
import path from 'path'

async function generate() {
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secretKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment variables')
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nphryrldlfiuvpuqjovr.supabase.co'

  console.log('Fetching live OpenAPI schema from Supabase...')
  const res = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`
    }
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch schema: ${res.status} ${res.statusText}`)
  }

  const schema = await res.json()
  const defs = schema.definitions || {}
  const tableNames = Object.keys(defs).sort()
  console.log(`Found ${tableNames.length} tables in live schema. Generating TypeScript interfaces...`)

  function mapType(prop) {
    if (!prop) return 'any'
    if (prop.type === 'integer' || prop.type === 'number') return 'number'
    if (prop.type === 'boolean') return 'boolean'
    if (prop.type === 'string') return 'string'
    if (prop.type === 'array') {
      if (prop.items) return `${mapType(prop.items)}[]`
      return 'any[]'
    }
    if (prop.type === 'object') return 'Record<string, any>'
    return 'any'
  }

  let code = `// AUTO-GENERATED DATABASE TYPES FROM SUPABASE LIVE SCHEMA
// Version: 2.0.2194023.10599.01
// Generated at: ${new Date().toISOString()}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {\n`

  for (const tableName of tableNames) {
    const tableDef = defs[tableName]
    const props = tableDef.properties || {}
    const required = tableDef.required || []

    code += `      ${JSON.stringify(tableName)}: {\n`
    
    // Row
    code += `        Row: {\n`
    for (const [colName, prop] of Object.entries(props)) {
      const tsType = mapType(prop)
      const nullable = !required.includes(colName) ? ' | null' : ''
      code += `          ${JSON.stringify(colName)}: ${tsType}${nullable}\n`
    }
    code += `        }\n`

    // Insert
    code += `        Insert: {\n`
    for (const [colName, prop] of Object.entries(props)) {
      const tsType = mapType(prop)
      code += `          ${JSON.stringify(colName)}?: ${tsType} | null\n`
    }
    code += `        }\n`

    // Update
    code += `        Update: {\n`
    for (const [colName, prop] of Object.entries(props)) {
      const tsType = mapType(prop)
      code += `          ${JSON.stringify(colName)}?: ${tsType} | null\n`
    }
    code += `        }\n`

    code += `      }\n`
  }

  code += `    }\n    Views: Record<string, never>\n    Functions: Record<string, never>\n    Enums: Record<string, never>\n  }\n}\n`

  const targetPath = path.join(process.cwd(), 'lib', 'database.types.ts')
  fs.writeFileSync(targetPath, code, 'utf8')
  console.log(`Successfully generated ${targetPath} (${tableNames.length} tables).`)
}

generate().catch(err => {
  console.error('Generation error:', err)
  process.exit(1)
})
