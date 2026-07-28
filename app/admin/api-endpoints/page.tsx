import { ApiEndpointsAdminConsole } from "@/components/platform/api-endpoints-admin-console"
import { listApiEndpoints } from "@/lib/platform/api-endpoints"

export default async function AdminApiEndpointsPage() {
  const endpoints = await listApiEndpoints({ includeAdmin: true })
  return <ApiEndpointsAdminConsole initialEndpoints={endpoints} />
}
