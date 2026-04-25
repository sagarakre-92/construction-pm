import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { getAnonKey, getServiceRoleKey, getSupabaseUrl } from "./env";

/**
 * Service-role client used to seed fixtures (organizations, members, projects,
 * tasks). RLS is bypassed by the service-role key, so DO NOT use this client
 * inside assertions — it would defeat the purpose of the suite.
 */
export function createServiceRoleClient(): SupabaseClient {
  return createSupabaseClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AuthenticatedClient = {
  client: SupabaseClient;
  userId: string;
  accessToken: string;
};

/**
 * Sign in with the anon key (mirrors how the browser/server clients are
 * built). The returned client carries the user's session in memory and will
 * attach `Authorization: Bearer <token>` to every PostgREST call, so RLS
 * decisions match what production code sees for that user.
 */
export async function createUserClient(
  email: string,
  password: string,
): Promise<AuthenticatedClient> {
  const client = createSupabaseClient(getSupabaseUrl(), getAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session?.access_token || !data.user?.id) {
    throw new Error(
      `Sign-in failed for ${email}: ${error?.message ?? "no session returned"}`,
    );
  }
  return {
    client,
    userId: data.user.id,
    accessToken: data.session.access_token,
  };
}
