import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupaAdmin(): any {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return _client;
}

// Convenience alias used by all route handlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supaAdmin: any = new Proxy({} as any, {
  get(_target, prop) {
    return getSupaAdmin()[prop];
  },
});