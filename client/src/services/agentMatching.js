/**
 * Agent Matching Service
 * Mock agent database + matching logic.
 * No API calls — deterministic matching based on user criteria.
 */

export const MOCK_AGENTS = [
  {
    id: 'agent-001',
    name: 'Sarah Chen',
    photo: null,
    initials: 'SC',
    title: 'Buyer Specialist',
    brokerage: 'HomeMatch Realty',
    yearsExperience: 12,
    rating: 4.9,
    reviewCount: 187,
    specialties: ['first-time buyers', 'condos', 'urban'],
    areas: ['Indianapolis', 'Carmel', 'Fishers', 'Noblesville'],
    languages: ['English', 'Mandarin'],
    bio: 'Helping first-time buyers navigate their journey with confidence. Specializing in urban condos and starter homes.',
    responseTime: '< 1 hour',
    closedDeals: 342,
    avgNegotiationSavings: 3.2,
    phone: '(317) 555-0142',
    email: 'sarah.chen@homematch.com',
  },
  {
    id: 'agent-002',
    name: 'Marcus Johnson',
    photo: null,
    initials: 'MJ',
    title: 'Senior Agent',
    brokerage: 'HomeMatch Realty',
    yearsExperience: 18,
    rating: 4.8,
    reviewCount: 256,
    specialties: ['luxury', 'investment', 'single-family'],
    areas: ['Austin', 'Round Rock', 'Cedar Park', 'Georgetown'],
    languages: ['English', 'Spanish'],
    bio: 'Luxury and investment property expert with 18 years helping clients build wealth through real estate.',
    responseTime: '< 2 hours',
    closedDeals: 520,
    avgNegotiationSavings: 4.1,
    phone: '(512) 555-0198',
    email: 'marcus.j@homematch.com',
  },
  {
    id: 'agent-003',
    name: 'Emily Rodriguez',
    photo: null,
    initials: 'ER',
    title: 'Relocation Specialist',
    brokerage: 'HomeMatch Realty',
    yearsExperience: 8,
    rating: 4.9,
    reviewCount: 143,
    specialties: ['relocation', 'families', 'suburban'],
    areas: ['Miami', 'Fort Lauderdale', 'Coral Gables', 'Boca Raton'],
    languages: ['English', 'Spanish', 'Portuguese'],
    bio: 'Trilingual relocation expert making moves stress-free. Specializing in family-friendly neighborhoods.',
    responseTime: '< 30 min',
    closedDeals: 198,
    avgNegotiationSavings: 2.8,
    phone: '(305) 555-0167',
    email: 'emily.r@homematch.com',
  },
  {
    id: 'agent-004',
    name: 'David Kim',
    photo: null,
    initials: 'DK',
    title: 'Tech-Forward Agent',
    brokerage: 'HomeMatch Realty',
    yearsExperience: 6,
    rating: 4.7,
    reviewCount: 98,
    specialties: ['first-time buyers', 'townhomes', 'virtual tours'],
    areas: ['Denver', 'Boulder', 'Aurora', 'Lakewood'],
    languages: ['English', 'Korean'],
    bio: 'Digital-first agent who makes home buying seamless. Expert in virtual tours and remote closings.',
    responseTime: '< 1 hour',
    closedDeals: 145,
    avgNegotiationSavings: 2.5,
    phone: '(720) 555-0134',
    email: 'david.k@homematch.com',
  },
  {
    id: 'agent-005',
    name: 'Rachel Thompson',
    photo: null,
    initials: 'RT',
    title: 'Neighborhood Expert',
    brokerage: 'HomeMatch Realty',
    yearsExperience: 15,
    rating: 4.8,
    reviewCount: 210,
    specialties: ['neighborhoods', 'schools', 'families'],
    areas: ['Chicago', 'Evanston', 'Naperville', 'Schaumburg'],
    languages: ['English'],
    bio: 'Deep neighborhood knowledge — I match families with the perfect community, school district, and lifestyle.',
    responseTime: '< 1 hour',
    closedDeals: 380,
    avgNegotiationSavings: 3.5,
    phone: '(312) 555-0156',
    email: 'rachel.t@homematch.com',
  },
  {
    id: 'agent-006',
    name: 'James Wilson',
    photo: null,
    initials: 'JW',
    title: 'Negotiation Expert',
    brokerage: 'HomeMatch Realty',
    yearsExperience: 20,
    rating: 4.9,
    reviewCount: 312,
    specialties: ['negotiation', 'luxury', 'investment'],
    areas: ['New York', 'Brooklyn', 'Queens', 'Jersey City'],
    languages: ['English', 'French'],
    bio: '20 years of deal-making expertise. Known for aggressive negotiation that saves buyers thousands.',
    responseTime: '< 2 hours',
    closedDeals: 680,
    avgNegotiationSavings: 5.2,
    phone: '(212) 555-0189',
    email: 'james.w@homematch.com',
  },
  {
    id: 'agent-007',
    name: 'Priya Patel',
    photo: null,
    initials: 'PP',
    title: 'First-Time Buyer Guide',
    brokerage: 'HomeMatch Realty',
    yearsExperience: 9,
    rating: 4.8,
    reviewCount: 167,
    specialties: ['first-time buyers', 'FHA loans', 'condos'],
    areas: ['San Francisco', 'Oakland', 'San Jose', 'Fremont'],
    languages: ['English', 'Hindi', 'Gujarati'],
    bio: 'Patient, thorough guide for first-time buyers. Expert in FHA loans and creative financing options.',
    responseTime: '< 1 hour',
    closedDeals: 215,
    avgNegotiationSavings: 3.0,
    phone: '(415) 555-0145',
    email: 'priya.p@homematch.com',
  },
  {
    id: 'agent-008',
    name: 'Tom Martinez',
    photo: null,
    initials: 'TM',
    title: 'Military & VA Specialist',
    brokerage: 'HomeMatch Realty',
    yearsExperience: 11,
    rating: 4.9,
    reviewCount: 178,
    specialties: ['VA loans', 'military relocation', 'suburban'],
    areas: ['San Diego', 'Oceanside', 'Carlsbad', 'El Cajon'],
    languages: ['English', 'Spanish'],
    bio: 'Former Marine turned real estate expert. Specializing in VA loans and military relocations.',
    responseTime: '< 30 min',
    closedDeals: 290,
    avgNegotiationSavings: 3.8,
    phone: '(619) 555-0172',
    email: 'tom.m@homematch.com',
  },
];

