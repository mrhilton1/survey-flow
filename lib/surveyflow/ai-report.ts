import { GoogleGenAI } from "@google/genai"

export async function generateSurveyAiReport(input: {
  surveyName: string
  surveyDescription: string
  responses: Array<{ answers: Record<string, unknown>; totalScore?: number }>
}) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY")
  }

  const ai = new GoogleGenAI({ apiKey })
  const prompt = `
Analyze these survey responses for "${input.surveyName}".
Survey Description: ${input.surveyDescription}
Total Responses: ${input.responses.length}

Responses Data:
${JSON.stringify(input.responses)}

Generate a professional AI Roadmap report with:
1. Where You Are Today
2. What's at Stake
3. Your AI Roadmap: Top 3 Moves
4. Your First Move
`

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt
  })

  return response.text || ""
}
