import { supabase } from '@/lib/supabaseClient'

export const ensureStudentProfile = async (userId: string) => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    throw profileError
  }

  if (!profile) {
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: userId, role: 'student' })

    if (insertError && insertError.code !== '23505') {
      throw insertError
    }
  }
}
