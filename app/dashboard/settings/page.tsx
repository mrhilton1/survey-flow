import { appConfig } from "@/config/app.config"

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold text-slate-950">Settings</h1>
      <div className="mt-6 rounded-md border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Template modules</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(appConfig.modules).map(([module, enabled]) => (
            <div key={module} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
              <dt>{module}</dt>
              <dd className={enabled ? "text-brand-700" : "text-slate-400"}>{enabled ? "enabled" : "disabled"}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
