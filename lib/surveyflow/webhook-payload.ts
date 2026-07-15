import { computeThisOrThatRankings, shouldUseInferenceAlgorithm } from "./this-or-that"
import type {
  SurveyQuestion,
  SurveySettings,
  SurveyWebhookContact,
  SurveyWebhookPayload,
  SurveyWebhookPreferenceItem,
  SurveyWebhookPreferences
} from "./types"

const CONTACT_FIELD_KEYS = ["first_name", "last_name", "email", "phone", "company"] as const

type ContactFieldKey = typeof CONTACT_FIELD_KEYS[number]

const CONTACT_PAYLOAD_KEYS: Record<ContactFieldKey, keyof Omit<SurveyWebhookContact, "source">> = {
  first_name: "firstName",
  last_name: "lastName",
  email: "email",
  phone: "phone",
  company: "company"
}

export function buildSurveyWebhookPayload(input: {
  event: SurveyWebhookPayload["event"]
  isTest: boolean
  surveyId: string
  surveyName: string
  responseId?: string
  questions: SurveyQuestion[]
  settings: SurveySettings
  answers: Record<string, unknown>
  scores?: Record<string, number>
  totalScore?: number
  metadata: Record<string, unknown>
  submittedAt: string
}): SurveyWebhookPayload {
  return {
    event: input.event,
    test: input.isTest,
    surveyId: input.surveyId,
    surveyName: input.surveyName,
    responseId: input.responseId,
    survey: {
      id: input.surveyId,
      name: input.surveyName
    },
    response: {
      id: input.responseId,
      submittedAt: input.submittedAt,
      totalScore: input.totalScore
    },
    contact: buildWebhookContact(input.questions, input.answers),
    preferences: buildWebhookPreferences(input.questions, input.answers, input.settings),
    answers: input.answers,
    scores: input.scores,
    totalScore: input.totalScore,
    metadata: input.metadata,
    submittedAt: input.submittedAt
  }
}

function buildWebhookContact(questions: SurveyQuestion[], answers: Record<string, unknown>): SurveyWebhookContact | undefined {
  const contact: SurveyWebhookContact = {}
  const source: NonNullable<SurveyWebhookContact["source"]> = {}

  CONTACT_FIELD_KEYS.forEach((field) => {
    const payloadKey = CONTACT_PAYLOAD_KEYS[field]
    const normalizedValue = stringOrNull(answers[`__contact_${field}`])
    const questionValue = findQuestionContactValue(questions, answers, field)
    const value = normalizedValue || questionValue

    if (!value) return

    contact[payloadKey] = value
    source[payloadKey] = answers[`__contact_prefilled_${field}`] === true ? "url_param" : "form"
  })

  if (!hasContactValue(contact)) return undefined
  if (Object.keys(source).length) contact.source = source
  return contact
}

function findQuestionContactValue(questions: SurveyQuestion[], answers: Record<string, unknown>, field: ContactFieldKey) {
  for (const question of questions) {
    if (question.type !== "contact-info") continue
    const value = stringOrNull(answers[`${question.id}_${field}`])
    if (value) return value
  }

  return null
}

function hasContactValue(contact: SurveyWebhookContact) {
  return Boolean(contact.firstName || contact.lastName || contact.email || contact.phone || contact.company)
}

function buildWebhookPreferences(
  questions: SurveyQuestion[],
  answers: Record<string, unknown>,
  settings: SurveySettings
): SurveyWebhookPreferences | undefined {
  for (const question of questions) {
    const rankedList = buildRankedPreferenceList(question, answers[question.id], settings)
    if (!rankedList.length) continue

    return {
      questionId: question.id,
      questionTitle: question.question,
      questionType: question.type,
      inferenceAlgorithmUsed: question.type === "this-or-that" ? shouldUseInferenceAlgorithm(question) : undefined,
      topPreference1: rankedList[0] || null,
      topPreference2: rankedList[1] || null,
      topPreference3: rankedList[2] || null,
      top3: rankedList.slice(0, 3),
      rankedList
    }
  }

  return undefined
}

function buildRankedPreferenceList(
  question: SurveyQuestion,
  answer: unknown,
  settings: SurveySettings
): SurveyWebhookPreferenceItem[] {
  if (question.type === "this-or-that") {
    return computeThisOrThatRankings({
      question,
      answer,
      options: question.options || []
    }).map((ranking) => ({
      ...buildPreferenceItem(question, ranking.option, ranking.rank, settings),
      winRate: roundDecimal(ranking.winPercentage),
      winPercentage: Math.round(ranking.winPercentage * 100),
      wins: ranking.totalWins,
      matches: Math.max(ranking.matches, ranking.totalWins),
      inferredWins: ranking.inferredWins
    }))
  }

  if (question.type === "ranked-order" && Array.isArray(answer)) {
    return answer
      .map((option) => String(option))
      .filter(Boolean)
      .map((option, index) => buildPreferenceItem(question, option, index + 1, settings))
  }

  return []
}

function buildPreferenceItem(
  question: SurveyQuestion,
  option: string,
  rank: number,
  settings: SurveySettings
): SurveyWebhookPreferenceItem {
  const metadata = question.optionMetadata?.[option]
  const legacyLink = settings.thankYouOptionLinks?.[`${question.id}_${option}`]

  return {
    rank,
    ideaTitle: option,
    ideaAlternateTitle: stringOrNull(metadata?.resultLabel) || null,
    redirectUrl: stringOrNull(metadata?.redirectUrl) || stringOrNull(legacyLink?.url) || null,
    tipText: stringOrNull(metadata?.redirectLabel) || stringOrNull(legacyLink?.label) || null
  }
}

function stringOrNull(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function roundDecimal(value: number) {
  return Math.round(value * 10000) / 10000
}
