import type { LucideIcon } from "lucide-react"

export type RoleKey = string
export type Permission = `${string}:${string}` | `${string}:*`
export type LockedBehavior = "show_locked" | "hide"

export interface RoleDefinition {
  label: string
  inherits: RoleKey[]
  permissions: Permission[]
}

export interface FeatureDefinition {
  key: string
  label: string
  defaultEnabled: boolean
  lockedBehavior: LockedBehavior
  associatedFlags?: string[]
  requiredPermissions?: Permission[]
}

export interface LimitDefinition {
  key: string
  label: string
  defaultValue: number | "unlimited"
}

export interface NavItemDefinition {
  label: string
  href: string
  icon: LucideIcon
  permission?: Permission
  feature?: string
}

export interface AppShellConfig {
  product: {
    applicationKey: string
    name: string
    description: string
    logoLabel: string
    themeColor: string
    supportEmail: string
  }
  auth: {
    sessionCookieName: string
    loginPath: string
    afterLoginPath: string
    publicPaths: string[]
  }
  platformAdmins: string[]
  roles: Record<RoleKey, RoleDefinition>
  features: FeatureDefinition[]
  limits: LimitDefinition[]
  nav: {
    app: NavItemDefinition[]
    platformAdmin: NavItemDefinition[]
  }
  modules: {
    pwa: boolean
    pushNotifications: boolean
    presence: boolean
    apiKeys: boolean
    webhooks: boolean
    emailTemplates: boolean
    integrations: boolean
    impersonation: boolean
    workspaceBranding: boolean
  }
}

export interface SessionUser {
  id: string
  email: string
  name?: string | null
  role: RoleKey
}

export interface Workspace {
  id: string
  name: string
  slug: string
  planKey: string
  logoLabel: string | null
  themeColor: string | null
  supportEmail: string | null
}

export interface PlatformWorkspaceContext {
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  planKey: string
  originalWorkspaceId: string | null
  originalWorkspaceName: string | null
}

export interface AppSession {
  authenticated: boolean
  user: SessionUser | null
  workspace: Workspace | null
  isPlatformAdmin: boolean
  isImpersonating: boolean
  platformWorkspaceContext: PlatformWorkspaceContext | null
}

export interface ResolvedFeature {
  key: string
  label: string
  isEnabled: boolean
  lockedBehavior: LockedBehavior
}

export interface ResolvedLimit {
  key: string
  label: string
  value: number | "unlimited"
  used: number
}

export interface EntitlementSnapshot {
  features: ResolvedFeature[]
  limits: ResolvedLimit[]
  planKey: string
}

export type FeatureAccessReason = "allowed" | "missing_entitlement" | "flag_disabled" | "missing_permission" | "no_workspace"

export interface FeatureAccessDefinition {
  key: string
  label: string
  entitlement: string
  flags: string[]
  permissions: Permission[]
  fallback: string
  description: string
}

export interface FeatureAccessDecision {
  key: string
  allowed: boolean
  reason: FeatureAccessReason
  entitlement: {
    key: string
    enabled: boolean
  }
  flags: Array<{
    key: string
    enabled: boolean
  }>
  permissions: Array<{
    key: Permission
    enabled: boolean
  }>
  fallback: string
}
