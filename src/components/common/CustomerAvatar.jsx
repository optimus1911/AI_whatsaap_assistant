import React, { useState } from 'react';

// Curated professional WhatsApp CRM avatar color themes (deterministic)
const AVATAR_COLOR_PALETTES = [
  { bg: 'bg-[#0f4d43]', text: 'text-[#e9edef]', border: 'border-[#25d366]/30' }, // WhatsApp Deep Teal
  { bg: 'bg-[#1e293b]', text: 'text-[#93c5fd]', border: 'border-[#38bdf8]/30' }, // Slate Blue
  { bg: 'bg-[#312e81]', text: 'text-[#c7d2fe]', border: 'border-[#818cf8]/30' }, // Indigo
  { bg: 'bg-[#064e3b]', text: 'text-[#6ee7b7]', border: 'border-[#34d399]/30' }, // Emerald
  { bg: 'bg-[#451a03]', text: 'text-[#fcd34d]', border: 'border-[#fbbf24]/30' }, // Amber
  { bg: 'bg-[#3b0764]', text: 'text-[#f0abfc]', border: 'border-[#c084fc]/30' }, // Purple
  { bg: 'bg-[#164e63]', text: 'text-[#67e8f9]', border: 'border-[#22d3ee]/30' }, // Steel Cyan
  { bg: 'bg-[#374151]', text: 'text-[#e5e7eb]', border: 'border-[#9ca3af]/30' }, // Charcoal Slate
];

// Deterministic integer hash mapping customer name to consistent palette
const getAvatarPalette = (name = '') => {
  if (!name) return AVATAR_COLOR_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLOR_PALETTES.length;
  return AVATAR_COLOR_PALETTES[index];
};

// Generates up to 2 uppercase initials from a customer name
export const getCustomerInitials = (displayName) => {
  if (!displayName || typeof displayName !== 'string') return '?';
  const clean = displayName.trim().replace(/[^\w\s]/gi, '');
  if (!clean) return '?';

  const segments = clean.split(/\s+/).filter(Boolean);
  if (segments.length >= 2) {
    return (segments[0][0] + segments[1][0]).toUpperCase();
  }
  return clean.substring(0, Math.min(2, clean.length)).toUpperCase();
};

export default function CustomerAvatar({
  profilePicture,
  src, // Backward compatibility alias
  name = 'User',
  size = 'md',
  online = false,
  className = ''
}) {
  const [imageError, setImageError] = useState(false);

  // Normalize image source (strip any DiceBear/generated cartoon URLs)
  const rawUrl = profilePicture || src || '';
  const isGeneratedOrDicebear = typeof rawUrl === 'string' && (
    rawUrl.includes('dicebear.com') ||
    rawUrl.includes('adventurer') ||
    rawUrl.includes('avataaars')
  );

  const isValidPhotoUrl = rawUrl && !isGeneratedOrDicebear && !imageError;

  // Responsive WhatsApp-like sizing definitions:
  // - sm: ~36px (Dashboard, Insights, Hot Leads)
  // - md: ~44px (Sidebar Chat List, Chat Area Header)
  // - lg: ~52px (Intelligence Panel Profile Card)
  const sizeClasses = {
    xs: 'w-7 h-7 text-[10px] font-bold',
    sm: 'w-9 h-9 text-xs font-bold',
    md: 'w-11 h-11 text-sm font-bold',
    lg: 'w-[52px] h-[52px] text-base font-bold',
    xl: 'w-14 h-14 text-lg font-bold'
  };

  const statusIndicatorSizes = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-3.5 h-3.5'
  };

  const resolvedSize = sizeClasses[size] || sizeClasses.md;
  const resolvedIndicatorSize = statusIndicatorSizes[size] || statusIndicatorSizes.md;
  const palette = getAvatarPalette(name);
  const initials = getCustomerInitials(name);

  return (
    <div className={`relative inline-flex items-center justify-center select-none flex-shrink-0 ${className}`}>
      {isValidPhotoUrl ? (
        <img
          src={rawUrl}
          alt={`${name}'s profile`}
          onError={() => setImageError(true)}
          className={`${resolvedSize} rounded-full object-cover border border-whatsapp-border/60 bg-whatsapp-panel shadow-sm`}
        />
      ) : (
        <div
          className={`${resolvedSize} rounded-full flex items-center justify-center ${palette.bg} ${palette.text} border ${palette.border} shadow-sm tracking-wider font-sans font-bold`}
          aria-label={name}
        >
          <span>{initials}</span>
        </div>
      )}

      {online && (
        <span
          className={`absolute bottom-0 right-0 rounded-full bg-whatsapp-green border-2 border-whatsapp-sidebar ${resolvedIndicatorSize}`}
          title="Online"
          role="status"
          aria-label="Online"
        />
      )}
    </div>
  );
}
