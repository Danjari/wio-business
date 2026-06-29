import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.SUPABASE_URL  as string
const anon = import.meta.env.SUPABASE_ANON_KEY as string

export const supabase = createClient(url, anon)
