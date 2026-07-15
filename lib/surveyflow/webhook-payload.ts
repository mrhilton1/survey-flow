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
    answers: buildFlatWebhookAnswers(input.questions, input.answers, input.settings),
    metadata: input.metadata
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
    const [first, second, third] = rankedList

    return {
      questionId: question.id,
      questionTitle: question.question,
      questionType: question.type,
      inferenceAlgorithmUsed: question.type === "this-or-that" ? shouldUseInferenceAlgorithm(question) : undefined,
      ...flattenTopPreference(1, first),
      ...flattenTopPreference(2, second),
      ...flattenTopPreference(3, third),
      rankedList
    }
  }

  return undefined
}

function buildFlatWebhookAnswers(
  questions: SurveyQuestion[],
  answers: Record<string, unknown>,
  settings: SurveySettings
) {
  const flat: Record<string, unknown> = {}
  const preferences = buildWebhookPreferences(questions, answers, settings)

  if (preferences) {
    Object.entries(preferences).forEach(([key, value]) => {
      if (key === "rankedList") return
      flat[toSnakeCase(key)] = value
    })

    preferences.rankedList.forEach((item) => {
      const prefix = `preference_rank_${item.rank}`
      writeFlatPreferenceItem(flat, prefix, item)
    })
  }

  questions.forEach((question, index) => {
    const questionNumber = index + 1
    const prefix = `question_${questionNumber}`
    const answer = getCleanQuestionAnswer(question, answers, settings)
    if (answer === undefined) return

    flat[`${prefix}_title`] = question.question
    flat[`${prefix}_type`] = question.type

    if (question.type === "this-or-that" && Array.isArray(answer)) {
      answer.forEach((item) => {
        const preferenceItem = item as SurveyWebhookPreferenceItem
        writeFlatPreferenceItem(flat, `${prefix}_rank_${preferenceItem.rank}`, preferenceItem)
      })
      flat[`${prefix}_answer`] = answer.map((item) => (item as SurveyWebhookPreferenceItem).ideaTitle).join(", ")
      return
    }

    if (question.type === "ranked-order" && Array.isArray(answer)) {
      answer.forEach((item, answerIndex) => {
        flat[`${prefix}_rank_${answerIndex + 1}`] = item
      })
      flat[`${prefix}_answer`] = answer.join(", ")
      return
    }

    if (question.type === "contact-info" && isRecord(answer)) {
      Object.entries(answer).forEach(([field, value]) => {
        flat[`${prefix}_${toSnakeCase(field)}`] = value
      })
      return
    }

    if (Array.isArray(answer)) {
      answer.forEach((item, answerIndex) => {
        flat[`${prefix}_answer_${answerIndex + 1}`] = item
      })
      flat[`${prefix}_answer`] = answer.join(", ")
      return
    }

    flat[`${prefix}_answer`] = answer
    if (question.type === "rating") {
      flat[`${prefix}_rating_value`] = answer
      flat[`${prefix}_rating_min`] = question.minRating || 1
      flat[`${prefix}_rating_max`] = question.maxRating || 5
    }
  })

  return flat
}

function flattenTopPreference(rank: 1 | 2 | 3, item?: SurveyWebhookPreferenceItem) {
  if (!item) return {}

  const prefix = `topPreference${rank}` as const
  return {
    [`${prefix}Rank`]: item.rank,
    [`${prefix}IdeaTitle`]: item.ideaTitle,
    [`${prefix}IdeaAlternateTitle`]: item.ideaAlternateTitle,
    [`${prefix}RedirectUrl`]: item.redirectUrl,
    [`${prefix}TipText`]: item.tipText,
    [`${prefix}WinPercentage`]: item.winPercentage
  }
}

function writeFlatPreferenceItem(flat: Record<string, unknown>, prefix: string, item: SurveyWebhookPreferenceItem) {
  flat[`${prefix}_rank`] = item.rank
  flat[`${prefix}_idea_title`] = item.ideaTitle
  flat[`${prefix}_idea_alternate_title`] = item.ideaAlternateTitle
  flat[`${prefix}_redirect_url`] = item.redirectUrl
  flat[`${prefix}_tip_text`] = item.tipText
  if (item.winPercentage !== undefined) flat[`${prefix}_win_percentage`] = item.winPercentage
  if (item.winRate !== undefined) flat[`${prefix}_win_rate`] = item.winRate
  if (item.wins !== undefined) flat[`${prefix}_wins`] = item.wins
  if (item.matches !== undefined) flat[`${prefix}_matches`] = item.matches
  if (item.inferredWins !== undefined) flat[`${prefix}_inferred_wins`] = item.inferredWins
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
      const value = stringOrNull(answers[`${question.id}_${field}`]) || stringOrNull(answers[`__contact_${field}`])
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

function toSnakeCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1_$2")
    .replace(/([0-9])([a-zA-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
