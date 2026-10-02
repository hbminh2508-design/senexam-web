import { supabase } from '@/lib/supabaseClient'

export const ensureStudentProfile = async (userId: string) => {
  if (!userId) return
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.warn('ensureStudentProfile query warning:', profileError)
      return
    }

    if (!profile) {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({ id: userId, role: 'student' })

      if (insertError && insertError.code !== '23505') {
        console.warn('ensureStudentProfile insert warning:', insertError)
      }
    }
  } catch (err) {
    console.warn('ensureStudentProfile error:', err)
  }
}
