import { computeThisOrThatRankings, shouldUseInferenceAlgorithm } from "./this-or-that"
import type {
  SurveyQuestion,
  SurveySettings,
  SurveyWebhookContact,
  SurveyWebhookPayload,
  SurveyWebhookQuestionResponse,
  SurveyWebhookPreferenceItem,
  SurveyWebhookPreferences
} from "./types"
import { isValidEmail, normalizeEmail, normalizePhoneToE164 } from "./contact-validation"

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
  totalScore?: number
  metadata: Record<string, unknown>
  submittedAt: string
}): SurveyWebhookPayload {
  return {
    event: input.event,
    test: input.isTest,
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
    responses: buildWebhookQuestionResponses(input.questions, input.answers, input.settings),
    metadata: input.metadata
  }
}

function buildWebhookContact(questions: SurveyQuestion[], answers: Record<string, unknown>): SurveyWebhookContact | undefined {
  const contact: SurveyWebhookContact = {}
  const source: NonNullable<SurveyWebhookContact["source"]> = {}

  CONTACT_FIELD_KEYS.forEach((field) => {
    const payloadKey = CONTACT_PAYLOAD_KEYS[field]
    const normalizedValue = normalizeContactFieldValue(field, answers[`__contact_${field}`])
    const questionValue = normalizeContactFieldValue(field, findQuestionContactValue(questions, answers, field))
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
    const [first, second, third] = rankedList

    return {
      questionId: question.id,
      questionTitle: question.question,
      questionType: question.type,
      inferenceAlgorithmUsed: question.type === "this-or-that" ? shouldUseInferenceAlgorithm(question) : undefined,
      topPreference1: first || null,
      topPreference2: second || null,
      topPreference3: third || null,
      top3: rankedList.slice(0, 3)
    }
  }

  return undefined
}

function buildWebhookQuestionResponses(
  questions: SurveyQuestion[],
  answers: Record<string, unknown>,
  settings: SurveySettings
): SurveyWebhookQuestionResponse[] {
  const responses: SurveyWebhookQuestionResponse[] = []

  questions.forEach((question, index) => {
    const answer = getCleanQuestionAnswer(question, answers, settings)
    if (answer === undefined) return

    responses.push({
      questionNumber: index + 1,
      questionTitle: question.question,
      questionType: question.type,
      answer
    })
  })

  return responses
}

function getCleanQuestionAnswer(
  question: SurveyQuestion,
  answers: Record<string, unknown>,
  settings: SurveySettings
) {
  if (question.type === "contact-info") {
    const contact: Record<string, string> = {}
    for (const field of question.contactFields || ["first_name", "email"]) {
      const value = normalizeContactFieldValue(field, answers[`${question.id}_${field}`]) || normalizeContactFieldValue(field, answers[`__contact_${field}`])
      if (value) contact[toCamelCase(field)] = value
    }
    return Object.keys(contact).length ? contact : undefined
  }

  if (question.type === "this-or-that") {
    const rankedList = buildRankedPreferenceList(question, answers[question.id], settings)
    return rankedList.length ? rankedList : undefined
  }

  if (question.type === "ranked-order") {
    const answer = answers[question.id]
    if (Array.isArray(answer)) return answer.map(String).filter(Boolean)
    return undefined
  }

  if (question.type === "multiple-choice") {
    const answer = answers[question.id]
    if (Array.isArray(answer)) return answer.map(String).filter(Boolean)
    return stringOrNull(answer) || undefined
  }

  if (question.type === "rating") {
    const value = answers[question.id]
    return typeof value === "number" ? value : stringOrNull(value) || undefined
  }

  if (question.type === "text" || question.type === "email") {
    return stringOrNull(answers[question.id]) || undefined
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

function toCamelCase(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function normalizeContactFieldValue(field: string, value: unknown) {
  if (field === "email") {
    return isValidEmail(value) ? normalizeEmail(value) : null
  }

  if (field === "phone") {
    return normalizePhoneToE164(value) || null
  }

  return stringOrNull(value)
}
