import { ApiDocsBrowser } from "@/components/platform/api-docs-browser"
import { listApiEndpoints } from "@/lib/platform/api-endpoints"

export default async function ApiDocsPage() {
  const endpoints = await listApiEndpoints({ documentedOnly: true })
  return <ApiDocsBrowser endpoints={endpoints} />
}
