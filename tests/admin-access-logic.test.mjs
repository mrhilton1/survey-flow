import assert from "node:assert/strict"
import test from "node:test"
import { filterWorkspaceScopedRows, getAdminActionWorkspaceId } from "../lib/platform/admin-access-logic.ts"

test("admin access filters shared workspace-scoped rows to current application workspaces", () => {
  const rows = [
    { id: "row_1", workspace_id: "workspace_a" },
    { id: "row_2", workspace_id: "workspace_b" },
    { id: "row_3", workspace_id: "workspace_other" },
    { id: "row_4", workspace_id: null }
  ]

  assert.deepEqual(
    filterWorkspaceScopedRows(rows, new Set(["workspace_a", "workspace_b"])).map((row) => row.id),
    ["row_1", "row_2"]
  )
  assert.deepEqual(
    filterWorkspaceScopedRows(rows, new Set(["workspace_a"]), { keepNullWorkspace: true }).map((row) => row.id),
    ["row_1", "row_4"]
  )
})

test("admin action workspace target detection covers workspace-specific mutations", () => {
  assert.equal(getAdminActionWorkspaceId({ action: "setWorkspacePlan", workspaceId: "workspace_1" }), "workspace_1")
  assert.equal(getAdminActionWorkspaceId({ action: "upsertWorkspaceOverride", workspaceId: "workspace_1" }), "workspace_1")
  assert.equal(getAdminActionWorkspaceId({ action: "setFlagWorkspaceOverride", workspaceId: "workspace_1" }), "workspace_1")
  assert.equal(getAdminActionWorkspaceId({ action: "setWorkspacePlan" }), null)
  assert.equal(getAdminActionWorkspaceId({ action: "upsertPlan" }), null)
})
