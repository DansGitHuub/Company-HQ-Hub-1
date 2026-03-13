// Assessment context for managing state

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Assessment, AssessmentCategory, CategoryId } from '../types';
import { saveAssessment, getAssessment } from '../utils/storage';
import { CATEGORY_DEFINITIONS } from '../data/categories';
import { calculateCategoryScore, scoreToGrade, calculateOverallScore, isAssessmentReadyForScore } from '../utils/scoring';

interface AssessmentContextType {
  assessment: Assessment | null;
  updateProperty: (property: Partial<Assessment['property']>) => void;
  updateCategory: (categoryId: CategoryId, updates: Partial<AssessmentCategory>) => void;
  toggleChecklistItem: (categoryId: CategoryId, index: number) => void;
  toggleCategoryNA: (categoryId: CategoryId) => void;
  saveCurrentAssessment: () => void;
  loadAssessment: (id: string) => void;
  createNewAssessment: (initialProperty?: Partial<Assessment['property']>) => string;
  clearAssessment: () => void;
  markComplete: () => void;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export function AssessmentProvider({ children }: { children: React.ReactNode }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);

  const createNewAssessment = (initialProperty?: Partial<Assessment['property']>) => {
    const newAssessment: Assessment = {
      id: `assessment-${Date.now()}`,
      property: {
        propertyName: '',
        address: '',
        inspectionDate: new Date().toISOString().split('T')[0],
        inspectorName: '',
        inspectorEmail: '',
        inspectorPhone: '',
        customerName: '',
        customerEmail: ''
      },
      categories: {} as Record<CategoryId, AssessmentCategory>,
      overallScore: 0,
      overallGrade: 'F',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Initialize categories
    CATEGORY_DEFINITIONS.forEach(def => {
      newAssessment.categories[def.id] = {
        id: def.id,
        name: def.name,
        checklistItems: new Array(10).fill(null), // Initialize as null (unanswered)
        naToggle: false,
        autoScore: 0,
        autoGrade: '-',
        notes: '',
        attachments: [],
        recommendedServices: def.recommendedServices.map(service => ({
          id: service.id,
          name: service.name,
          selected: false,
          measurementType: service.measurementType,
          measurementValue: '',
          internalExternal: 'EXTERNAL',
          notes: '',
          attachments: []
        }))
      };
    });

    if (initialProperty) {
      newAssessment.property = { ...newAssessment.property, ...initialProperty };
    }

    setAssessment(newAssessment);
    return newAssessment.id;
  };

  const updateProperty = (property: Partial<Assessment['property']>) => {
    if (!assessment) return;
    setAssessment({
      ...assessment,
      property: { ...assessment.property, ...property },
      updatedAt: new Date()
    });
  };

  const recalculateScores = (updatedCategories: Record<CategoryId, AssessmentCategory>): Record<CategoryId, AssessmentCategory> => {
    const recalculated = { ...updatedCategories };
    
    Object.keys(recalculated).forEach(key => {
      const cat = recalculated[key as CategoryId];
      if (!cat.naToggle) {
        // Check if all items are answered (none are null)
        const allAnswered = cat.checklistItems.every(item => item !== null);
        
        if (allAnswered) {
          const checkedCount = cat.checklistItems.filter(item => item === true).length;
          cat.autoScore = calculateCategoryScore(checkedCount);
          cat.autoGrade = scoreToGrade(cat.autoScore);
        } else {
          // Not all items answered yet
          cat.autoScore = 0;
          cat.autoGrade = '-';
        }
      }
    });

    return recalculated;
  };

  const updateCategory = (categoryId: CategoryId, updates: Partial<AssessmentCategory>) => {
    if (!assessment) return;
    
    const updatedCategories = {
      ...assessment.categories,
      [categoryId]: { ...assessment.categories[categoryId], ...updates }
    };

    const recalculated = recalculateScores(updatedCategories);
    
    // Only calculate overall score if all categories are complete or N/A
    const isReady = isAssessmentReadyForScore(recalculated);
    const overallScore = isReady ? calculateOverallScore(recalculated) : 0;
    const overallGrade = isReady ? scoreToGrade(overallScore) : '-';

    setAssessment({
      ...assessment,
      categories: recalculated,
      overallScore,
      overallGrade,
      updatedAt: new Date()
    });
  };

  const toggleChecklistItem = (categoryId: CategoryId, index: number) => {
    if (!assessment) return;
    
    const category = assessment.categories[categoryId];
    const newChecklistItems = [...category.checklistItems];
    newChecklistItems[index] = !newChecklistItems[index];
    
    updateCategory(categoryId, { checklistItems: newChecklistItems });
  };

  const toggleCategoryNA = (categoryId: CategoryId) => {
    if (!assessment) return;
    
    const category = assessment.categories[categoryId];
    const newNA = !category.naToggle;
    
    updateCategory(categoryId, {
      naToggle: newNA,
      autoScore: newNA ? 0 : calculateCategoryScore(category.checklistItems.filter(Boolean).length),
      autoGrade: newNA ? 'N/A' : scoreToGrade(calculateCategoryScore(category.checklistItems.filter(Boolean).length))
    });
  };

  const saveCurrentAssessment = () => {
    if (assessment) {
      saveAssessment(assessment);
    }
  };

  const loadAssessment = (id: string) => {
    const loaded = getAssessment(id);
    if (loaded) {
      setAssessment(loaded);
    }
  };

  const clearAssessment = () => {
    setAssessment(null);
  };

  const markComplete = () => {
    if (!assessment) return;
    setAssessment({
      ...assessment,
      status: 'complete',
      updatedAt: new Date()
    });
  };

  // Auto-save on changes
  useEffect(() => {
    if (assessment) {
      const timer = setTimeout(() => {
        saveCurrentAssessment();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [assessment]);

  return (
    <AssessmentContext.Provider
      value={{
        assessment,
        updateProperty,
        updateCategory,
        toggleChecklistItem,
        toggleCategoryNA,
        saveCurrentAssessment,
        loadAssessment,
        createNewAssessment,
        clearAssessment,
        markComplete
      }}
    >
      {children}
    </AssessmentContext.Provider>
  );
}

export function useAssessment() {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessment must be used within AssessmentProvider');
  }
  return context;
}