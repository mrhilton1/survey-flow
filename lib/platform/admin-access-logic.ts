export interface WorkspaceScopedRow {
  workspace_id?: string | null
}

export function filterWorkspaceScopedRows<T extends WorkspaceScopedRow>(
  rows: T[],
  workspaceIds: Set<string>,
  options: { keepNullWorkspace?: boolean } = {}
): T[] {
  return rows.filter((row) => {
    if (!row.workspace_id) return Boolean(options.keepNullWorkspace)
    return workspaceIds.has(row.workspace_id)
  })
}

export function getAdminActionWorkspaceId(action: { action?: string; workspaceId?: string }): string | null {
  if (
    action.action === "setFlagWorkspaceOverride" ||
    action.action === "setWorkspacePlan" ||
    action.action === "upsertWorkspaceOverride"
  ) {
    return action.workspaceId || null
  }
  return null
}

