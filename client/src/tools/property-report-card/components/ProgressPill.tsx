// Progress pill component

import { getStatusColor } from '../utils/scoring';

interface ProgressPillProps {
  status: 'not-started' | 'in-progress' | 'complete';
}

export function ProgressPill({ status }: ProgressPillProps) {
  const labels = {
    'not-started': 'Not Started',
    'in-progress': 'In Progress',
    'complete': 'Complete'
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {labels[status]}
    </span>
  );
}