// Demo/sample assessment data for preview mode

import { Assessment } from '../types';
import { getCategoryDefinition } from '../data/categories';

export function createDemoAssessment(): Assessment {
  const demoId = 'demo-assessment';
  const now = new Date();

  const lawnsDefinition = getCategoryDefinition('lawns');
  const treesDefinition = getCategoryDefinition('trees');
  const plantsDefinition = getCategoryDefinition('plants');
  const bedsDefinition = getCategoryDefinition('beds');
  const irrigationDefinition = getCategoryDefinition('irrigation');
  const infrastructureDefinition = getCategoryDefinition('infrastructure');

  return {
    id: demoId,
    property: {
      propertyName: 'Green Valley Estate',
      address: '123 Maple Street, Springfield, IL 62701',
      inspectionDate: now.toISOString().split('T')[0],
      inspectorName: 'John Smith',
      inspectorEmail: 'john.smith@example.com',
      inspectorPhone: '(555) 123-4567',
      customerName: 'Sarah Johnson',
      customerEmail: 'sarah.johnson@example.com',
      customerPhone: '(555) 987-6543'
    },
    categories: {
      lawns: {
        id: 'lawns',
        name: 'Lawns',
        checklistItems: [true, true, true, true, true, true, true, true, false, false],
        photos: [],
        naToggle: false,
        autoScore: 4,
        autoGrade: 'B',
        notes: '',
        attachments: [],
        recommendedServices: lawnsDefinition?.recommendedServices.map(service => ({
          ...service,
          selected: service.id === 'fertilization',
          internalExternal: 'INTERNAL',
          measurementValue: service.id === 'fertilization' ? 5000 : 0,
          notes: '',
          attachments: []
        })) || []
      },
      trees: {
        id: 'trees',
        name: 'Trees',
        checklistItems: [true, true, true, true, true, true, true, false, false, false],
        photos: [],
        naToggle: false,
        autoScore: 4,
        autoGrade: 'B',
        notes: '',
        attachments: [],
        recommendedServices: treesDefinition?.recommendedServices.map(service => ({
          ...service,
          selected: service.id === 'tree-pruning',
          internalExternal: 'EXTERNAL',
          measurementValue: service.id === 'tree-pruning' ? 8 : 0,
          notes: '',
          attachments: []
        })) || []
      },
      plants: {
        id: 'plants',
        name: 'Plants',
        checklistItems: [true, true, true, true, true, true, false, false, false, false],
        photos: [],
        naToggle: false,
        autoScore: 3,
        autoGrade: 'C',
        notes: '',
        attachments: [],
        recommendedServices: plantsDefinition?.recommendedServices.map(service => ({
          ...service,
          selected: service.id === 'plant-replacement',
          internalExternal: 'INTERNAL',
          measurementValue: service.id === 'plant-replacement' ? 25 : 0,
          notes: '',
          attachments: []
        })) || []
      },
      beds: {
        id: 'beds',
        name: 'Beds',
        checklistItems: [true, true, true, true, true, true, true, true, true, false],
        photos: [],
        naToggle: false,
        autoScore: 5,
        autoGrade: 'A',
        notes: '',
        attachments: [],
        recommendedServices: bedsDefinition?.recommendedServices.map(service => ({
          ...service,
          selected: false,
          internalExternal: 'INTERNAL',
          measurementValue: 0,
          notes: '',
          attachments: []
        })) || []
      },
      irrigation: {
        id: 'irrigation',
        name: 'Irrigation',
        checklistItems: [true, true, true, true, true, false, false, false, false, false],
        photos: [],
        naToggle: false,
        autoScore: 3,
        autoGrade: 'C',
        notes: '',
        attachments: [],
        recommendedServices: irrigationDefinition?.recommendedServices.map(service => ({
          ...service,
          selected: service.id === 'system-repair',
          internalExternal: 'EXTERNAL',
          measurementValue: service.id === 'system-repair' ? 12 : 0,
          notes: '',
          attachments: []
        })) || []
      },
      infrastructure: {
        id: 'infrastructure',
        name: 'Infrastructure',
        checklistItems: [true, true, true, true, true, true, true, true, true, true],
        photos: [],
        naToggle: false,
        autoScore: 5,
        autoGrade: 'A',
        notes: '',
        attachments: [],
        recommendedServices: infrastructureDefinition?.recommendedServices.map(service => ({
          ...service,
          selected: false,
          internalExternal: 'INTERNAL',
          measurementValue: 0,
          notes: '',
          attachments: []
        })) || []
      }
    },
    overallScore: 4.0,
    overallGrade: 'B',
    status: 'complete',
    createdAt: now,
    updatedAt: now
  };
}