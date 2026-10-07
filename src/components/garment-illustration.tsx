import React from 'react';

interface ColorLike {
  name: string;
  hex: string;
}

interface GarmentIllustrationProps {
  category: string;
  colors: ColorLike[];
  size?: number;
  className?: string;
}

// Picks a readable outline color for a filled shape — dark shapes get a
// light outline, light shapes get a dark outline, so the silhouette reads
// clearly on any background.
function outlineFor(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.75 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.35)';
}

/**
 * A colored, garment-shaped illustration — filled with the item's actual
 * color(s) instead of a generic gray icon plus a separate small color swatch.
 * Not a real photo (this project has no image-generation/sourcing available),
 * but a meaningfully more concrete visual than a plain circle.
 */
export function GarmentIllustration({ category, colors, size = 64, className = '' }: GarmentIllustrationProps) {
  const normCategory = category.toLowerCase().trim();
  const primary = colors[0]?.hex || '#94a3b8';
  const secondary = colors[1]?.hex;
  const stroke = outlineFor(primary);
  const title = colors.map((c) => c.name).join(' & ') || category;

  const commonProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    className,
  };

  // Shirt / Top / Polo
  if (normCategory.includes('shirt') || normCategory.includes('top') || normCategory.includes('polo')) {
    return (
      <svg {...commonProps} role="img" aria-label={title}>
        <path
          d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"
          fill={primary}
          stroke={stroke}
          strokeWidth="1"
        />
        {secondary && <path d="M9 10h6v3H9z" fill={secondary} opacity={0.85} />}
      </svg>
    );
  }

  // Trouser / Chino / Jean
  if (normCategory.includes('trouser') || normCategory.includes('pant') || normCategory.includes('chino') || normCategory.includes('jean') || normCategory.includes('short')) {
    return (
      <svg {...commonProps} role="img" aria-label={title}>
        <path d="M6 3h12v4l-1 14h-3.5L12 11l-1.5 10H7L6 7V3z" fill={primary} stroke={stroke} strokeWidth="1" />
        <line x1="6" y1="6" x2="18" y2="6" stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }

  // Shoe / Boot / Loafer / Sneaker
  if (normCategory.includes('shoe') || normCategory.includes('boot') || normCategory.includes('loafer') || normCategory.includes('sneaker')) {
    return (
      <svg {...commonProps} role="img" aria-label={title}>
        <path d="M2 17v2a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2l-3-4-4-1-4-5H7L3 14l-1 3z" fill={primary} stroke={stroke} strokeWidth="1" />
        <path d="M2 17h20" stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }

  // Belt
  if (normCategory.includes('belt')) {
    return (
      <svg {...commonProps} role="img" aria-label={title}>
        <rect x="2" y="9" width="20" height="6" rx="2" fill={primary} stroke={stroke} strokeWidth="1" />
        <rect x="7" y="7" width="5" height="10" rx="1" fill="none" stroke={stroke} strokeWidth="1.5" />
        <circle cx="17" cy="12" r="0.75" fill={stroke} />
        <circle cx="19" cy="12" r="0.75" fill={stroke} />
      </svg>
    );
  }

  // Jacket / Blazer / Coat
  if (normCategory.includes('jacket') || normCategory.includes('blazer') || normCategory.includes('coat') || normCategory.includes('suit')) {
    return (
      <svg {...commonProps} role="img" aria-label={title}>
        <path d="M4 4h16l-2 17H6L4 4z" fill={primary} stroke={stroke} strokeWidth="1" />
        <path d="M4 4l8 6 8-6" fill="none" stroke={stroke} strokeWidth="1" />
        <line x1="12" y1="10" x2="12" y2="21" stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }

  // Watch
  if (normCategory.includes('watch')) {
    return (
      <svg {...commonProps} role="img" aria-label={title}>
        <path d="M9 3h6v3H9z" fill={primary} stroke={stroke} strokeWidth="1" />
        <path d="M9 18h6v3H9z" fill={primary} stroke={stroke} strokeWidth="1" />
        <circle cx="12" cy="12" r="6" fill={secondary || primary} stroke={stroke} strokeWidth="1" />
        <polyline points="12 9 12 12 14 14" fill="none" stroke={stroke} strokeWidth="1.3" />
      </svg>
    );
  }

  // Sweater / Cardigan / Hoodie / Knitwear
  if (normCategory.includes('sweater') || normCategory.includes('cardigan') || normCategory.includes('hoodie') || normCategory.includes('knitwear')) {
    return (
      <svg {...commonProps} role="img" aria-label={title}>
        <path d="M8 3 4 6v4l2 1v9h12v-9l2-1V6l-4-3-2 2h-4L8 3z" fill={primary} stroke={stroke} strokeWidth="1" />
        <path d="M9 3a3 3 0 0 0 6 0" fill="none" stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }

  // Pocket Square
  if (normCategory.includes('pocket') || normCategory.includes('square')) {
    return (
      <svg {...commonProps} role="img" aria-label={title}>
        <rect x="4" y="4" width="16" height="16" rx="1" fill={primary} stroke={stroke} strokeWidth="1" />
        <path d="M4 14 12 8l8 6" fill="none" stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }

  // Default: Tie / Accessory
  return (
    <svg {...commonProps} role="img" aria-label={title}>
      <polygon points="10 2 14 2 13 6 11 6 10 2" fill={secondary || primary} stroke={stroke} strokeWidth="1" />
      <polygon points="11 6 13 6 15 17 12 22 9 17 11 6" fill={primary} stroke={stroke} strokeWidth="1" />
    </svg>
  );
}
