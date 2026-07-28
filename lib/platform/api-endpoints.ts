import { appConfig } from "@/config/app.config"
import { createServerSupabaseClient } from "./supabase"

export type ApiEndpointVisibility = "public" | "internal" | "admin_only"
export type ApiEndpointDocStatus = "documented" | "undocumented" | "draft"

export interface ApiEndpoint {
  id: string
  route_key: string
  method: string
  path: string
  title: string
  summary: string | null
  category: string
  visibility: ApiEndpointVisibility
  doc_status: ApiEndpointDocStatus
  auth_type: string
  request_schema: Record<string, unknown>
  response_schema: Record<string, unknown>
  display_order: number
}

const selectFields = "id, route_key, method, path, title, summary, category, visibility, doc_status, auth_type, request_schema, response_schema, display_order"

export async function listApiEndpoints(input: { includeAdmin?: boolean; documentedOnly?: boolean; visibility?: ApiEndpointVisibility } = {}): Promise<ApiEndpoint[]> {
  const supabase = createServerSupabaseClient()
  let query = supabase
    .from("app_shell_api_endpoints")
    .select(selectFields)
    .eq("application_key", appConfig.product.applicationKey)
    .order("display_order", { ascending: true })
    .order("method", { ascending: true })

  if (!input.includeAdmin) query = query.neq("visibility", "admin_only")
  if (input.visibility) query = query.eq("visibility", input.visibility)
  if (input.documentedOnly) query = query.eq("doc_status", "documented")

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data || []) as ApiEndpoint[]
}

export function groupApiEndpoints(endpoints: ApiEndpoint[]) {
  const groups = new Map<string, ApiEndpoint[]>()
  for (const endpoint of endpoints) {
    const current = groups.get(endpoint.category) || []
    current.push(endpoint)
    groups.set(endpoint.category, current)
  }
  return Array.from(groups.entries()).map(([category, items]) => ({ category, items }))
}

export function buildOpenApiDocument(endpoints: ApiEndpoint[]) {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const endpoint of endpoints.filter((item) => item.doc_status === "documented")) {
    const path = endpoint.path.replaceAll("{", "{").replaceAll("}", "}")
    paths[path] ||= {}
    paths[path][endpoint.method.toLowerCase()] = {
      summary: endpoint.title,
      description: endpoint.summary || undefined,
      tags: [endpoint.category],
      "x-visibility": endpoint.visibility,
      "x-auth-type": endpoint.auth_type,
      responses: Object.keys(endpoint.response_schema || {}).length
        ? endpoint.response_schema
        : {
            "200": {
              description: "Successful response"
            }
          }
    }
  }

  return {
    openapi: "3.1.0",
    info: {
      title: `${appConfig.product.name} API`,
      version: "0.1.0"
    },
    paths
  }
}
