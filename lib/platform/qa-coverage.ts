export interface PlatformQaTestCase {
  id: string
  label: string
  board: string
  description: string
  featureKeys: string[]
}

export interface FeatureQaCoverage {
  hasQa: boolean
  tests: PlatformQaTestCase[]
}

export const platformQaTestCases: PlatformQaTestCase[] = [
  {
    id: "team-api-contract",
    label: "Team API contract",
    board: "Platform Integration Board",
    description: "Confirms the workspace team endpoint returns members, invites, roles, seat counts, and permissions.",
    featureKeys: []
  },
  {
    id: "team-invalid-invite-guard",
    label: "Team invite validation",
    board: "Platform Integration Board",
    description: "Confirms malformed team invites are rejected before any invite record is created.",
    featureKeys: []
  },
  {
    id: "team-missing-member-scope-guard",
    label: "Team member scope guard",
    board: "Platform Integration Board",
    description: "Confirms role updates for unknown or out-of-workspace members are rejected without writing.",
    featureKeys: []
  },
  {
    id: "team-invite-create-delete",
    label: "Team invite create/delete",
    board: "Platform Integration Board",
    description: "Creates a QA invite and cancels it in the same run to verify the real invite workflow stays clean.",
    featureKeys: []
  },
  {
    id: "workspace-settings-validation-guard",
    label: "Workspace settings validation",
    board: "Platform Integration Board",
    description: "Confirms invalid workspace settings are rejected before writing.",
    featureKeys: ["custom_branding"]
  },
  {
    id: "platform-workspace-context-validation",
    label: "Workspace context validation",
    board: "Platform Integration Board",
    description: "Confirms platform workspace-context switching rejects missing workspace targets before setting cookies.",
    featureKeys: ["api_endpoint_registry"]
  },
  {
    id: "platform-admin-workspace-target-guard",
    label: "Admin workspace target guard",
    board: "Platform Integration Board",
    description: "Confirms platform admin workspace-scoped mutations reject unknown workspace targets before writing.",
    featureKeys: ["api_endpoint_registry"]
  },
  {
    id: "platform-scripts-crud-cleanup",
    label: "Scripts CRUD cleanup",
    board: "Platform Integration Board",
    description: "Creates and deletes a disabled platform script in the same run.",
    featureKeys: ["platform_scripts"]
  },
  {
    id: "api-registry-entitlement",
    label: "API registry entitlement",
    board: "Platform Integration Board",
    description: "Confirms the API Endpoint Registry capability exists in the platform feature registry.",
    featureKeys: ["api_access", "api_endpoint_registry"]
  },
  {
    id: "api-endpoint-admin-validation",
    label: "Endpoint admin validation",
    board: "Platform Integration Board",
    description: "Confirms the endpoint metadata admin route rejects incomplete updates.",
    featureKeys: ["api_endpoint_registry"]
  },
  {
    id: "openapi-public-visibility",
    label: "OpenAPI public visibility",
    board: "Platform Integration Board",
    description: "Confirms unauthenticated OpenAPI export exposes public endpoints only.",
    featureKeys: ["api_access"]
  }
]

const featureQaCoverageTests: PlatformQaTestCase[] = [
  ...platformQaTestCases,
  {
    id: "thank-you-router-board",
    label: "Thank-you router board",
    board: "Thank-You Router Board",
    description: "Confirms thank-you routing behavior using generated survey-specific QA cases.",
    featureKeys: ["thank_you_pages.conditional_logic"]
  }
]

export function getFeatureQaCoverage(featureKey: string): FeatureQaCoverage {
  const tests = featureQaCoverageTests.filter((test) => test.featureKeys.includes(featureKey))
  return {
    hasQa: tests.length > 0,
    tests
  }
}
