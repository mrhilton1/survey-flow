import type { SurveyQuestion, SurveySettings, SurveyStyle } from "./types"

export const DEFAULT_SURVEY_STYLE: SurveyStyle = {
  backgroundColor: "#000000",
  textColor: "#ffffff",
  accentColor: "#f27d26",
  fontFamily: "Inter",
  buttonText: "Next"
}

export const DEFAULT_SURVEY_SETTINGS: SurveySettings = {
  urlParams: ["utm_source", "utm_medium", "utm_campaign"],
  tracking: {},
  skipIntro: false,
  preventMultiple: false,
  thankYouTitle: "Thank You!",
  thankYouMessage: "Your response has been recorded. We appreciate your feedback.",
  thankYouRankingsHeader: "Your Preference Rankings",
  thankYouRankingsSubtext: "Tap or click any item with a link icon to learn how to solve this problem in your business today!",
  thankYouShowSubmitAnother: true,
  thankYouSubmitAnotherButtonText: "Submit another response",
  thankYouShowResults: false
}

export const SAMPLE_QUESTIONS: SurveyQuestion[] = [
  {
    id: "q1",
    type: "multiple-choice",
    question: "How is your team using AI tools today?",
    category: "AI ADOPTION",
    options: [
      "Not at all - we have not started with AI yet",
      "A few people experimenting on their own",
      "Several team members use AI regularly, but everyone is doing their own thing",
      "AI tools are part of how we work with shared practices and clear use cases"
    ],
    required: true
  },
  {
    id: "q2",
    type: "multiple-choice",
    question: "Do you know where AI would make the biggest difference in your business?",
    category: "AI ADOPTION",
    options: [
      "No - I know AI matters but I do not know where to start",
      "I have some ideas, but nothing concrete or prioritized",
      "I have identified a few areas, but have not gone deep on any of them",
      "Yes - I have a clear picture of where AI creates leverage in my operation"
    ],
    required: true
  }
]

export function createDefaultSurvey(input: {
  workspaceId: string
  ownerUserId: string
  name?: string
}) {
  const now = new Date().toISOString()

  return {
    workspaceId: input.workspaceId,
    ownerUserId: input.ownerUserId,
    name: input.name || "Untitled Survey",
    description: "A new survey description",
    seoDescription: "A professional survey created with SurveyFlow AI.",
    questions: [],
    style: DEFAULT_SURVEY_STYLE,
    status: "draft" as const,
    createdAt: now,
    updatedAt: now,
    responsesCount: 0,
    viewsCount: 0,
    settings: DEFAULT_SURVEY_SETTINGS
  }
}
