// ─── Mock Data for HomePage ──────────────────────────────────────────

export const HOW_IT_WORKS = [
  {
    num: 1,
    title: 'Set Your Budget',
    description:
      'AI-powered affordability analysis tells you exactly what you can afford — including taxes, insurance, and HOA — in under 60 seconds.',
    icon: 'dollar',
  },
  {
    num: 2,
    title: 'Find Your Match',
    description:
      'Our AI scores every listing by how well it fits your lifestyle, budget, and priorities. No more endless scrolling.',
    icon: 'heart',
  },
  {
    num: 3,
    title: 'Move In With Confidence',
    description:
      'From offer strategy to closing day, HomeMatch guides every step so you never feel lost in the process.',
    icon: 'home',
  },
];

export const TESTIMONIALS = [
  {
    id: 1,
    quote:
      'HomeMatch found us a home we never would have discovered on our own. The AI scoring was spot-on with what we actually wanted.',
    author: 'Sarah & James K.',
    location: 'Indianapolis, IN',
    rating: 5,
    tag: 'First-Time Buyer',
  },
  {
    id: 2,
    quote:
      'The budget tool alone saved us from making a huge mistake. We thought we could afford $350k but HomeMatch showed us $290k was our sweet spot.',
    author: 'Marcus T.',
    location: 'Carmel, IN',
    rating: 5,
    tag: 'Budget Planning',
  },
  {
    id: 3,
    quote:
      'I was skeptical about AI in real estate, but the offer intelligence feature helped us win in a multiple-offer situation. Incredible tool.',
    author: 'Priya & Dev R.',
    location: 'Fishers, IN',
    rating: 5,
    tag: 'Offer Strategy',
  },
];

export const PARTNER_LOGOS = [
  { id: 1, name: 'Meridian Realty', initials: 'MR' },
  { id: 2, name: 'Summit Homes', initials: 'SH' },
  { id: 3, name: 'Keystone Group', initials: 'KG' },
  { id: 4, name: 'Blue River RE', initials: 'BR' },
  { id: 5, name: 'Apex Partners', initials: 'AP' },
  { id: 6, name: 'Northside Realty', initials: 'NR' },
];

export const PREMIUM_FEATURES = [
  { title: 'AI Offer Strategy', description: 'Know exactly how to price your offer to win in any market.' },
  { title: 'Market Trend Insights', description: 'See neighborhood price trends and appreciation forecasts.' },
  { title: 'Priority Agent Response', description: 'Get matched agents to respond within 30 minutes.' },
  { title: 'Buyer Readiness Report', description: 'Comprehensive PDF report to share with lenders and agents.' },
];

/**
 * Deterministic mock stat: "buyers looking in <city>"
 * Uses a hash of the city name to produce a stable number.
 */
export function getBuyersLooking(city) {
  if (!city) return 87;
  let hash = 0;
  for (let i = 0; i < city.length; i++) {
    hash = ((hash << 5) - hash) + city.charCodeAt(i);
    hash |= 0;
  }
  return 50 + Math.abs(hash % 200);
}
