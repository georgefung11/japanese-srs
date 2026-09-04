import { createClient } from '@/utils/supabase/client'

export async function getStudiedCards() {
  const supabase = createClient()

  // Fetch only non-deleted items belonging to the currently authenticated user
  const { data, error } = await supabase
    .from('study_items')
    .select('id, type, japanese, reading, meaning, example_sentence, jlpt_level, is_custom')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching study cards:', error.message)
    return []
  }

  return data
}