"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  onClose
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-slate-950">{title}</h2>
        <div className="mt-2 text-sm leading-6 text-slate-600">{description}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
