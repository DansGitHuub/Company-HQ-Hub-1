// Grade badge component

import { getGradeColor } from '../utils/scoring';

interface GradeBadgeProps {
  grade: string;
  size?: 'sm' | 'md' | 'lg';
}

export function GradeBadge({ grade, size = 'md' }: GradeBadgeProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-20 h-20 text-3xl'
  };

  return (
    <div
      className={`${sizeClasses[size]} ${getGradeColor(grade)} rounded-full flex items-center justify-center text-white font-bold shadow-md`}
    >
      {grade}
    </div>
  );
}