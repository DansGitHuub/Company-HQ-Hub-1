// Category definitions with checklist items and recommended services

import { CategoryDefinition } from '../types';

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: 'lawns',
    name: 'Lawns',
    checklistItems: [
      'Grass is actively growing and healthy',
      'No bare or thin spots present',
      'Proper mowing height maintained',
      'No thatch buildup',
      'Adequate soil moisture levels',
      'No signs of disease or pest damage',
      'Proper fertilization evident',
      'Clean edges along beds and walkways',
      'No weed overgrowth',
      'Good overall color and density'
    ],
    recommendedServices: [
      { id: 'aeration', name: 'Aeration', measurementType: 'Square Feet' },
      { id: 'overseeding', name: 'Overseeding', measurementType: 'Square Feet' },
      { id: 'fertilization', name: 'Fertilization Program', measurementType: 'Square Feet' },
      { id: 'weed-control', name: 'Weed Control', measurementType: 'Square Feet' },
      { id: 'pest-treatment', name: 'Pest Treatment', measurementType: 'Square Feet' }
    ]
  },
  {
    id: 'trees',
    name: 'Trees',
    checklistItems: [
      'Trees show healthy foliage',
      'No dead or dying branches',
      'Proper pruning has been done',
      'No signs of disease or infestation',
      'Trunk and bark are healthy',
      'Root zone is not compacted',
      'Adequate mulch around base',
      'No structural issues or hazards',
      'Proper spacing from structures',
      'Overall tree vigor is good'
    ],
    recommendedServices: [
      { id: 'tree-pruning', name: 'Tree Pruning', measurementType: 'Count' },
      { id: 'tree-removal', name: 'Tree Removal', measurementType: 'Count' },
      { id: 'deep-root-feeding', name: 'Deep Root Feeding', measurementType: 'Count' },
      { id: 'pest-disease-treatment', name: 'Pest/Disease Treatment', measurementType: 'Count' },
      { id: 'tree-planting', name: 'Tree Planting', measurementType: 'Count' }
    ]
  },
  {
    id: 'plants',
    name: 'Plants',
    checklistItems: [
      'Plants are appropriate for location',
      'Healthy growth with no wilting',
      'No signs of disease or pests',
      'Proper spacing between plants',
      'Deadheading/pruning done as needed',
      'Adequate mulch coverage',
      'No weed competition',
      'Plants are properly sized',
      'Good color and bloom quality',
      'Overall plant health is good'
    ],
    recommendedServices: [
      { id: 'plant-replacement', name: 'Plant Replacement', measurementType: 'Count' },
      { id: 'plant-installation', name: 'New Plant Installation', measurementType: 'Count' },
      { id: 'shrub-pruning', name: 'Shrub Pruning', measurementType: '½ Day increments' },
      { id: 'plant-fertilization', name: 'Plant Fertilization', measurementType: 'Square Feet' },
      { id: 'pest-control', name: 'Pest Control', measurementType: 'Square Feet' }
    ]
  },
  {
    id: 'beds',
    name: 'Beds',
    checklistItems: [
      'Mulch is fresh and adequate depth',
      'Bed edges are clean and defined',
      'No weeds present',
      'Proper drainage in beds',
      'Soil quality is good',
      'Appropriate plant selection',
      'No erosion issues',
      'Beds are properly maintained',
      'Good overall appearance',
      'Beds complement landscape design'
    ],
    recommendedServices: [
      { id: 'mulch-refresh', name: 'Mulch Refresh', measurementType: 'Square Feet' },
      { id: 'bed-edging', name: 'Bed Edging', measurementType: 'Linear Feet' },
      { id: 'weed-removal', name: 'Weed Removal', measurementType: '½ Day increments' },
      { id: 'soil-amendment', name: 'Soil Amendment', measurementType: 'Square Feet' },
      { id: 'bed-renovation', name: 'Bed Renovation', measurementType: 'Square Feet' }
    ]
  },
  {
    id: 'irrigation',
    name: 'Irrigation',
    checklistItems: [
      'System is operating properly',
      'No leaks or broken heads',
      'Proper coverage of all zones',
      'Controller is programmed correctly',
      'No water waste or overspray',
      'Heads are adjusted properly',
      'No clogged nozzles',
      'System pressure is adequate',
      'Seasonal adjustments made',
      'Overall system efficiency is good'
    ],
    recommendedServices: [
      { id: 'system-repair', name: 'System Repair', measurementType: 'Count' },
      { id: 'head-adjustment', name: 'Head Adjustment', measurementType: 'Count' },
      { id: 'controller-upgrade', name: 'Controller Upgrade', measurementType: 'Count' },
      { id: 'winterization', name: 'Winterization', measurementType: 'Count' },
      { id: 'spring-startup', name: 'Spring Startup', measurementType: 'Count' }
    ]
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure',
    checklistItems: [
      'Walkways are safe and level',
      'No cracks or trip hazards',
      'Drainage is adequate',
      'Retaining walls are stable',
      'Fencing is in good repair',
      'Lighting is functional',
      'Hardscape is clean',
      'No settling or erosion',
      'All features are functional',
      'Overall condition is good'
    ],
    recommendedServices: [
      { id: 'walkway-repair', name: 'Walkway Repair', measurementType: 'Linear Feet' },
      { id: 'drainage-improvement', name: 'Drainage Improvement', measurementType: '½ Day increments' },
      { id: 'fence-repair', name: 'Fence Repair', measurementType: 'Linear Feet' },
      { id: 'wall-repair', name: 'Retaining Wall Repair', measurementType: 'Linear Feet' },
      { id: 'lighting-upgrade', name: 'Lighting Upgrade', measurementType: 'Count' }
    ]
  }
];

export const getCategoryDefinition = (id: string): CategoryDefinition | undefined => {
  return CATEGORY_DEFINITIONS.find(cat => cat.id === id);
};
