import { appConfig } from "@/config/app.config"
import { hasPermission } from "./permissions"
import type { NavItemDefinition, RoleKey } from "./types"

export interface ResolvedNavItem extends NavItemDefinition {
  locked: boolean
}

export function resolveNavItems(input: {
  role: RoleKey
  enabledFeatures: Record<string, boolean>
  isPlatformAdmin: boolean
}): {
  app: ResolvedNavItem[]
  platformAdmin: ResolvedNavItem[]
} {
  const app = appConfig.nav.app
    .filter((item) => hasPermission(input.role, item.permission))
    .map((item) => ({
      ...item,
      locked: item.feature ? !input.enabledFeatures[item.feature] : false
    }))

  const platformAdmin = input.isPlatformAdmin
    ? appConfig.nav.platformAdmin.map((item) => ({ ...item, locked: false }))
    : []

  return { app, platformAdmin }
}
