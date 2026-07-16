import { AccessAdminConsole } from "@/components/platform/access-admin-console"

export default async function AdminPlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AccessAdminConsole mode="plan-detail" planId={id} />
}
