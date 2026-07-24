import { getCloudflareContext } from "@opennextjs/cloudflare"

export function getRuntimeEnv(name: string) {
  const processValue = process.env[name]
  if (processValue) {
    return processValue
  }

  try {
    const value = (getCloudflareContext().env as Record<string, unknown>)[name]
    return typeof value === "string" ? value : undefined
  } catch {
    return undefined
  }
}
