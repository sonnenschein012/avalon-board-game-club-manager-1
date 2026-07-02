import React from 'react';
import { cn } from '../lib/utils';

interface FilterPillsProps {
  options: string[];
  selected: string[];
  onChange: (s: string[]) => void;
}

export default function FilterPills({ options, selected, onChange }: FilterPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const isSelected = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onChange(isSelected ? selected.filter(x => x !== opt) : [...selected, opt])}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border",
              isSelected 
                ? "bg-navy text-white border-gold shadow-sm" 
                : "bg-white text-slate-500 border-slate-100 hover:border-gold"
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
