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
}

export interface AppSession {
  authenticated: boolean
  user: SessionUser | null
  workspace: Workspace | null
  isPlatformAdmin: boolean
  isImpersonating: boolean
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
