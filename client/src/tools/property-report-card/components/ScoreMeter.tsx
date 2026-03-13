// Score meter component

interface ScoreMeterProps {
  score: number;
  checkedCount?: number;
  totalItems?: number;
  allAnswered?: boolean;
}

export function ScoreMeter({ score, checkedCount, totalItems = 10, allAnswered = true }: ScoreMeterProps) {
  const percentage = (score / 5) * 100;
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        {allAnswered ? (
          <span className="font-medium">Score: {score.toFixed(1)}</span>
        ) : (
          <span className="font-medium text-orange-600">Complete all items to see score</span>
        )}
        {checkedCount !== undefined && (
          <span className="text-gray-600">Checked: {checkedCount}/{totalItems}</span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        {allAnswered ? (
          <div
            className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        ) : (
          <div className="h-full bg-gray-300 animate-pulse" />
        )}
      </div>
    </div>
  );
}