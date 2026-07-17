export type QuestionType =
  | "multiple-choice"
  | "text"
  | "rating"
  | "email"
  | "contact-info"
  | "ranked-order"
  | "this-or-that"

export type SurveyStatus = "draft" | "testing" | "published"
export type ResponseStatus = "partial" | "completed"
export type TelemetryType = "error" | "submit_attempt" | "save_progress_error" | "other"

export interface SurveyQuestion {
  id: string
  type: QuestionType
  question: string
  description?: string
  options?: string[]
  optionMetadata?: Record<string, {
    resultLabel?: string
    redirectUrl?: string
    redirectLabel?: string
  }>
  required: boolean
  category?: string
  placeholder?: string
  minRating?: number
  maxRating?: number
  contactFields?: string[]
  scores?: Record<string, number>
  logic?: Record<string, string>
  paramMapping?: string
  textInputMode?: "short" | "long"
  dynamicOptionsFromQuestionId?: string
  allowMultiple?: boolean
  maxSelections?: number
  allowOther?: boolean
  contactParamMappings?: Record<string, string>
  contactHideIfPrefilled?: Record<string, boolean>
  contactAlwaysHidden?: Record<string, boolean>
  contactHiddenCapture?: boolean
  optionParamMappings?: Record<string, string>
  useInferenceAlgorithm?: boolean
}

export interface SurveyStyle {
  backgroundColor: string
  textColor: string
  accentColor: string
  fontFamily: string
  logoUrl?: string
  buttonText: string
}

export interface SurveySettings {
  urlParams?: string[]
  tracking?: {
    googleAnalyticsId?: string
    facebookPixelId?: string
    linkedinInsightId?: string
    tiktokPixelId?: string
    customScript?: string
  }
  skipIntro?: boolean
  preventMultiple?: boolean
  thankYouTitle?: string
  thankYouMessage?: string
  thankYouRankingsHeader?: string
  thankYouRankingsSubtext?: string
  thankYouShowSubmitAnother?: boolean
  thankYouSubmitAnotherButtonText?: string
  thankYouShowResults?: boolean
  thankYouHighlightedQuestionId?: string
  thankYouOptionLinks?: Record<string, { label: string; url: string }>
  thankYouPageId?: string
  webhookUrl?: string
}

export type ThankYouPageBlockType =
  | "preference-results"
  | "top-preference"
  | "answer-summary"
  | "contact-fields"
  | "raw-metadata"

export interface ThankYouPageBlock {
  id: string
  type: ThankYouPageBlockType
  label?: string
  questionId?: string
  visible?: boolean
}

export interface ThankYouPageContent {
  title?: string
  message?: string
  ctaLabel?: string
  ctaUrl?: string
  showSubmitAnother?: boolean
  showResults?: boolean
  rankingsHeader?: string
  rankingsSubtext?: string
  highlightedQuestionId?: string
  blocks?: ThankYouPageBlock[]
}

export interface ThankYouPage {
  id: string
  workspace_id: string
  survey_id: string
  name: string
  status: "draft" | "active" | "archived"
  is_default: boolean
  content: ThankYouPageContent
  created_at: string
  updated_at: string
}

export interface Survey {
  id: string
  workspaceId: string
  ownerUserId: string
  name: string
  description: string
  seoDescription?: string
  questions: SurveyQuestion[]
  style: SurveyStyle
  createdAt: string
  updatedAt: string
  responsesCount: number
  viewsCount: number
  status: SurveyStatus
  settings: SurveySettings
}

export interface SurveyResponse {
  id: string
  workspaceId: string
  surveyId: string
  answers: Record<string, unknown>
  scores?: Record<string, number>
  totalScore?: number
  submittedAt?: string
  status: ResponseStatus
  isTest: boolean
  lastActiveAt: string
  metadata: {
    browser: string
    device: string
    location?: string
    urlParams?: Record<string, string>
    timeToComplete?: number
    [key: string]: unknown
  }
}

export interface TelemetryEvent {
  id: string
  workspaceId: string
  surveyId: string
  questionId?: string
  payload: {
    errorMessage?: string
    errorStack?: string
    answers?: Record<string, unknown>
    scores?: Record<string, number>
    currentStep?: number
    browser?: string
    device?: string
    url?: string
    [key: string]: unknown
  }
  timestamp: string
  type: TelemetryType
}

export interface SurveyWebhookPayload {
  event: "survey.test" | "survey.response.completed"
  test: boolean
  survey: {
    id: string
    name: string
  }
  response: {
    id?: string
    submittedAt: string
    totalScore?: number
  }
  contact?: SurveyWebhookContact
  preferences?: SurveyWebhookPreferences
  responses?: SurveyWebhookQuestionResponse[]
  metadata: Record<string, unknown>
}

export interface SurveyWebhookQuestionResponse {
  questionNumber: number
  questionTitle: string
  questionType: QuestionType
  answer: unknown
}

export interface SurveyWebhookContact {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  source?: Partial<Record<"firstName" | "lastName" | "email" | "phone" | "company", "form" | "url_param">>
}

export interface SurveyWebhookPreferenceItem {
  rank: number
  ideaTitle: string
  ideaAlternateTitle: string | null
  redirectUrl: string | null
  tipText: string | null
  winRate?: number
  winPercentage?: number
  wins?: number
  matches?: number
  inferredWins?: number
}

export interface SurveyWebhookPreferences {
  questionId: string
  questionTitle: string
  questionType: QuestionType
  inferenceAlgorithmUsed?: boolean
  topPreference1: SurveyWebhookPreferenceItem | null
  topPreference2: SurveyWebhookPreferenceItem | null
  topPreference3: SurveyWebhookPreferenceItem | null
  top3: SurveyWebhookPreferenceItem[]
}
