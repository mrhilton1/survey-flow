
export type QuestionType = 'multiple-choice' | 'text' | 'rating' | 'email' | 'contact-info' | 'ranked-order' | 'this-or-that';

export interface SurveyQuestion {
  id: string;
  type: QuestionType;
  question: string;
  description?: string;
  options?: string[]; // For multiple choice
  required: boolean;
  category?: string; // e.g., "AI Adoption", "People & Knowledge"
  placeholder?: string; // For text input
  minRating?: number; // For rating
  maxRating?: number; // For rating
  contactFields?: string[]; // For contact-info
  scores?: Record<string, number>; // For multiple choice: option -> score
  logic?: Record<string, string>; // For multiple choice: option -> nextQuestionId
  paramMapping?: string; // URL parameter name to auto-fill this question
  dynamicOptionsFromQuestionId?: string; // STUB: populate options from another question
  allowMultiple?: boolean; // For multiple choice: allow select more than one
  maxSelections?: number; // For multiple choice: max number of allowed selections
  allowOther?: boolean; // For multiple choice: allow write-in other option
  contactParamMappings?: Record<string, string>; // For contact-info field URL param mappings
  contactHideIfPrefilled?: Record<string, boolean>; // For contact-info: hide field if prefilled (default true)
  contactAlwaysHidden?: Record<string, boolean>; // For contact-info: granularly always hide field
  optionParamMappings?: Record<string, string>; // For multiple choice option URL param mappings
}

export interface SurveyStyle {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  fontFamily: string;
  logoUrl?: string;
  buttonText: string;
}

export interface Survey {
  id: string;
  name: string;
  description: string;
  seoDescription?: string;
  ownerId: string;
  questions: SurveyQuestion[];
  style: SurveyStyle;
  createdAt: number;
  updatedAt: number;
  responsesCount: number;
  viewsCount?: number;
  status: 'draft' | 'testing' | 'published';
  settings?: {
    urlParams?: string[];
    tracking?: {
      googleAnalyticsId?: string;
      facebookPixelId?: string;
      linkedinInsightId?: string;
      tiktokPixelId?: string;
      customScript?: string;
    };
    skipIntro?: boolean;
    preventMultiple?: boolean;
    useRanksmashFormula?: boolean;
    thankYouTitle?: string;
    thankYouMessage?: string;
    thankYouRankingsHeader?: string;
    thankYouRankingsSubtext?: string;
    thankYouShowSubmitAnother?: boolean;
    thankYouSubmitAnotherButtonText?: string;
    thankYouShowResults?: boolean;
    thankYouHighlightedQuestionId?: string;
    thankYouOptionLinks?: Record<string, { label: string; url: string }>;
    webhookUrl?: string;
  };
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  answers: Record<string, any>;
  scores?: Record<string, number>;
  totalScore?: number;
  submittedAt?: number;
  status: 'partial' | 'completed';
  isTest?: boolean;
  lastActiveAt: number;
  metadata: {
    browser: string;
    device: string;
    location?: string;
    urlParams?: Record<string, string>;
    [key: string]: any;
  };
}

export interface CRMConfig {
  provider: 'hubspot' | 'salesforce' | 'webhook';
  apiKey?: string;
  endpoint?: string;
}

export interface TelemetryEvent {
  id?: string;
  workspaceId: string;
  surveyId: string;
  questionId?: string;
  payload: {
    errorMessage?: string;
    errorStack?: string;
    answers?: Record<string, any>;
    scores?: Record<string, number>;
    currentStep?: number;
    browser?: string;
    device?: string;
    url?: string;
    [key: string]: any;
  };
  timestamp: number;
  type: 'error' | 'submit_attempt' | 'save_progress_error' | 'other';
}
