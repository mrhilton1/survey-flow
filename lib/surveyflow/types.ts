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
  webhookUrl?: string
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
  test?: boolean
  surveyId: string
  surveyName: string
  responseId?: string
  answers: Record<string, unknown>
  scores?: Record<string, number>
  totalScore?: number
  metadata: Record<string, unknown>
  submittedAt: string
}
