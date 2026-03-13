// Data types for Landscape Health Assessment

export type CategoryId = 'lawns' | 'trees' | 'plants' | 'beds' | 'irrigation' | 'infrastructure';

export interface Attachment {
  id: string;
  url: string;
  type: 'photo' | 'file';
  timestamp: Date;
  caption?: string;
  thumbnail?: string;
}

export interface RecommendedService {
  id: string;
  name: string;
  selected: boolean;
  measurementType: string; // "Square Feet", "Linear Feet", "Count", "½ Day increments"
  measurementValue: number | string;
  internalExternal: 'INTERNAL' | 'EXTERNAL';
  notes: string;
  attachments: Attachment[];
}

export interface AssessmentCategory {
  id: CategoryId;
  name: string;
  checklistItems: (boolean | null)[]; // null = unanswered, true = checkmark, false = X
  naToggle: boolean;
  autoScore: number; // 1-5
  autoGrade: string; // A-F
  notes: string;
  attachments: Attachment[];
  recommendedServices: RecommendedService[];
}

export interface Property {
  propertyName: string;
  address: string;
  inspectionDate: string;
  inspectorName: string;
  inspectorEmail: string;
  inspectorPhone: string;
  customerName?: string;
  customerEmail?: string;
}

export interface Assessment {
  id: string;
  property: Property;
  categories: Record<CategoryId, AssessmentCategory>;
  overallScore: number;
  overallGrade: string;
  status: 'draft' | 'complete';
  createdAt: Date;
  updatedAt: Date;
  generatedPDFUrl?: string;
}

export interface CategoryDefinition {
  id: CategoryId;
  name: string;
  checklistItems: string[];
  recommendedServices: {
    id: string;
    name: string;
    measurementType: string;
  }[];
}