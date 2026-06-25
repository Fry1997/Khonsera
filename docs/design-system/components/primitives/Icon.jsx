import React from 'react';

/* Khonsera stroke icon set — a curated Lucide subset at 1.75 stroke, the one
 * line weight the brand uses. Travel-domain glyphs (train, plane, platform,
 * key, ticket) plus the UI essentials. Reference by `name`; never inline a
 * one-off SVG in product code. */
const P = {
  home: ['<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>','<polyline points="9 22 9 12 15 12 15 22"/>'],
  train: ['<rect width="16" height="16" x="4" y="3" rx="2"/>','<path d="M4 11h16"/>','<path d="M12 3v8"/>','<path d="m8 19-2 3"/>','<path d="m18 22-2-3"/>','<path d="M8 15h.01"/>','<path d="M16 15h.01"/>'],
  building: ['<rect width="16" height="20" x="4" y="2" rx="2"/>','<path d="M9 22v-4h6v4"/>','<path d="M8 6h.01"/>','<path d="M16 6h.01"/>','<path d="M12 6h.01"/>','<path d="M12 10h.01"/>','<path d="M12 14h.01"/>','<path d="M16 10h.01"/>','<path d="M16 14h.01"/>','<path d="M8 10h.01"/>','<path d="M8 14h.01"/>'],
  walk: ['<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/>','<path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/>','<path d="M16 17h4"/>','<path d="M4 13h4"/>'],
  shield: ['<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'],
  shieldCheck: ['<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>','<path d="m9 12 2 2 4-4"/>'],
  coffee: ['<path d="M10 2v2"/>','<path d="M14 2v2"/>','<path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>','<path d="M6 2v2"/>'],
  luggage: ['<path d="M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2"/>','<path d="M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14"/>','<path d="M10 20h4"/>','<circle cx="8" cy="20" r="1"/>','<circle cx="16" cy="20" r="1"/>'],
  scan: ['<path d="M3 7V5a2 2 0 0 1 2-2h2"/>','<path d="M17 3h2a2 2 0 0 1 2 2v2"/>','<path d="M21 17v2a2 2 0 0 1-2 2h-2"/>','<path d="M7 21H5a2 2 0 0 1-2-2v-2"/>','<path d="M7 12h10"/>'],
  file: ['<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>','<path d="M14 2v4a2 2 0 0 0 2 2h4"/>'],
  check: ['<path d="M20 6 9 17l-5-5"/>'],
  plus: ['<path d="M5 12h14"/>','<path d="M12 5v14"/>'],
  bell: ['<path d="M10.268 21a2 2 0 0 0 3.464 0"/>','<path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>'],
  swap: ['<path d="M16 3h5v5"/>','<path d="M21 3 9 15"/>','<path d="M8 21H3v-5"/>','<path d="m3 21 12-12"/>'],
  x: ['<path d="M18 6 6 18"/>','<path d="m6 6 12 12"/>'],
  arrowRight: ['<path d="M5 12h14"/>','<path d="m12 5 7 7-7 7"/>'],
  arrowDown: ['<path d="M12 5v14"/>','<path d="m19 12-7 7-7-7"/>'],
  lock: ['<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>','<path d="M7 11V7a5 5 0 0 1 10 0v4"/>'],
  user: ['<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>','<circle cx="12" cy="7" r="4"/>'],
  gift: ['<rect x="3" y="8" width="18" height="4" rx="1"/>','<path d="M12 8v13"/>','<path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/>','<path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>'],
  briefcase: ['<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>','<rect width="20" height="14" x="2" y="6" rx="2"/>'],
  phone: ['<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384z"/>'],
  mail: ['<rect width="20" height="16" x="2" y="4" rx="2"/>','<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'],
  plane: ['<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>'],
  bed: ['<path d="M2 4v16"/>','<path d="M2 8h18a2 2 0 0 1 2 2v10"/>','<path d="M2 17h20"/>','<path d="M6 8v9"/>'],
  utensils: ['<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>','<path d="M7 2v20"/>','<path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>'],
  car: ['<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 13 1 14 1 15v1c0 .6.4 1 1 1h2"/>','<circle cx="7" cy="17" r="2"/>','<path d="M9 17h6"/>','<circle cx="17" cy="17" r="2"/>'],
  ticket: ['<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>','<path d="M13 5v2"/>','<path d="M13 17v2"/>','<path d="M13 11v2"/>'],
  wallet: ['<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/>','<path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'],
  route: ['<circle cx="6" cy="19" r="3"/>','<path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>','<circle cx="18" cy="5" r="3"/>'],
  key: ['<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/>','<path d="m21 2-9.6 9.6"/>','<circle cx="7.5" cy="15.5" r="5.5"/>'],
  sofa: ['<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/>','<path d="M2 11a2 2 0 0 1 2 2v3h16v-3a2 2 0 0 1 2-2 2 2 0 0 0-2-2 2 2 0 0 0-2 2v3H6v-3a2 2 0 0 0-2-2 2 2 0 0 0-2 2z"/>','<path d="M4 18v2"/>','<path d="M20 18v2"/>'],
  users: ['<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>','<circle cx="9" cy="7" r="4"/>','<path d="M22 21v-2a4 4 0 0 0-3-3.87"/>','<path d="M16 3.13a4 4 0 0 1 0 7.75"/>'],
  receipt: ['<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>','<path d="M8 7h8"/>','<path d="M8 11h8"/>','<path d="M8 15h5"/>'],
  question: ['<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>','<path d="M12 17h.01"/>','<circle cx="12" cy="12" r="10"/>'],
  chevron: ['<path d="m9 18 6-6-6-6"/>'],
  alert: ['<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>','<path d="M12 9v4"/>','<path d="M12 17h.01"/>'],
  clock: ['<circle cx="12" cy="12" r="10"/>','<polyline points="12 6 12 12 16 14"/>'],
  zap: ['<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>'],
  inbox: ['<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>','<path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'],
  navigation: ['<path d="M12 2 4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>'],
  compass: ['<circle cx="12" cy="12" r="10"/>','<polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>'],
  moon: ['<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>','<path d="M19 3v4"/>','<path d="M21 5h-4"/>'],
  sparkle: ['<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>'],
  pin: ['<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>','<circle cx="12" cy="10" r="3"/>'],
  star: ['<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'],
  video: ['<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/>','<rect x="2" y="6" width="14" height="12" rx="2"/>'],
};

export function Icon({ name, size = 16, sw = 1.75, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: 'none', display: 'block', ...style }}
      dangerouslySetInnerHTML={{ __html: (P[name] || []).join('') }} />
  );
}

export const ICON_NAMES = Object.keys(P);
