import { appConfig } from "@/config/app.config"
import { resolveEntitlements } from "./entitlements"
import { getFeatureFlag } from "./feature-flags"
import { hasPermission } from "./permissions"
import type { AppSession, FeatureAccessDecision, FeatureAccessDefinition } from "./types"

export const featureAccessRegistry: FeatureAccessDefinition[] = [
  {
    key: "thank_you_builder",
    label: "Thank You Page Builder",
    entitlement: "thank_you_pages.custom_builder",
    flags: ["thank_you_builder_enabled", "thank_you_builder_runtime_enabled"],
    permissions: ["survey_thank_you_pages:manage"],
    fallback: "generic_thank_you_page",
    description: "Allows a workspace to create and render custom JSON-backed thank-you pages."
  },
  {
    key: "thank_you_page_logic",
    label: "Thank You Page Logic",
    entitlement: "thank_you_pages.conditional_logic",
    flags: ["thank_you_builder_enabled", "thank_you_logic_rules_enabled"],
    permissions: ["survey_thank_you_pages:manage_logic"],
    fallback: "generic_thank_you_page",
    description: "Allows multiple thank-you pages and conditional routing by score, answer, or preference data."
  }
]

export function getFeatureAccessDefinition(featureKey: string) {
  return featureAccessRegistry.find((definition) => definition.key === featureKey)
}

export async function canUseFeature(session: AppSession, featureKey: string): Promise<FeatureAccessDecision> {
  const definition = getFeatureAccessDefinition(featureKey)
  if (!definition) {
    throw new Error(`Unknown feature access key: ${featureKey}`)
  }

  if (session.isPlatformAdmin) {
    return {
      key: definition.key,
      allowed: true,
      reason: "allowed",
      entitlement: { key: definition.entitlement, enabled: true },
      flags: definition.flags.map((flag) => ({ key: flag, enabled: true })),
      permissions: definition.permissions.map((permission) => ({ key: permission, enabled: true })),
      fallback: definition.fallback
    }
  }

  if (!session.workspace) {
    return deniedDecision(definition, "no_workspace")
  }

  const [entitlements, flagValues] = await Promise.all([
    resolveEntitlements(session.workspace.id, session.workspace.planKey),
    Promise.all(definition.flags.map(async (flag) => ({ key: flag, enabled: await getFeatureFlag(flag, session.workspace!.id) })))
  ])

  const entitled = entitlements.features.find((feature) => feature.key === definition.entitlement)?.isEnabled ?? false
  const permissionValues = definition.permissions.map((permission) => ({
    key: permission,
    enabled: hasPermission(session.user?.role || "member", permission)
  }))
  const flagsEnabled = flagValues.every((flag) => flag.enabled)
  const permissionsEnabled = permissionValues.every((permission) => permission.enabled)

  return {
    key: definition.key,
    allowed: entitled && flagsEnabled && permissionsEnabled,
    reason: !entitled ? "missing_entitlement" : !flagsEnabled ? "flag_disabled" : !permissionsEnabled ? "missing_permission" : "allowed",
    entitlement: { key: definition.entitlement, enabled: entitled },
    flags: flagValues,
    permissions: permissionValues,
    fallback: definition.fallback
  }
}

export function getFeatureAccessMatrix() {
  const featureLabels = new Map(appConfig.features.map((feature) => [feature.key, feature.label]))

  return featureAccessRegistry.map((definition) => ({
    ...definition,
    entitlementLabel: featureLabels.get(definition.entitlement) || definition.entitlement
  }))
}

function deniedDecision(definition: FeatureAccessDefinition, reason: FeatureAccessDecision["reason"]): FeatureAccessDecision {
  return {
    key: definition.key,
    allowed: false,
    reason,
    entitlement: { key: definition.entitlement, enabled: false },
    flags: definition.flags.map((flag) => ({ key: flag, enabled: false })),
    permissions: definition.permissions.map((permission) => ({ key: permission, enabled: false })),
    fallback: definition.fallback
  }
}
