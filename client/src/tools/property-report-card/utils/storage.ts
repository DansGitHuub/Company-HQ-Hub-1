// LocalStorage utilities for persisting assessments

import { Assessment } from '../types';

const STORAGE_KEY = 'landscape_assessments';

export function saveAssessment(assessment: Assessment): void {
  const assessments = getAllAssessments();
  const index = assessments.findIndex(a => a.id === assessment.id);
  
  if (index >= 0) {
    assessments[index] = assessment;
  } else {
    assessments.push(assessment);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assessments));
}

export function getAssessment(id: string): Assessment | null {
  const assessments = getAllAssessments();
  return assessments.find(a => a.id === id) || null;
}

export function getAllAssessments(): Assessment[] {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  
  try {
    const assessments = JSON.parse(data);
    // Convert date strings back to Date objects
    return assessments.map((a: Assessment) => ({
      ...a,
      createdAt: new Date(a.createdAt),
      updatedAt: new Date(a.updatedAt)
    }));
  } catch {
    return [];
  }
}

export function deleteAssessment(id: string): void {
  const assessments = getAllAssessments().filter(a => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assessments));
}
