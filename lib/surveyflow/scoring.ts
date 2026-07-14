import type { SurveyQuestion } from "./types"

export function scoreAnswer(question: SurveyQuestion, answer: unknown): number {
  if (!question.scores) return 0

  if (Array.isArray(answer)) {
    return answer.reduce((total, value) => total + (question.scores?.[String(value)] || 0), 0)
  }

  return question.scores[String(answer)] || 0
}

export function scoreSurveyResponse(questions: SurveyQuestion[], answers: Record<string, unknown>) {
  const scores: Record<string, number> = {}

  for (const question of questions) {
    scores[question.id] = scoreAnswer(question, answers[question.id])
  }

  return {
    scores,
    totalScore: Object.values(scores).reduce((total, score) => total + score, 0)
  }
}
