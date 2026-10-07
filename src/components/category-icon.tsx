import React from 'react';

interface CategoryIconProps {
  category: string;
  className?: string;
  size?: number;
}

export function CategoryIcon({ category, className = '', size = 32 }: CategoryIconProps) {
  const normCategory = category.toLowerCase().trim();

  // 1. Shirt (Shirt Icon) — also covers polo, which is a collared top too.
  if (normCategory.includes('shirt') || normCategory.includes('top') || normCategory.includes('polo')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
        <path d="M16 2v4a4 4 0 0 1-8 0V2" />
        <line x1="12" y1="10" x2="12" y2="20" />
        <circle cx="12" cy="12" r="0.5" fill="currentColor" />
        <circle cx="12" cy="15" r="0.5" fill="currentColor" />
        <circle cx="12" cy="18" r="0.5" fill="currentColor" />
      </svg>
    );
  }

  // 2. Pant / Trouser (Pant Icon)
  if (normCategory.includes('trouser') || normCategory.includes('pant') || normCategory.includes('chino') || normCategory.includes('jean')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M6 3h12v4l-1 14h-3.5L12 11l-1.5 10H7L6 7V3z" />
        <line x1="6" y1="6" x2="18" y2="6" />
        <line x1="12" y1="3" x2="12" y2="11" />
      </svg>
    );
  }

  // 3. Shoe / Footwear (Shoe Icon)
  if (normCategory.includes('shoe') || normCategory.includes('boot') || normCategory.includes('loafer') || normCategory.includes('sneaker')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M2 17v2a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2l-3-4-4-1-4-5H7L3 14l-1 3z" />
        <path d="M2 17h20" />
        <circle cx="9" cy="12" r="1" />
        <circle cx="12" cy="13" r="1" />
      </svg>
    );
  }

  // 4. Belt (Belt Icon)
  if (normCategory.includes('belt')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <rect x="2" y="9" width="20" height="6" rx="2" />
        <rect x="7" y="7" width="5" height="10" rx="1" fill="none" strokeWidth="2" />
        <line x1="10" y1="12" x2="15" y2="12" strokeWidth="2" />
        <circle cx="17" cy="12" r="0.75" fill="currentColor" />
        <circle cx="19" cy="12" r="0.75" fill="currentColor" />
      </svg>
    );
  }

  // 5. Jacket / Blazer (Jacket Icon)
  if (normCategory.includes('jacket') || normCategory.includes('blazer') || normCategory.includes('coat') || normCategory.includes('suit')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M4 4h16l-2 17H6L4 4z" />
        <path d="M4 4l8 6 8-6" />
        <path d="M12 10v11" />
        <line x1="9" y1="4" x2="12" y2="10" />
        <line x1="15" y1="4" x2="12" y2="10" />
      </svg>
    );
  }

  // 6. Watch (Watch Icon)
  if (normCategory.includes('watch')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <circle cx="12" cy="12" r="6" />
        <polyline points="12 9 12 12 14 14" />
        <path d="M9 3h6v3H9z" />
        <path d="M9 18h6v3H9z" />
      </svg>
    );
  }

  // 7. Sweater / Cardigan / Hoodie (Knitwear Icon)
  if (normCategory.includes('sweater') || normCategory.includes('cardigan') || normCategory.includes('hoodie') || normCategory.includes('knitwear')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <path d="M8 3 4 6v4l2 1v9h12v-9l2-1V6l-4-3-2 2h-4L8 3z" />
        <path d="M9 3a3 3 0 0 0 6 0" />
      </svg>
    );
  }

  // 8. Pocket Square (Folded Square Icon)
  if (normCategory.includes('pocket') || normCategory.includes('square')) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <rect x="4" y="4" width="16" height="16" rx="1" />
        <path d="M4 14 12 8l8 6" />
        <path d="M9 12v8" />
        <path d="M15 12v8" />
      </svg>
    );
  }

  // Default Accessory / Tie
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="10 2 14 2 13 6 11 6 10 2" />
      <polygon points="11 6 13 6 15 17 12 22 9 17 11 6" />
    </svg>
  );
}
