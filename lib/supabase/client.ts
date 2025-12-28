import { createClient } from "@supabase/supabase-js";

// Support both env key names:
// - NEXT_PUBLIC_SUPABASE_ANON_KEY (classic)
// - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (newer dashboard naming)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase env is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
