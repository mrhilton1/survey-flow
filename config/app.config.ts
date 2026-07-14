import {
  BarChart3,
  BookOpen,
  CreditCard,
  FileCode,
  Flag,
  LayoutDashboard,
  Settings,
  Shield,
  SlidersHorizontal,
  Users
} from "lucide-react"
import type { AppShellConfig } from "@/lib/platform/types"
import { runtimeConfig } from "./runtime.config"

export const appConfig = {
  product: {
    name: "App Shell",
    description: "Reusable SaaS application shell",
    logoLabel: "AS",
    themeColor: "#16806a",
    supportEmail: "support@example.com"
  },
  auth: {
    ...runtimeConfig
  },
  platformAdmins: [
    "owner@example.com"
  ],
  roles: {
    owner: {
      label: "Owner",
      inherits: ["admin"],
      permissions: ["workspace:*", "billing:*", "team:*"]
    },
    admin: {
      label: "Admin",
      inherits: ["member"],
      permissions: ["workspace:read", "workspace:update", "team:invite", "team:read"]
    },
    member: {
      label: "Member",
      inherits: [],
      permissions: ["workspace:read", "dashboard:read"]
    }
  },
  features: [
    { key: "api_access", label: "API Access", defaultEnabled: true, lockedBehavior: "show_locked" },
    { key: "advanced_reporting", label: "Advanced Reporting", defaultEnabled: false, lockedBehavior: "show_locked" },
    { key: "webhooks", label: "Webhooks", defaultEnabled: true, lockedBehavior: "show_locked" },
    { key: "custom_branding", label: "Custom Branding", defaultEnabled: true, lockedBehavior: "show_locked" }
  ],
  limits: [
    { key: "team_members", label: "Team Members", defaultValue: 5 },
    { key: "api_requests_monthly", label: "Monthly API Requests", defaultValue: 10000 },
    { key: "workspaces", label: "Workspaces", defaultValue: 1 }
  ],
  nav: {
    app: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:read" },
      { label: "Reports", href: "/dashboard/reports", icon: BarChart3, feature: "advanced_reporting" },
      { label: "Team", href: "/dashboard/team", icon: Users, permission: "team:read" },
      { label: "API Docs", href: "/api-docs", icon: FileCode, feature: "api_access" },
      { label: "Billing", href: "/dashboard/billing", icon: CreditCard, permission: "billing:*" },
      { label: "Settings", href: "/dashboard/settings", icon: Settings, permission: "workspace:update" }
    ],
    platformAdmin: [
      { label: "Overview", href: "/admin", icon: Shield },
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Entitlements", href: "/admin/entitlements", icon: SlidersHorizontal },
      { label: "Feature Flags", href: "/admin/flags", icon: Flag },
      { label: "Billing", href: "/admin/billing", icon: CreditCard },
      { label: "Docs", href: "/api-docs", icon: BookOpen }
    ]
  },
  modules: {
    pwa: true,
    pushNotifications: true,
    presence: false,
    apiKeys: true,
    webhooks: true,
    emailTemplates: true,
    integrations: true,
    impersonation: true,
    workspaceBranding: true
  }
} satisfies AppShellConfig
