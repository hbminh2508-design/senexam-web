import { redirect } from 'next/navigation'

export default async function OldPasswordRecoveryLink({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = new URLSearchParams()
  for (const key of ['code', 'email', 'error', 'error_code', 'error_description']) {
    if (typeof params[key] === 'string') query.set(key, params[key])
  }
  redirect('/new-change-password' + (query.size ? '?' + query.toString() : ''))
}
