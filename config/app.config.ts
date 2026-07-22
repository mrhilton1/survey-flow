import {
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  CreditCard,
  FileCode,
  Flag,
  Layers3,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  Sparkles,
  Settings,
  Shield,
  SlidersHorizontal,
  Users
} from "lucide-react"
import type { AppShellConfig } from "@/lib/platform/types"
import { runtimeConfig } from "./runtime.config"

export const appConfig = {
  product: {
    applicationKey: "survey-flow",
    name: "SurveyFlow AI",
    description: "AI-driven survey creation, public survey taking, response analytics, and generated reports.",
    logoLabel: "SF",
    themeColor: "#f27d26",
    supportEmail: "support@surveyflow.ai"
  },
  auth: {
    ...runtimeConfig
  },
  platformAdmins: [
    "mike@smartgrowth.consulting"
  ],
  roles: {
    owner: {
      label: "Owner",
      inherits: ["admin"],
      permissions: ["workspace:*", "billing:*", "team:*", "surveys:*", "responses:*", "reports:*", "telemetry:*", "survey_thank_you_pages:*"]
    },
    admin: {
      label: "Admin",
      inherits: ["member"],
      permissions: ["workspace:read", "workspace:update", "team:invite", "team:read", "surveys:*", "responses:*", "reports:generate", "telemetry:read", "survey_thank_you_pages:manage"]
    },
    member: {
      label: "Member",
      inherits: [],
      permissions: ["workspace:read", "dashboard:read", "surveys:read", "responses:read"]
    }
  },
  features: [
    { key: "api_access", label: "API Access", defaultEnabled: true, lockedBehavior: "show_locked" },
    { key: "survey_builder", label: "Survey Builder", defaultEnabled: true, lockedBehavior: "show_locked" },
    { key: "survey_publishing", label: "Survey Publishing", defaultEnabled: true, lockedBehavior: "show_locked" },
    { key: "ai_reports", label: "AI Reports", defaultEnabled: false, lockedBehavior: "show_locked" },
    { key: "advanced_analytics", label: "Advanced Analytics", defaultEnabled: false, lockedBehavior: "show_locked" },
    { key: "webhook_delivery", label: "Webhook Delivery", defaultEnabled: true, lockedBehavior: "show_locked" },
    { key: "custom_tracking", label: "Custom Tracking", defaultEnabled: false, lockedBehavior: "show_locked" },
    { key: "webhooks", label: "Webhooks", defaultEnabled: true, lockedBehavior: "show_locked" },
    { key: "custom_branding", label: "Custom Branding", defaultEnabled: true, lockedBehavior: "show_locked" },
    {
      key: "thank_you_pages.custom_builder",
      label: "Outcome Builder",
      defaultEnabled: false,
      lockedBehavior: "show_locked",
      associatedFlags: ["thank_you_builder_enabled", "thank_you_builder_runtime_enabled"],
      requiredPermissions: ["survey_thank_you_pages:manage"]
    },
    {
      key: "thank_you_pages.conditional_logic",
      label: "Outcome Routing",
      defaultEnabled: false,
      lockedBehavior: "show_locked",
      associatedFlags: ["thank_you_builder_enabled", "thank_you_logic_rules_enabled"],
      requiredPermissions: ["survey_thank_you_pages:manage_logic"]
    }
  ],
  limits: [
    { key: "team_members", label: "Team Members", defaultValue: 5 },
    { key: "api_requests_monthly", label: "Monthly API Requests", defaultValue: 10000 },
    { key: "workspaces", label: "Workspaces", defaultValue: 1 },
    { key: "surveys", label: "Surveys", defaultValue: 10 },
    { key: "responses_monthly", label: "Monthly Survey Responses", defaultValue: 1000 },
    { key: "ai_reports_monthly", label: "Monthly AI Reports", defaultValue: 25 },
    { key: "webhook_deliveries_monthly", label: "Monthly Webhook Deliveries", defaultValue: 1000 }
  ],
  nav: {
    app: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:read" },
      { label: "Surveys", href: "/dashboard/surveys", icon: ListChecks, permission: "surveys:read", feature: "survey_builder" },
      { label: "Responses", href: "/dashboard/responses", icon: MessageSquareText, permission: "responses:read", feature: "advanced_analytics" },
      { label: "AI Reports", href: "/dashboard/ai-reports", icon: Sparkles, permission: "reports:generate", feature: "ai_reports" },
      { label: "Reports", href: "/dashboard/reports", icon: BarChart3, feature: "advanced_analytics" },
      { label: "Team", href: "/dashboard/team", icon: Users, permission: "team:read" },
      { label: "API Docs", href: "/dashboard/api-docs", icon: FileCode, feature: "api_access" },
      { label: "Billing", href: "/dashboard/billing", icon: CreditCard, permission: "billing:*" },
      { label: "Settings", href: "/dashboard/settings", icon: Settings, permission: "workspace:update" }
    ],
    platformAdmin: [
      { label: "Overview", href: "/admin", icon: Shield },
      { label: "Workspaces", href: "/admin/workspaces", icon: Building2 },
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Plans", href: "/admin/plans", icon: Layers3 },
      { label: "Entitlements", href: "/admin/entitlements", icon: SlidersHorizontal },
      { label: "Feature Flags", href: "/admin/flags", icon: Flag },
      { label: "Permissions", href: "/admin/permissions", icon: Shield },
      { label: "Billing", href: "/admin/billing", icon: CreditCard },
      { label: "QA Console", href: "/admin/qa", icon: ClipboardCheck },
      { label: "Docs", href: "/dashboard/api-docs", icon: BookOpen }
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
