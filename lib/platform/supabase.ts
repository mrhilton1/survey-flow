import { createClient } from "@supabase/supabase-js"
import { getRuntimeEnv } from "./env"

export function createServerSupabaseClient() {
  const url = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL")
  const key = getRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY")
  const schema = getRuntimeEnv("SUPABASE_SCHEMA") || "survey_flow"

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(url, key, {
    db: {
      schema
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

export function createBrowserSupabaseClient() {
  const url = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL")
  const key = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }

  return createClient(url, key)
}

export function createAuthSupabaseClient() {
  const url = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL")
  const key = getRuntimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}
