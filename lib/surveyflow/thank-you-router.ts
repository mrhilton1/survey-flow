import { scoreSurveyResponse } from "./scoring"
import { computeThisOrThatRankings } from "./this-or-that"
import type {
  SurveyQuestion,
  SurveySettings,
  ThankYouPage,
  ThankYouRouterCondition,
  ThankYouRouterRule
} from "./types"

const CONTACT_ANSWER_PREFIX = "__contact_"

export interface ThankYouRouterSurvey {
  questions: SurveyQuestion[] | null
  settings: SurveySettings | null
  thank_you_page?: ThankYouPage | null
  thank_you_pages?: ThankYouPage[] | null
}

export interface ThankYouRouterConditionResult {
  conditionId: string
  sourceType: ThankYouRouterCondition["sourceType"]
  questionId?: string
  field?: string
  operator: ThankYouRouterCondition["operator"]
  expected?: string
  actual: unknown
  matched: boolean
}

export interface ThankYouRouterRuleResult {
  ruleId: string
  label?: string
  enabled: boolean
  targetPageId?: string
  match: ThankYouRouterRule["match"]
  matched: boolean
  skippedReason?: string
  conditions: ThankYouRouterConditionResult[]
}

export interface ThankYouRouterEvaluationResult {
  selectedPage: ThankYouPage | null
  selectedPageId: string | null
  matchedRule: ThankYouRouterRule | null
  matchedRuleId: string | null
  matchedRuleLabel?: string
  mode: "matched" | "fallback" | "disabled" | "no_pages"
  fallbackPageId: string | null
  ruleResults: ThankYouRouterRuleResult[]
}

export function evaluateThankYouRouter(input: {
  survey: ThankYouRouterSurvey | null
  answers?: Record<string, unknown>
  urlParams?: Record<string, string>
}): ThankYouRouterEvaluationResult {
  const survey = input.survey
  const answers = input.answers || {}
  const urlParams = input.urlParams || {}

  if (!survey) {
    return emptyRouterResult("no_pages")
  }

  const settings = survey.settings || {}
  const pages = (survey.thank_you_pages || []).filter((page) => page.status !== "archived")
  const fallbackPageId = settings.thankYouRouter?.defaultPageId || settings.thankYouPageId || null
  const fallbackPage = pages.find((page) => page.id === fallbackPageId)
    || survey.thank_you_page
    || pages.find((page) => page.is_default)
    || pages[0]
    || null

  if (!fallbackPage && pages.length === 0) {
    return {
      ...emptyRouterResult("no_pages"),
      fallbackPageId
    }
  }

  const router = settings.thankYouRouter
  if (!router?.enabled || !router.rules?.length) {
    return {
      selectedPage: fallbackPage,
      selectedPageId: fallbackPage?.id || null,
      matchedRule: null,
      matchedRuleId: null,
      mode: "disabled",
      fallbackPageId: fallbackPage?.id || fallbackPageId,
      ruleResults: []
    }
  }

  const ruleResults: ThankYouRouterRuleResult[] = []

  for (const rule of router.rules) {
    if (rule.enabled === false) {
      ruleResults.push(toSkippedRuleResult(rule, "Rule is disabled."))
      continue
    }

    if (!rule.targetPageId) {
      ruleResults.push(toSkippedRuleResult(rule, "Rule does not target a thank-you page."))
      continue
    }

    if (!rule.conditions?.length) {
      ruleResults.push(toSkippedRuleResult(rule, "Rule has no conditions."))
      continue
    }

    const conditions = rule.conditions.map((condition) => evaluateThankYouCondition({
      survey,
      answers,
      urlParams,
      condition
    }))
    const matched = rule.match === "any" ? conditions.some((condition) => condition.matched) : conditions.every((condition) => condition.matched)
    const result: ThankYouRouterRuleResult = {
      ruleId: rule.id,
      label: rule.label,
      enabled: true,
      targetPageId: rule.targetPageId,
      match: rule.match,
      matched,
      conditions
    }
    ruleResults.push(result)

    if (matched) {
      const selectedPage = pages.find((page) => page.id === rule.targetPageId) || fallbackPage
      return {
        selectedPage,
        selectedPageId: selectedPage?.id || null,
        matchedRule: rule,
        matchedRuleId: rule.id,
        matchedRuleLabel: rule.label,
        mode: "matched",
        fallbackPageId: fallbackPage?.id || fallbackPageId,
        ruleResults
      }
    }
  }

  return {
    selectedPage: fallbackPage,
    selectedPageId: fallbackPage?.id || null,
    matchedRule: null,
    matchedRuleId: null,
    mode: "fallback",
    fallbackPageId: fallbackPage?.id || fallbackPageId,
    ruleResults
  }
}

