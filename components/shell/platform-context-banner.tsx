"use client"

import { useRouter } from "next/navigation"
import { Eye, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AppSession } from "@/lib/platform/types"

export function PlatformContextBanner({ session }: { session: AppSession }) {
  const router = useRouter()
  const context = session.platformWorkspaceContext
  if (!context) return null

  async function exitContext() {
    await fetch("/api/platform/admin/workspace-context", { method: "DELETE" })
    router.push("/admin/workspaces")
    router.refresh()
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
            <Eye className="h-4 w-4" />
          </span>
          <div>
            <p className="font-semibold">Platform workspace view: {context.workspaceName}</p>
            <p className="text-sm text-amber-800">
              Signed in as {session.user?.email}. Actions are scoped to this workspace and logged for audit.
            </p>
          </div>
        </div>
        <Button type="button" variant="secondary" className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100" onClick={exitContext}>
          <LogOut className="mr-2 h-4 w-4" />
          Exit workspace view
        </Button>
      </div>
    </div>
  )
}
