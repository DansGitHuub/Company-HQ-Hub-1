// Checklist row component

import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChecklistRowProps {
  label: string;
  value: boolean | null; // null = unanswered, true = checkmark, false = X
  onSetValue: (value: boolean) => void;
  disabled?: boolean;
}

export function ChecklistRow({ label, value, onSetValue, disabled = false }: ChecklistRowProps) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border ${
        value === true 
          ? 'bg-green-50 border-green-200' 
          : value === false 
          ? 'bg-red-50 border-red-200' 
          : 'bg-white border-gray-300'
      } ${disabled ? 'opacity-50' : ''} transition-colors`}
    >
      <div className="flex gap-2 mt-0.5">
        {/* Checkmark Button */}
        <Button
          variant={value === true ? "default" : "outline"}
          size="sm"
          onClick={() => !disabled && onSetValue(true)}
          disabled={disabled}
          className={`h-8 w-8 p-0 ${
            value === true 
              ? 'bg-green-600 hover:bg-green-700 border-green-600' 
              : 'border-gray-300 hover:bg-green-50 hover:border-green-600'
          }`}
        >
          <Check className="w-4 h-4" />
        </Button>

        {/* X Button */}
        <Button
          variant={value === false ? "default" : "outline"}
          size="sm"
          onClick={() => !disabled && onSetValue(false)}
          disabled={disabled}
          className={`h-8 w-8 p-0 ${
            value === false 
              ? 'bg-red-600 hover:bg-red-700 border-red-600' 
              : 'border-gray-300 hover:bg-red-50 hover:border-red-600'
          }`}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <label className="flex-1 text-sm leading-relaxed">
        {label}
        {value === null && <span className="text-red-500 ml-1">*</span>}
      </label>
    </div>
  );
}
