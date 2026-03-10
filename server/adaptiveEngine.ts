import { pool } from "./db";

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Foundational",
  2: "Competent",
  3: "Proficient",
  4: "Advanced",
  5: "Expert",
};

export function getDifficultyLabel(level: number): string {
  return DIFFICULTY_LABELS[Math.min(Math.max(level, 1), 5)] || "Foundational";
}

export function calculateScoreLabel(highestLevel: number): string {
  return getDifficultyLabel(highestLevel);
}

export async function selectNextQuestion(
  quizId: string,
  currentDifficulty: number,
  answeredQuestionIds: string[],
  userRole: string,
  lastAnswerCorrect: boolean | null
): Promise<{ question: any; newDifficulty: number } | null> {
  let targetDifficulty = currentDifficulty;

  if (lastAnswerCorrect === true) {
    targetDifficulty = Math.min(currentDifficulty + 1, 5);
  } else if (lastAnswerCorrect === false) {
    targetDifficulty = currentDifficulty;
  }

  targetDifficulty = Math.min(Math.max(Math.floor(targetDifficulty), 1), 5);

  const excludeClause = answeredQuestionIds.length > 0
    ? `AND id NOT IN (${answeredQuestionIds.map((_, i) => `$${i + 4}`).join(",")})`
    : "";
  const roleJson = JSON.stringify([userRole]);
  const params: any[] = [quizId, roleJson, targetDifficulty, ...answeredQuestionIds];

  const roleFilter = `AND (audience_roles = '[]'::jsonb OR audience_roles @> $2::jsonb)`;

  const exactResult = await pool.query(
    `SELECT * FROM sop_quiz_questions
     WHERE quiz_id = $1 ${roleFilter} ${excludeClause}
     AND difficulty_level = $3
     ORDER BY RANDOM() LIMIT 1`,
    params
  );

  if (exactResult.rows.length > 0) {
    return { question: exactResult.rows[0], newDifficulty: targetDifficulty };
  }

  const nearestResult = await pool.query(
    `SELECT *, ABS(difficulty_level - $3) as distance
     FROM sop_quiz_questions
     WHERE quiz_id = $1 ${roleFilter} ${excludeClause}
     ORDER BY distance ASC, difficulty_level DESC, RANDOM()
     LIMIT 1`,
    params
  );

  if (nearestResult.rows.length > 0) {
    const row = nearestResult.rows[0];
    return { question: row, newDifficulty: row.difficulty_level };
  }

  return null;
}

export async function getReviewAreas(
  quizId: string,
  wrongQuestionIds: string[]
): Promise<string[]> {
  if (wrongQuestionIds.length === 0) return [];

  const placeholders = wrongQuestionIds.map((_, i) => `$${i + 1}`).join(",");
  const result = await pool.query(
    `SELECT question, difficulty_level, explanation FROM sop_quiz_questions
     WHERE id IN (${placeholders})
     ORDER BY difficulty_level ASC`,
    wrongQuestionIds
  );

  return result.rows.map((r: any) => {
    const label = getDifficultyLabel(r.difficulty_level);
    return `Level ${r.difficulty_level} (${label}): ${r.question.substring(0, 80)}${r.question.length > 80 ? "..." : ""}`;
  });
}

export async function getQuizStatsByUser(userId: string): Promise<any[]> {
  const result = await pool.query(
    `SELECT qa.quiz_id, q.title, q.sop_id, q.is_safety_critical, q.min_pass_level,
            MAX(qa.highest_level_passed) as best_level,
            MAX(qa.final_score_label) as best_label,
            COUNT(*) as attempt_count,
            MAX(qa.completed_at) as last_attempt
     FROM user_quiz_attempts qa
     JOIN sop_quizzes q ON q.id = qa.quiz_id
     WHERE qa.user_id = $1
     GROUP BY qa.quiz_id, q.title, q.sop_id, q.is_safety_critical, q.min_pass_level
     ORDER BY MAX(qa.completed_at) DESC`,
    [userId]
  );
  return result.rows;
}

export async function getAllEmployeeQuizStats(): Promise<any[]> {
  const result = await pool.query(
    `SELECT u.id as user_id, u.username, u.name, u.role,
            qa.quiz_id, q.title as quiz_title, q.sop_id, q.is_safety_critical, q.min_pass_level,
            s.title as sop_title,
            MAX(qa.highest_level_passed) as best_level,
            MAX(qa.final_score_label) as best_label,
            COUNT(*) as attempt_count,
            MAX(qa.completed_at) as last_attempt
     FROM user_quiz_attempts qa
     JOIN users u ON u.id = qa.user_id
     JOIN sop_quizzes q ON q.id = qa.quiz_id
     LEFT JOIN sops s ON s.id = q.sop_id
     GROUP BY u.id, u.username, u.name, u.role, qa.quiz_id, q.title, q.sop_id, q.is_safety_critical, q.min_pass_level, s.title
     ORDER BY u.name, q.title`
  );
  return result.rows;
}

export async function getSafetyCriticalFlags(): Promise<any[]> {
  const result = await pool.query(
    `SELECT u.id as user_id, u.username, u.name, u.role,
            q.id as quiz_id, q.title as quiz_title, q.min_pass_level,
            s.title as sop_title,
            COALESCE(MAX(qa.highest_level_passed), 0) as best_level
     FROM users u
     CROSS JOIN sop_quizzes q
     JOIN sops s ON s.id = q.sop_id
     LEFT JOIN user_quiz_attempts qa ON qa.user_id = u.id AND qa.quiz_id = q.id
     WHERE q.is_safety_critical = true
       AND u.role NOT IN ('Customer', 'Master Admin')
     GROUP BY u.id, u.username, u.name, u.role, q.id, q.title, q.min_pass_level, s.title
     HAVING COALESCE(MAX(qa.highest_level_passed), 0) < q.min_pass_level
     ORDER BY u.name, q.title`
  );
  return result.rows;
}