function evaluateThankYouCondition(input: {
  survey: ThankYouRouterSurvey
  answers: Record<string, unknown>
  urlParams: Record<string, string>
  condition: ThankYouRouterCondition
}): ThankYouRouterConditionResult {
  const actual = getThankYouRouterValue(input)
  return {
    conditionId: input.condition.id,
    sourceType: input.condition.sourceType,
    questionId: input.condition.questionId,
    field: input.condition.field,
    operator: input.condition.operator,
    expected: input.condition.value,
    actual,
    matched: compareRouterValues(actual, input.condition.operator, input.condition.value)
  }
}

function getThankYouRouterValue(input: {
  survey: ThankYouRouterSurvey
  answers: Record<string, unknown>
  urlParams: Record<string, string>
  condition: ThankYouRouterCondition
}) {
  const questions = input.survey.questions || []
  const question = input.condition.questionId ? questions.find((candidate) => candidate.id === input.condition.questionId) : undefined

  if (input.condition.sourceType === "total_score") {
    return scoreSurveyResponse(questions, input.answers).totalScore || 0
  }

  if (input.condition.sourceType === "question_score" && input.condition.questionId) {
    return scoreSurveyResponse(questions, input.answers).scores[input.condition.questionId] || 0
  }

  if (input.condition.sourceType === "contact_field" && input.condition.field) {
    return input.answers[getContactAnswerKey(input.condition.field)] || ""
  }

  if (input.condition.sourceType === "url_param" && input.condition.field) {
    return input.urlParams[input.condition.field] || ""
  }

  if (input.condition.sourceType === "preference_top" && question) {
    const ranked = getRankedOptionsForAnswer(question, input.answers)
    const top = ranked[0]
    return typeof top === "string" ? top : top?.option || ""
  }

  if (input.condition.sourceType === "question_answer" && question) {
    const answer = input.answers[question.id]
    if (Array.isArray(answer)) {
      if (answer.every((item) => typeof item === "object" && item !== null && "selected" in item)) {
        return answer.map((item) => String((item as { selected?: string | null }).selected || "")).filter(Boolean)
      }
      return answer.map(String)
    }
    return answer ?? ""
  }

  return ""
}

function compareRouterValues(actual: unknown, operator: ThankYouRouterCondition["operator"], expected?: string) {
  const values = Array.isArray(actual) ? actual.map(String) : [String(actual ?? "")]
  const hasValue = values.some((value) => value.trim().length > 0)
  const expectedValue = String(expected ?? "")

  if (operator === "exists") return hasValue
  if (operator === "does_not_exist") return !hasValue

  const numericActual = Number(values[0])
  const numericExpected = Number(expectedValue)
  if (operator === "greater_than") return Number.isFinite(numericActual) && Number.isFinite(numericExpected) && numericActual > numericExpected
  if (operator === "less_than") return Number.isFinite(numericActual) && Number.isFinite(numericExpected) && numericActual < numericExpected

  const lowerExpected = expectedValue.toLowerCase()
  const hasExactMatch = values.some((value) => value.toLowerCase() === lowerExpected)
  const hasContainsMatch = values.some((value) => value.toLowerCase().includes(lowerExpected))

  if (operator === "equals") return hasExactMatch
  if (operator === "not_equals") return !hasExactMatch
  if (operator === "contains") return hasContainsMatch
  if (operator === "does_not_contain") return !hasContainsMatch

  return false
}

function getRankedOptionsForAnswer(question: SurveyQuestion, answers: Record<string, unknown>) {
  const answer = answers[question.id]

  if (question.type === "ranked-order") {
    return Array.isArray(answer) ? answer.map(String) : []
  }

  if (question.type === "this-or-that") {
    return computeThisOrThatRankings({
      question,
      answer,
      options: getActiveOptions(question, answers)
    })
  }

  if (question.type === "multiple-choice") {
    const selected = Array.isArray(answer) ? answer.map(String) : answer ? [String(answer)] : []
    const remaining = (question.options || []).filter((option) => !selected.includes(option))
    return [...selected, ...remaining]
  }

  return question.options || []
}

function getActiveOptions(question: SurveyQuestion, answers: Record<string, unknown>) {
  if (question.dynamicOptionsFromQuestionId) {
    const source = answers[question.dynamicOptionsFromQuestionId]
    if (Array.isArray(source)) return source.map(String)
    if (source) return [String(source)]
    return []
  }

  return question.options || []
}

function getContactAnswerKey(field: string) {
  return `${CONTACT_ANSWER_PREFIX}${field}`
}

function toSkippedRuleResult(rule: ThankYouRouterRule, skippedReason: string): ThankYouRouterRuleResult {
  return {
    ruleId: rule.id,
    label: rule.label,
    enabled: rule.enabled !== false,
    targetPageId: rule.targetPageId,
    match: rule.match,
    matched: false,
    skippedReason,
    conditions: []
  }
}

function emptyRouterResult(mode: ThankYouRouterEvaluationResult["mode"]): ThankYouRouterEvaluationResult {
  return {
    selectedPage: null,
    selectedPageId: null,
    matchedRule: null,
    matchedRuleId: null,
    mode,
    fallbackPageId: null,
    ruleResults: []
  }
}
