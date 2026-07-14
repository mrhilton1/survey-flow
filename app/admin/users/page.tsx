export default function AdminUsersPage() {
  return <AdminStub title="Users" description="Manage platform users, roles, and workspace memberships." />
}

function AdminStub({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-2 text-slate-600">{description}</p>
    </div>
  )
}
