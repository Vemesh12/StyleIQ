'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number; // 1 to 5 (can be decimal like 4.8)
  maxStars?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (rating: number) => void;
  showValue?: boolean;
  className?: string;
}

export function StarRating({
  rating,
  maxStars = 5,
  size = 'md',
  interactive = false,
  onChange,
  showValue = false,
  className,
}: StarRatingProps) {
  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const starIcon = (starValue: number) => {
    const isFilled = rating >= starValue;
    const isHalf = rating >= starValue - 0.5 && rating < starValue;
    return (
      <Star
        aria-hidden="true"
        className={cn(
          sizeClasses[size],
          isFilled ? 'fill-amber-500 text-amber-500' : isHalf ? 'fill-amber-500/50 text-amber-500' : 'fill-slate-200 text-slate-300'
        )}
      />
    );
  };
  const stars = Array.from({ length: maxStars }, (_, index) => index + 1);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {interactive ? (
        // Editable: real buttons, each labelled, keyboard-focusable.
        <div role="group" aria-label="Rating" className="flex items-center gap-0.5">
          {stars.map((starValue) => (
            <button
              key={starValue}
              type="button"
              aria-label={`${starValue} star${starValue === 1 ? '' : 's'}`}
              aria-pressed={rating >= starValue}
              onClick={() => onChange?.(starValue)}
              className="transition-all cursor-pointer hover:scale-110 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              {starIcon(starValue)}
            </button>
          ))}
        </div>
      ) : (
        // Display only: one labelled image, not five disabled buttons (which
        // were also invalid inside the link cards they appear in).
        <span role="img" aria-label={`${rating} out of ${maxStars}`} className="flex items-center gap-0.5">
          {stars.map((starValue) => (
            <span key={starValue}>{starIcon(starValue)}</span>
          ))}
        </span>
      )}

      {showValue && (
        <span className="text-xs font-bold text-slate-700 ml-1">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
