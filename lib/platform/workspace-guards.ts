import { appConfig } from "@/config/app.config"
import { hasPermission } from "@/lib/platform/permissions"
import type { AppSession, Permission } from "@/lib/platform/types"
import {
  canKeepWorkspaceOwner,
  isTeamRoleInviteAllowed,
  isValidTeamRole as isKnownTeamRole,
  isWorkspacePermissionAllowed,
  normalizeTeamEmail,
  normalizeWorkspaceSettings,
  type SettingsBody
} from "@/lib/platform/workspace-guard-logic"

export function canUseWorkspacePermission(session: AppSession, permission: Permission): boolean {
  return isWorkspacePermissionAllowed({
    authenticated: session.authenticated,
    hasUser: Boolean(session.user),
    hasWorkspace: Boolean(session.workspace),
    isPlatformAdmin: session.isPlatformAdmin,
    hasPermission: session.user ? hasPermission(session.user.role, permission) : false
  })
}

export function canReadTeam(session: AppSession): boolean {
  return canUseWorkspacePermission(session, "team:read")
}

export function canInviteTeam(session: AppSession): boolean {
  return canUseWorkspacePermission(session, "team:invite")
}

export function canUpdateTeam(session: AppSession): boolean {
  return canUseWorkspacePermission(session, "team:update")
}

export function canRemoveTeam(session: AppSession): boolean {
  return canUseWorkspacePermission(session, "team:remove")
}

export function canUpdateWorkspaceSettings(session: AppSession): boolean {
  return canUseWorkspacePermission(session, "workspace:update")
}

export function isValidTeamRole(role?: string): boolean {
  return isKnownTeamRole(role, Object.keys(appConfig.roles))
}

export function canInviteRole(session: AppSession, role?: string): boolean {
  return isTeamRoleInviteAllowed({
    role,
    validRole: isValidTeamRole(role),
    canUpdateTeam: canUpdateTeam(session)
  })
}

export { canKeepWorkspaceOwner, normalizeTeamEmail, normalizeWorkspaceSettings, type SettingsBody }
