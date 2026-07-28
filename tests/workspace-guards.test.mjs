import assert from "node:assert/strict"
import test from "node:test"
import {
  canKeepWorkspaceOwner,
  isTeamRoleInviteAllowed,
  isWorkspacePermissionAllowed,
  normalizeTeamEmail,
  normalizeWorkspaceSettings
} from "../lib/platform/workspace-guard-logic.ts"

test("workspace permission guards require authenticated user and workspace context", () => {
  assert.equal(isWorkspacePermissionAllowed({ authenticated: true, hasUser: true, hasWorkspace: true, isPlatformAdmin: false, hasPermission: false }), false)
  assert.equal(isWorkspacePermissionAllowed({ authenticated: true, hasUser: true, hasWorkspace: true, isPlatformAdmin: false, hasPermission: true }), true)
  assert.equal(isWorkspacePermissionAllowed({ authenticated: true, hasUser: true, hasWorkspace: true, isPlatformAdmin: true, hasPermission: false }), true)
  assert.equal(isWorkspacePermissionAllowed({ authenticated: true, hasUser: true, hasWorkspace: false, isPlatformAdmin: true, hasPermission: true }), false)
  assert.equal(isWorkspacePermissionAllowed({ authenticated: false, hasUser: true, hasWorkspace: true, isPlatformAdmin: true, hasPermission: true }), false)
})

test("team invite validation normalizes email and protects owner role changes", () => {
  assert.equal(normalizeTeamEmail(" Test@Example.COM "), "test@example.com")
  assert.equal(normalizeTeamEmail("not-an-email"), "")
  assert.equal(isTeamRoleInviteAllowed({ role: "member", validRole: true, canUpdateTeam: false }), true)
  assert.equal(isTeamRoleInviteAllowed({ role: "owner", validRole: true, canUpdateTeam: false }), false)
  assert.equal(isTeamRoleInviteAllowed({ role: "owner", validRole: true, canUpdateTeam: true }), true)
  assert.equal(isTeamRoleInviteAllowed({ role: "bogus", validRole: false, canUpdateTeam: true }), false)
})

test("owner safety guard keeps at least one workspace owner", () => {
  assert.deepEqual(canKeepWorkspaceOwner(1), { allowed: true })
  assert.deepEqual(canKeepWorkspaceOwner(0), { allowed: false, error: "A workspace must keep at least one owner." })
})

test("workspace settings validation normalizes safe persisted values", () => {
  assert.deepEqual(normalizeWorkspaceSettings({
    name: "  Acme Research  ",
    logoLabel: "ar",
    themeColor: "#F27D26",
    supportEmail: " Help@Example.COM "
  }), {
    name: "Acme Research",
    logoLabel: "AR",
    themeColor: "#F27D26",
    supportEmail: "help@example.com",
    changedFields: ["name", "logoLabel", "themeColor", "supportEmail"]
  })
  assert.match(normalizeWorkspaceSettings({ name: "x" }).error || "", /at least 2/)
  assert.match(normalizeWorkspaceSettings({ name: "Acme", logoLabel: "TOOLONG" }).error || "", /Logo label/)
  assert.match(normalizeWorkspaceSettings({ name: "Acme", themeColor: "orange" }).error || "", /hex/)
  assert.match(normalizeWorkspaceSettings({ name: "Acme", supportEmail: "bad" }).error || "", /valid email/)
})
