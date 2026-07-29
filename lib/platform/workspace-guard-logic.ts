export interface WorkspacePermissionInput {
  authenticated: boolean
  hasUser: boolean
  hasWorkspace: boolean
  isPlatformAdmin: boolean
  hasPermission: boolean
}

export interface SettingsBody {
  name?: string
  logoLabel?: string
  logoSrc?: string
  logoMarkSrc?: string
  themeColor?: string
  supportEmail?: string
}

export interface NormalizedWorkspaceSettings {
  name?: string
  logoLabel?: string | null
  logoSrc?: string | null
  logoMarkSrc?: string | null
  themeColor?: string | null
  supportEmail?: string | null
  changedFields?: string[]
  error?: string
}

export function isWorkspacePermissionAllowed(input: WorkspacePermissionInput): boolean {
  if (!input.authenticated || !input.hasUser || !input.hasWorkspace) return false
  return input.isPlatformAdmin || input.hasPermission
}

export function normalizeTeamEmail(value?: string): string {
  const email = value?.trim().toLowerCase() || ""
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

export function isValidTeamRole(role: string | undefined, roleKeys: string[]): boolean {
  return Boolean(role && roleKeys.includes(role))
}

export function isTeamRoleInviteAllowed(input: { role?: string; validRole: boolean; canUpdateTeam: boolean }): boolean {
  if (!input.validRole) return false
  return input.role !== "owner" || input.canUpdateTeam
}

export function canKeepWorkspaceOwner(otherOwnerCount: number): { allowed: boolean; error?: string } {
  return otherOwnerCount > 0
    ? { allowed: true }
    : { allowed: false, error: "A workspace must keep at least one owner." }
}

export function normalizeWorkspaceSettings(body: SettingsBody | null): NormalizedWorkspaceSettings {
  const name = body?.name?.trim() || ""
  const logoLabel = body?.logoLabel?.trim().toUpperCase() || ""
  const logoSrc = body?.logoSrc?.trim() || ""
  const logoMarkSrc = body?.logoMarkSrc?.trim() || ""
  const themeColor = body?.themeColor?.trim() || ""
  const supportEmail = body?.supportEmail?.trim().toLowerCase() || ""

  if (name.length < 2) return { error: "Workspace name must be at least 2 characters." }
  if (name.length > 80) return { error: "Workspace name must be 80 characters or fewer." }
  if (logoLabel && !/^[A-Z0-9]{1,4}$/.test(logoLabel)) return { error: "Logo label must be 1 to 4 letters or numbers." }
  if (logoSrc && !isSafeBrandAssetUrl(logoSrc)) return { error: "Logo URL must be an HTTPS URL or an app asset path starting with /." }
  if (logoMarkSrc && !isSafeBrandAssetUrl(logoMarkSrc)) return { error: "Logo mark URL must be an HTTPS URL or an app asset path starting with /." }
  if (themeColor && !/^#[0-9a-fA-F]{6}$/.test(themeColor)) return { error: "Theme color must be a hex value like #071B3A." }
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) return { error: "Support email must be a valid email address." }

  return {
    name,
    logoLabel: logoLabel || null,
    logoSrc: logoSrc || null,
    logoMarkSrc: logoMarkSrc || null,
    themeColor: themeColor || null,
    supportEmail: supportEmail || null,
    changedFields: ["name", "logoLabel", "logoSrc", "logoMarkSrc", "themeColor", "supportEmail"]
  }
}

function isSafeBrandAssetUrl(value: string) {
  if (value.startsWith("/")) return !value.startsWith("//") && !value.includes("\\")
  return /^https:\/\/[^\s]+$/i.test(value)
}
