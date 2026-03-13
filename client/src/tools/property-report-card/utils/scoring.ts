// Utility functions for scoring and grading

// Convert checked count (0-10) to category score (1-5)
export function calculateCategoryScore(checkedCount: number): number {
  if (checkedCount <= 2) return 1;
  if (checkedCount <= 4) return 2;
  if (checkedCount <= 6) return 3;
  if (checkedCount <= 8) return 4;
  return 5; // 9-10 checked
}

// Convert numeric score to letter grade
export function scoreToGrade(score: number): string {
  if (score < 2.0) return 'F';
  if (score < 3.0) return 'D';
  if (score < 4.0) return 'C';
  if (score < 5.0) return 'B';
  return 'A';
}

// Calculate overall score from categories
export function calculateOverallScore(categories: Record<string, { autoScore: number; naToggle: boolean }>): number {
  const validScores = Object.values(categories)
    .filter(cat => !cat.naToggle)
    .map(cat => cat.autoScore);
  
  if (validScores.length === 0) return 0;
  
  const sum = validScores.reduce((acc, score) => acc + score, 0);
  return sum / validScores.length;
}

// Get grade badge color
export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-green-500';
    case 'B': return 'bg-blue-500';
    case 'C': return 'bg-yellow-500';
    case 'D': return 'bg-orange-500';
    case 'F': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}

// Get status color
export function getStatusColor(status: string): string {
  switch (status) {
    case 'complete': return 'bg-green-100 text-green-800';
    case 'in-progress': return 'bg-blue-100 text-blue-800';
    case 'not-started': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

// Get category status
export function getCategoryStatus(category: { checklistItems: (boolean | null)[]; naToggle: boolean }): 'not-started' | 'in-progress' | 'complete' {
  if (category.naToggle) return 'complete';
  
  const answeredCount = category.checklistItems.filter(item => item !== null).length;
  if (answeredCount === 0) return 'not-started';
  if (answeredCount === 10) return 'complete';
  return 'in-progress';
}

// Check if assessment is ready to show overall score
export function isAssessmentReadyForScore(categories: Record<string, { checklistItems: (boolean | null)[]; naToggle: boolean }>): boolean {
  const categoryList = Object.values(categories);
  
  // All categories must be complete (either all 10 items answered or marked N/A)
  return categoryList.every(cat => getCategoryStatus(cat) === 'complete');
}