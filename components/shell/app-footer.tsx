import { appConfig } from "@/config/app.config"

export function AppFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-5 text-sm text-slate-500 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>{appConfig.product.name}</span>
        <a className="hover:text-slate-900" href={`mailto:${appConfig.product.supportEmail}`}>
          {appConfig.product.supportEmail}
        </a>
      </div>
    </footer>
  )
}
