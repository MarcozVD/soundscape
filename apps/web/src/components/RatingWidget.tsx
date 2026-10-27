'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';

interface RatingWidgetProps {
  trackId: string;
  compact?: boolean;
}

export function RatingWidget({ trackId, compact }: RatingWidgetProps) {
  const [hoveredStar, setHoveredStar] = useState(0);
  const submitRating = trpc.ratings.submit.useMutation();

  const handleRate = (stars: number) => {
    submitRating.mutate({ trackId, stars });
  };

  if (compact) {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={(e) => { e.stopPropagation(); handleRate(star); }}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="text-xs transition-colors"
            style={{ color: star <= hoveredStar ? '#eab308' : '#525252' }}
            aria-label={`Rate ${star} stars`}
          >
            ★
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-neutral-400">Rate this recommendation</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="text-2xl transition-transform hover:scale-110"
            style={{ color: star <= hoveredStar ? '#eab308' : '#525252' }}
            aria-label={`Rate ${star} stars`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}