/**
 * Match agents based on user criteria.
 *
 * @param {Object} params
 * @param {string} params.city        - User's target city
 * @param {string} params.stateCode   - User's target state
 * @param {boolean} params.firstTime  - Is first-time buyer?
 * @param {number} params.budget      - Max budget
 * @param {string} params.propType    - Preferred property type
 * @returns {Object[]} Matched agents sorted by relevance (top 3)
 */
export function matchAgents({ city = '', stateCode = '', firstTime = true, budget = 0, propType = '' } = {}) {
  const scored = MOCK_AGENTS.map(agent => {
    let score = 0;

    // Area match (highest weight)
    const cityLower = city.toLowerCase();
    if (agent.areas.some(a => a.toLowerCase() === cityLower)) {
      score += 30;
    } else if (agent.areas.some(a => a.toLowerCase().includes(cityLower) || cityLower.includes(a.toLowerCase()))) {
      score += 15;
    }

    // First-time buyer match
    if (firstTime && agent.specialties.includes('first-time buyers')) {
      score += 20;
    }

    // Property type match
    if (propType) {
      const pt = propType.toLowerCase();
      if (agent.specialties.some(s => s.includes(pt) || pt.includes(s))) {
        score += 10;
      }
    }

    // Budget-based matching
    if (budget >= 750000 && agent.specialties.includes('luxury')) {
      score += 10;
    } else if (budget < 300000 && agent.specialties.includes('first-time buyers')) {
      score += 10;
    }

    // General quality score bonus
    score += agent.rating * 2;
    score += Math.min(10, agent.yearsExperience);

    return { ...agent, matchScore: Math.round(score) };
  });

  // Sort by match score descending, return top 3
  scored.sort((a, b) => b.matchScore - a.matchScore);
  return scored.slice(0, 3);
}

/**
 * Get a single agent by ID
 */
export function getAgent(agentId) {
  return MOCK_AGENTS.find(a => a.id === agentId) || null;
}

/**
 * Get verified tour lead model info (flat-fee model — no commission splits)
 */
export function getReferralInfo() {
  return {
    buyerCost: 0,
    agentFlatFee: 200,
    model: 'verified-tour-lead',
    explanation: 'HomeMatch is free for buyers. Agents pay a flat fee of $200 per verified completed tour — no commission splits, no closing-based fees. This ensures agents receive only qualified, educated, tour-ready buyers.',
    faq: [
      { q: 'Is HomeMatch free for buyers?', a: 'Yes. HomeMatch is completely free for home buyers. Our revenue comes from a flat fee paid by partner agents for verified tour leads.' },
      { q: 'What does the agent pay?', a: 'Partner agents pay a flat $200 fee per verified completed tour. There are no commission splits or closing-based fees.' },
      { q: 'How are tours verified?', a: 'Tours are verified through our platform when both the buyer and agent confirm tour completion. Buyers must complete our AI qualification process before requesting a tour.' }
    ]
  };
}
