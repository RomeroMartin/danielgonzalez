// Cliente único de Supabase. Solo lleva claves PÚBLICAS (publishable + site key de Turnstile).
// Nunca poner acá la service_role ni la secret key de Turnstile.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

export const SUPABASE_URL = "https://clrylwrxqldqjxrvipdb.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_kf0ntcnppwZb5H50y134ug_WwFA9bz3";
export const TURNSTILE_SITE_KEY = "0x4AAAAAAFgzhMb_5qXEKatw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
