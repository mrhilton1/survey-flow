import { appConfig } from "@/config/app.config"
import type { Permission, RoleKey } from "./types"

export function getRolePermissions(role: RoleKey, seen = new Set<RoleKey>()): Set<Permission> {
  if (seen.has(role)) return new Set()
  seen.add(role)

  const roles = appConfig.roles as Record<RoleKey, { inherits: RoleKey[]; permissions: Permission[] }>
  const definition = roles[role]
  if (!definition) return new Set()

  const permissions = new Set<Permission>(definition.permissions)
  for (const inheritedRole of definition.inherits) {
    for (const permission of getRolePermissions(inheritedRole, seen)) {
      permissions.add(permission)
    }
  }

  return permissions
}

export function hasPermission(role: RoleKey, requested?: Permission): boolean {
  if (!requested) return true

  const permissions = getRolePermissions(role)
  if (permissions.has(requested)) return true

  const [scope] = requested.split(":")
  return permissions.has(`${scope}:*` as Permission)
}

export function isPlatformAdminEmail(email?: string | null): boolean {
  if (!email) return false
  return appConfig.platformAdmins.map((admin) => admin.toLowerCase()).includes(email.toLowerCase())
}
