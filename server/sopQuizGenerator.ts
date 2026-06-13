import { storage } from "./storage";
import OpenAI from "openai";

export async function generateQuizForSop(sopId: string): Promise<boolean> {
  try {
    const sop = await storage.getSop(sopId);
    if (!sop) {
      console.error(`[Quiz-Auto] SOP not found: ${sopId}`);
      return false;
    }

    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
    });

    await storage.deleteSopQuizzesBySop(sop.id);

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `You are a training quiz generator for landscape installation and maintenance companies. Generate adaptive difficulty quiz questions based on Standard Operating Procedures (SOPs). Return valid JSON only.`
        },
        {
          role: "user",
          content: `Based on this SOP, generate an adaptive difficulty quiz for employee training.

SOP Title: ${sop.title}
SOP Type: ${sop.sopType || "standard"}
SOP Content:
${sop.content}

Generate a JSON object with this exact structure:
{
  "questions": [
    {
      "question": "text of question",
      "options": ["option A", "option B", "option C", "option D"],
      "correctIndex": 0,
      "explanation": "why this is the correct answer",
      "difficultyLevel": 1,
      "audienceRoles": ["Crew", "Crew Lead", "New Hire"]
    }
  ]
}

DIFFICULTY LEVELS (generate at least 2-3 questions per level):
- Level 1 (Foundational): Basic terminology, fundamental safety, step-by-step comprehension.
- Level 2 (Competent): Practical application, correct procedure ordering, identifying hazards.
- Level 3 (Proficient): Troubleshooting, efficiency improvements, handling variations.
- Level 4 (Advanced): Edge cases, optimization, quality standards, mentoring scenarios.
- Level 5 (Expert): Complex analysis, cross-system integration, policy creation, training design.

AUDIENCE ROLES - tag each question with applicable roles from: ["New Hire", "Crew", "Crew Lead", "Manager", "Admin", "HR", "Sales"]
- Level 1-2 questions: include all field roles ["New Hire", "Crew", "Crew Lead", "Manager"]
- Level 3 questions: ["Crew", "Crew Lead", "Manager"]
- Level 4-5 questions: ["Crew Lead", "Manager", "Admin"]

RULES:
- Generate 12-15 total questions spread across all 5 difficulty levels
- At least 2 questions per difficulty level
- Each question must have exactly 4 options
- correctIndex is 0-based (0=first option, 3=last option)
- Questions must directly relate to the SOP content
- Include practical, real-world scenarios relevant to landscaping
- Provide brief, helpful explanations for correct answers`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content || "{}";
    let quizData: any;
    try {
      quizData = JSON.parse(responseText);
    } catch {
      console.error(`[Quiz-Auto] Failed to parse AI quiz response for SOP: ${sop.title}`);
      return false;
    }

    const questions = quizData.questions || [];

    const quiz = await storage.createSopQuiz({
      sopId: sop.id,
      skillLevel: "adaptive",
      title: `${sop.title} - Adaptive Quiz`,
      description: "Adaptive difficulty quiz that adjusts to your skill level. Questions get harder as you answer correctly.",
      questionCount: questions.length,
    });

    const questionsToInsert = questions.map((q: any, index: number) => ({
      quizId: quiz.id,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      isStandard: false,
      explanation: q.explanation || null,
      sortOrder: index,
      difficultyLevel: Math.min(Math.max(q.difficultyLevel || 1, 1), 5),
      audienceRoles: q.audienceRoles || [],
    }));

    if (questionsToInsert.length > 0) {
      await storage.createQuizQuestionsBatch(questionsToInsert);
    }

    console.log(`[Quiz-Auto] Generated quiz for "${sop.title}" with ${questions.length} questions`);
    return true;
  } catch (err) {
    console.error(`[Quiz-Auto] Error generating quiz for SOP ${sopId}:`, err);
    return false;
  }
}
