import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { generateMatchExplanation, generateBadges, generateOfferStrength } from '../services/aiExplanations';
import { matchAgents } from '../services/agentMatching';
import { getBuyersLooking } from '../services/mockData';
import CityMultiSelect from './CityMultiSelect';
import SmartFinderWizard from './SmartFinderWizard';
import BudgetWizard from './BudgetWizard';
import { US_STATES } from '../utils/stateCenters';
import API_BASE from '../utils/apiBase';
import './StartWizard.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Safely parse a fetch response as JSON; throws a readable error if it fails. */
async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // Proxy error or non-JSON response
    if (text.includes('Proxy error') || text.includes('ECONNREFUSED')) {
      throw new Error('Cannot reach the server — make sure the backend is running.');
    }
    throw new Error(res.ok ? 'Unexpected server response' : `Server error (${res.status})`);
  }
}

function formatLotSize(lotSqft) {
  if (!lotSqft || lotSqft <= 0) return null;
  const acres = lotSqft / 43560;
  if (acres >= 10) return `${Math.round(acres)} acres`;
  if (acres >= 1) return `${acres.toFixed(1).replace(/\.0$/, '')} acres`;
  return `${acres.toFixed(2).replace(/0$/, '')} acres`;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'budget', label: 'Budget', sublabel: 'Know your numbers' },
  { id: 'match',  label: 'Match',  sublabel: 'Find your home' },
  { id: 'tour',   label: 'Tour',   sublabel: 'Connect with agents' },
  { id: 'move',   label: 'Move',   sublabel: 'Plan ahead' },
];

const TOUR_TIMELINE_OPTIONS = [
  { value: 'asap',         label: 'ASAP' },
  { value: '1-2weeks',     label: '1-2 Weeks' },
  { value: '1month',       label: '1 Month' },
  { value: 'justbrowsing', label: 'Just Browsing' },
];

const TIME_SLOTS = [
  { value: 'morning',   label: 'Morning (9am-12pm)' },
  { value: 'afternoon', label: 'Afternoon (12pm-4pm)' },
  { value: 'evening',   label: 'Evening (4pm-7pm)' },
];

const MOVE_CATEGORIES = [
  {
    id: 'utilities',
    title: 'Utilities Setup',
    icon: '\u26A1',
    items: ['Transfer electricity', 'Set up gas service', 'Schedule water/sewer', 'Internet & cable setup', 'Trash collection signup'],
  },
  {
    id: 'address',
    title: 'Address Changes',
    icon: '\uD83D\uDCEC',
    items: ['Update USPS forwarding', "Update driver's license", 'Update bank accounts', 'Update insurance policies', 'Notify employer'],
  },
  {
    id: 'movers',
    title: 'Moving Logistics',
    icon: '\uD83D\uDCE6',
    items: ['Get moving quotes', 'Book moving date', 'Pack non-essentials early', 'Label boxes by room', 'Clean old residence'],
  },
  {
    id: 'insurance',
    title: 'Insurance & Docs',
    icon: '\uD83D\uDEE1\uFE0F',
    items: ["Homeowner's insurance", 'Title insurance review', 'Home warranty consideration', 'Document safe storage', 'Emergency contacts list'],
  },
];

const CLOSING_CHECKLIST = [
  { id: 'preapproval',   label: 'Pre-Approval',     timeline: 'Week 1',   status: 'pending' },
  { id: 'inspection',    label: 'Home Inspection',   timeline: 'Week 2',   status: 'pending' },
  { id: 'appraisal',     label: 'Appraisal',         timeline: 'Week 3',   status: 'pending' },
  { id: 'finalwalk',     label: 'Final Walkthrough',  timeline: 'Week 4-5', status: 'pending' },
  { id: 'closing',       label: 'Closing Day',        timeline: 'Week 5-6', status: 'pending' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null || isNaN(n)) return '--';
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}


function getMilestoneDescription(id) {
  const map = {
    'preapproval': 'A lender reviews your finances and confirms how much you can borrow.',
    'inspection': 'A professional evaluates the home\'s condition and identifies issues.',
    'appraisal': 'The lender orders an independent valuation to confirm the home\'s worth.',
    'finalwalk': 'Your last chance to verify the property condition before closing.',
    'closing': 'Sign the final paperwork, transfer funds, and receive your keys.',
  };
  return map[id] || 'Complete this step to move forward in the buying process.';
}

function getMilestonePrep(id) {
  const map = {
    'preapproval': 'Gather pay stubs, tax returns, bank statements, and ID.',
    'inspection': 'Budget $300-500. Attend the inspection if possible.',
    'appraisal': 'No action needed from you \u2014 the lender handles this.',
    'finalwalk': 'Check all agreed repairs. Test appliances, plumbing, electrical.',
    'closing': 'Bring government ID, cashier\'s check for closing costs, and a pen.',
  };
  return map[id] || 'Contact your agent for specific guidance on this step.';
}

function getMilestoneAITip(id) {
  const map = {
    'preapproval': 'Get pre-approved before house hunting \u2014 it shows sellers you\'re serious.',
    'inspection': 'Never skip the inspection. It\'s your biggest negotiation leverage.',
    'appraisal': 'If the appraisal comes in low, you can renegotiate the price.',
    'finalwalk': 'Document everything with photos during the walkthrough.',
    'closing': 'Wire fraud is real \u2014 always verify wire instructions by phone.',
  };
  return map[id] || 'Consult with your agent for personalized advice.';
}

// ─── Main Component ──────────────────────────────────────────────────────────

function StartWizard() {
  const navigate = useNavigate();
  const toast = useToast();

  // ── Persistent state from localStorage ──
  const savedState = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('hm_wizard_state') || '{}');
    } catch {
      return {};
    }
  }, []);

  const [currentStep, setCurrentStep] = useState(savedState.currentStep || 0);

  // ── Step 1: Budget State ──
  const [income, setIncome] = useState(Number(savedState.income) || 0);
  const [monthlyDebts, setMonthlyDebts] = useState(Number(savedState.monthlyDebts) || 0);
  const [downPayment, setDownPayment] = useState(Number(savedState.downPayment) || 0);
  const [interestRate, setInterestRate] = useState(savedState.interestRate || '6.5');
  const [creditRange, setCreditRange] = useState(savedState.creditRange || 'good');
  const [timeline, setTimeline] = useState(savedState.timeline || 'flexible');
  const [budgetCalculated, setBudgetCalculated] = useState(false);

  // Computed budget values
  const [maxBudget, setMaxBudget] = useState(null);
  const [monthlyBreakdown, setMonthlyBreakdown] = useState(null);
  const [readinessScore, setReadinessScore] = useState(null);
  const [readinessInsights, setReadinessInsights] = useState([]);

  // ── Step 2: Match State ──
  const [city, setCity] = useState(savedState.city || '');
  const [state, setState] = useState(savedState.state || '');
  const [beds, setBeds] = useState(savedState.beds || '');
  const [baths, setBaths] = useState(savedState.baths || '');
  const [propType, setPropType] = useState(savedState.propType || '');
  const [priceMin, setPriceMin] = useState(savedState.priceMin || '');
  const [priceMax, setPriceMax] = useState(savedState.priceMax || '');
  const [sortBy, setSortBy] = useState(savedState.sortBy || 'relevance');
  const [sqftMin, setSqftMin] = useState(savedState.sqftMin || '');
  const [features, setFeatures] = useState(savedState.features || []);
  const [showFilters, setShowFilters] = useState(false);
  const [matchResults, setMatchResults] = useState([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCities, setSelectedCities] = useState(savedState.selectedCities || []);
  const [selectedListings, setSelectedListings] = useState(savedState.selectedListings || []);
  const [compareMode, setCompareMode] = useState(false);
  const [quickViewListing, setQuickViewListing] = useState(null);
  const [qvPhotos, setQvPhotos] = useState([]);
  const [qvPhotoIndex, setQvPhotoIndex] = useState(0);
  const [qvPhotosLoading, setQvPhotosLoading] = useState(false);

  // ── Step 2: Smart Finder State ──
  const [searchMode, setSearchMode] = useState(savedState.searchMode || 'normal');
  const [smartQuery, setSmartQuery] = useState(savedState.smartQuery || '');
  const [smartChips, setSmartChips] = useState([]);
  const [smartConfidence, setSmartConfidence] = useState(null);
  const [smartQuestions, setSmartQuestions] = useState([]);
  const [smartParsing, setSmartParsing] = useState(false);

  // ── Step 3: Tour State ──
  const [tourForm, setTourForm] = useState({
    name: savedState.tourName || '',
    email: savedState.tourEmail || '',
    phone: savedState.tourPhone || '',
    timeline: savedState.tourTimeline || '',
    preapproved: savedState.tourPreapproved || false,
    message: savedState.tourMessage || '',
    preferredDate: '',
    preferredTime: '',
  });
  const [tourSubmitting, setTourSubmitting] = useState(false);
  const [tourSubmitted, setTourSubmitted] = useState(false);
  const [matchedAgents, setMatchedAgents] = useState([]);

  // ── Step 4: Move State ──
  const [moveEstimate, setMoveEstimate] = useState(null);
  const [movePlan, setMovePlan] = useState(null);
  const [moveLoading, setMoveLoading] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [closingChecklist, setClosingChecklist] = useState(CLOSING_CHECKLIST.map(item => ({ ...item })));
  // ── Step 4: Move Upgraded State ──
  const [expandedMoveCategories, setExpandedMoveCategories] = useState(['utilities']);
  const [moveCategoryChecks, setMoveCategoryChecks] = useState({});

  const toggleMoveCategory = useCallback((catId) => {
    setExpandedMoveCategories(prev => 
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  }, []);

  const toggleMoveCategoryItem = useCallback((catId, itemIdx) => {
    setMoveCategoryChecks(prev => {
      const cat = prev[catId] ? [...prev[catId]] : new Array(MOVE_CATEGORIES.find(c => c.id === catId)?.items.length || 0).fill(false);
      cat[itemIdx] = !cat[itemIdx];
      return { ...prev, [catId]: cat };
    });
  }, []);

  const moveReadinessPercent = useMemo(() => {
    let total = 0;
    let checked = 0;
    MOVE_CATEGORIES.forEach(cat => {
      total += cat.items.length;
      checked += (moveCategoryChecks[cat.id] || []).filter(Boolean).length;
    });
    return total > 0 ? Math.round((checked / total) * 100) : 0;
  }, [moveCategoryChecks]);


  // ── Fetch photos when quick view modal opens ──
  useEffect(() => {
    if (!quickViewListing) {
      setQvPhotos([]);
      setQvPhotoIndex(0);
      return;
    }
    // Start with whatever photos are already on the listing object
    const inlinePhotos = quickViewListing.photos && quickViewListing.photos.length > 0
      ? quickViewListing.photos
      : [quickViewListing.thumbnail || quickViewListing.photo].filter(Boolean);
    setQvPhotos(inlinePhotos);
    setQvPhotoIndex(0);

    // Then try to fetch the full gallery from the API
    if (quickViewListing.property_id) {
      setQvPhotosLoading(true);
      fetch(`${API_BASE}/api/listings/photos/${quickViewListing.property_id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.photos && data.photos.length > 0) {
            setQvPhotos(data.photos);
          }
        })
        .catch(() => { /* keep inline photos */ })
        .finally(() => setQvPhotosLoading(false));
    }
  }, [quickViewListing]);

  // ── Persist to localStorage ──
  useEffect(() => {
    const stateToSave = {
      currentStep,
      income,
      monthlyDebts,
      downPayment,
      interestRate,
      creditRange,
      timeline,
      city,
      state,
      beds,
      baths,
      propType,
      priceMin,
      priceMax,
      sortBy,
      sqftMin,
      features,
      selectedListings,
      tourName: tourForm.name,
      tourEmail: tourForm.email,
      tourPhone: tourForm.phone,
      tourTimeline: tourForm.timeline,
      tourPreapproved: tourForm.preapproved,
      tourMessage: tourForm.message,
      searchMode,
      smartQuery,
      selectedCities,
    };
    localStorage.setItem('hm_wizard_state', JSON.stringify(stateToSave));
  }, [
    currentStep, income, monthlyDebts, downPayment, interestRate,
    creditRange, timeline, city, state, beds, baths, propType, priceMin, priceMax, sortBy, sqftMin, features, selectedListings, tourForm,
    searchMode, smartQuery, selectedCities,
  ]);

  // ── Step navigation ──
  const goToStep = useCallback((step) => {
    if (step <= currentStep) setCurrentStep(step);
  }, [currentStep]);

  const goNext = useCallback(() => {
    if (currentStep === 0 && !budgetCalculated) {
      toast.warning('Calculate your budget first');
      return;
    }
    if (currentStep === 1 && selectedListings.length === 0) {
      toast.warning('Select at least one home');
      return;
    }
    if (currentStep === 3) {
      navigate('/homes');
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  }, [currentStep, budgetCalculated, selectedListings, navigate, toast]);

  const goPrev = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1: Budget — now handled inside BudgetWizard component
  // ══════════════════════════════════════════════════════════════════════════

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2: Match handlers
  // ══════════════════════════════════════════════════════════════════════════

  const handleMatchSearch = useCallback(async () => {
    if (selectedCities.length === 0 || !state.trim()) {
      toast.warning('Select at least one city to search');
      return;
    }
    setMatchLoading(true);
    try {
      const searchRes = await fetch(`${API_BASE}/api/listings/search-multi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cities: selectedCities,
          state_code: state.trim(),
          filters: {
            price_min: priceMin || undefined,
            price_max: priceMax || maxBudget || undefined,
            beds: beds || undefined,
            baths: baths || undefined,
            prop_type: propType || undefined,
            sort: (sortBy && sortBy !== 'relevance') ? sortBy : undefined,
            sqft_min: sqftMin || undefined,
            has_pool: features.includes('pool') ? 'true' : undefined,
            has_garage: features.includes('garage') ? 'true' : undefined,
          },
        }),
      });
      const data = await safeJson(searchRes);
      if (!searchRes.ok) throw new Error(data.error || 'Search failed');
      const results = data.results || [];
      setMatchResults(results);
      setHasSearched(true);
      toast.success(`Found ${results.length} homes in ${selectedCities.length} ${selectedCities.length === 1 ? 'city' : 'cities'}!`);
    } catch (err) {
      toast.error(err.message || 'Search failed -- try again.');
    } finally {
      setMatchLoading(false);
    }
  }, [selectedCities, state, beds, baths, propType, priceMin, priceMax, sortBy, sqftMin, features, maxBudget, toast]);

  // ── Smart Finder: Intent → Search Params mapper ──
  const mapIntentToSearchParams = useCallback((intent) => {
    const params = new URLSearchParams();
    if (intent.location.city) params.set('city', intent.location.city);
    if (intent.location.state) params.set('state_code', intent.location.state);
    if (intent.budget.min > 0) params.set('price_min', intent.budget.min);
    if (intent.budget.max > 0) params.set('price_max', intent.budget.max);
    else if (maxBudget) params.set('price_max', maxBudget);
    if (intent.bedrooms != null) params.set('beds', intent.bedrooms);
    if (intent.bathrooms != null) params.set('baths', intent.bathrooms);
    if (intent.propertyType && intent.propertyType !== 'any') {
      params.set('prop_type', intent.propertyType);
    }
    if (intent.constraints && intent.constraints.sqftMin) {
      params.set('sqft_min', intent.constraints.sqftMin);
    }
    if (intent.constraints && intent.constraints.lotSizeMin) {
      params.set('lot_sqft_min', intent.constraints.lotSizeMin);
    }
    // Extract pool/garage from must-have/nice-to-have (these have dedicated API params)
    [...(intent.mustHave || []), ...(intent.niceToHave || [])].forEach((item) => {
      const lower = item.toLowerCase();
      if (lower.includes('pool')) params.set('has_pool', 'true');
      else if (lower.includes('garage')) params.set('has_garage', 'true');
    });
    return params;
  }, [maxBudget]);

  // ── Smart Finder: Search handler ──
  const handleSmartSearch = useCallback(async () => {
    if (!smartQuery.trim()) {
      toast.warning('Describe what you\'re looking for');
      return;
    }

    // Phase 1: Parse the natural language
    setSmartParsing(true);
    setSmartChips([]);
    setSmartConfidence(null);
    setSmartQuestions([]);

    try {
      const parseRes = await fetch(`${API_BASE}/api/intent/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryText: smartQuery.trim() }),
      });
      const parseData = await safeJson(parseRes);

      if (parseData.error) {
        toast.error('Could not understand your search');
        setSmartParsing(false);
        return;
      }

      const { intent, chips, confidence } = parseData;
      setSmartChips(chips || []);
      setSmartConfidence(confidence);
      setSmartQuestions(intent.clarifyingQuestions || []);
      setSmartParsing(false);

      // Validate: city is required by the real API
      if (!intent.location.city) {
        toast.warning('Please include a city in your search (e.g. "house in Fishers, Indiana")');
        return;
      }

      // Phase 2: Execute real search with mapped params
      setMatchLoading(true);

      // Resolve location for consistency
      const locQuery = `${intent.location.city || ''}, ${intent.location.state || ''}`.trim();
      const resolveRes = await fetch(
        `/api/location/resolve?q=${encodeURIComponent(locQuery)}`
      );
      const resolved = await safeJson(resolveRes);
      if (!resolveRes.ok) throw new Error(resolved.error || 'Could not resolve location');
      intent.location.city = resolved.city || intent.location.city;
      intent.location.state = resolved.stateCode || intent.location.state;

      const params = mapIntentToSearchParams(intent);
      const searchRes = await fetch(`${API_BASE}/api/listings/search?${params}`);
      const data = await safeJson(searchRes);
      if (!searchRes.ok) throw new Error(data.error || 'Search failed');
      const results = data.results || data.listings || [];
      setMatchResults(results);
      setHasSearched(true);
      toast.success(`Found ${results.length} homes!`);
    } catch (err) {
      toast.error(err.message || 'Smart search failed -- try again.');
    } finally {
      setSmartParsing(false);
      setMatchLoading(false);
    }
  }, [smartQuery, mapIntentToSearchParams, toast]);

  // ── Smart Finder Guided Wizard: Search handler ──
  const handleSmartFinderSearch = useCallback(async (selections) => {
    const {
      state: sfState, cities, propType: sfPropType,
      beds: sfBeds, baths: sfBaths, features: sfFeatures,
      priorities: sfPriorities,
      minSqft, minLot, minGarage, yearBuilt, noHoa,
    } = selections;
    if (!sfState || cities.length === 0) {
      toast.warning('Select at least one city');
      return;
    }
    setMatchLoading(true);
    try {
      // Build filters from both feature priorities and deep search params
      const filters = {
        price_max: maxBudget || undefined,
        beds: sfBeds || undefined,
        baths: sfBaths || undefined,
        prop_type: sfPropType || undefined,
        // Feature-based filters from priorities
        has_pool: sfFeatures.includes('pool') ? 'true' : undefined,
        has_garage: sfFeatures.includes('garage') || minGarage ? 'true' : undefined,
        // Deep search filters
        sqft_min: minSqft || undefined,
        lot_sqft_min: minLot || undefined,
        garage_min: minGarage || undefined,
        year_built_min: yearBuilt || undefined,
        no_hoa: noHoa || undefined,
      };

      const searchRes = await fetch(`${API_BASE}/api/listings/search-multi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cities, state_code: sfState, filters }),
      });
      const data = await safeJson(searchRes);
      if (!searchRes.ok) throw new Error(data.error || 'Search failed');
      const results = data.results || [];
      // Sync Smart Finder selections to parent state for results header
      setState(sfState);
      setSelectedCities(cities);
      if (sfPropType) setPropType(sfPropType);
      if (sfBeds) setBeds(sfBeds);
      if (sfBaths) setBaths(sfBaths);
      setFeatures(sfFeatures);
      setMatchResults(results);
      setHasSearched(true);
      toast.success(`Found ${results.length} homes in ${cities.length} ${cities.length === 1 ? 'city' : 'cities'}!`);
    } catch (err) {
      toast.error(err.message || 'Search failed -- try again.');
    } finally {
      setMatchLoading(false);
    }
  }, [maxBudget, toast]);

  const toggleListing = useCallback((listing) => {
    setSelectedListings((prev) => {
      const exists = prev.find((l) => l.property_id === listing.property_id);
      if (exists) return prev.filter((l) => l.property_id !== listing.property_id);
      if (prev.length >= 3 && !exists) {
        toast.warning('Max 3 homes for comparison');
        return prev;
      }
      return [...prev, listing];
    });
  }, [toast]);

  const isSelected = useCallback(
    (listing) => selectedListings.some((l) => l.property_id === listing.property_id),
    [selectedListings]
  );

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3: Tour handlers
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (currentStep === 2) {
      const agents = matchAgents({
        city: city,
        priceRange: maxBudget > 500000 ? 'luxury' : maxBudget > 200000 ? 'medium' : 'budget',
        timeline: timeline,
        buyerType: 'first-time',
      });
      setMatchedAgents(agents);
    }
  }, [currentStep, city, maxBudget, timeline]);

  const updateTourField = useCallback((field, value) => {
    setTourForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ── Buyer Qualification Gate ──
  const buyerQualified = useMemo(() => {
    return budgetCalculated && readinessScore && readinessScore.score > 0 && timeline && (tourForm.preapproved === true || tourForm.preapproved === false || tourForm.preapproved === 'yes' || tourForm.preapproved === 'no');
  }, [budgetCalculated, readinessScore, timeline, tourForm.preapproved]);

  const handleTourSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!tourForm.email) {
      toast.warning('Email is required');
      return;
    }
    // Buyer Qualification Gate: must complete full profile before requesting a tour
    if (!buyerQualified) {
      toast.warning('Please complete your budget profile and readiness assessment before requesting a tour.');
      return;
    }
    setTourSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/leads/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName: tourForm.name,
          buyerEmail: tourForm.email,
          buyerPhone: tourForm.phone,
          timeline: tourForm.timeline,
          preapproved: tourForm.preapproved,
          message: tourForm.message,
          preferredDate: tourForm.preferredDate,
          preferredTime: tourForm.preferredTime,
          readinessScore: readinessScore?.score || null,
          maxBudget: maxBudget || null,
          qualified: true,
          selectedListings: selectedListings.map((l) => ({
            property_id: l.property_id,
            address: l.address?.full,
            price: l.price,
          })),
          source: 'wizard',
        }),
      });
      if (res.ok) {
        const lead = await res.json();
        setTourSubmitted(true);
        toast.success('Tour requested! A verified HomeMatch Partner Agent will reach out soon.');

        // Fire-and-forget: notify the assigned agent about this new lead
        fetch(`${API_BASE}/api/notify/send-lead-alert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentEmail: lead.assignedAgent?.email || null,
            agentName: lead.assignedAgent?.name || null,
            lead: {
              leadId: lead.leadId || lead.id,
              buyerName: tourForm.name,
              buyerEmail: tourForm.email,
              buyerPhone: tourForm.phone,
              maxBudget: maxBudget || null,
              readinessScore: readinessScore?.score || null,
              preApproved: tourForm.preapproved,
              timeline: tourForm.timeline,
              message: tourForm.message,
              city: city || '',
              selectedListings: selectedListings.map((l) => ({
                property_id: l.property_id,
                address: l.address?.full || l.address,
                price: l.price,
              })),
            },
          }),
        }).catch((err) => console.warn('Lead alert notification failed:', err));
      }
    } catch {
      toast.error('Failed to submit -- try again.');
    } finally {
      setTourSubmitting(false);
    }
  }, [tourForm, selectedListings, toast, buyerQualified, readinessScore, maxBudget, city]);

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 4: Move handlers
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (currentStep === 3 && !moveEstimate) {
      setMoveLoading(true);
      Promise.all([
        fetch(`${API_BASE}/api/move/estimate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: { zip: '00000' },
            destination: { zip: '00000' },
            homeSize: { bedrooms: 3, sqft: 2000 },
            date: 'next month',
          }),
        }).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/api/move/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            moveDate: '2025-06-01',
            householdSize: 2,
            pets: false,
            specialItems: [],
          }),
        }).then((r) => r.json()).catch(() => null),
      ]).then(([est, plan]) => {
        setMoveEstimate(est);
        setMovePlan(plan);
        setMoveLoading(false);
      });
    }
  }, [currentStep, moveEstimate]);

  const toggleClosingItem = useCallback((id) => {
    setClosingChecklist((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: item.status === 'completed' ? 'pending' : 'completed' }
          : item
      )
    );
  }, []);

  const closingProgress = useMemo(() => {
    const done = closingChecklist.filter((c) => c.status === 'completed').length;
    return Math.round((done / closingChecklist.length) * 100);
  }, [closingChecklist]);

  const handleCopyShareLink = useCallback(() => {
    const fakeUrl = `https://homematch.io/share/${Date.now().toString(36)}`;
    navigator.clipboard.writeText(fakeUrl).then(() => {
      toast.success('Share link copied to clipboard!');
    }).catch(() => {
      toast.success('Share link: ' + fakeUrl);
    });
  }, [toast]);

  // ── Derived values ──
  const firstSelected = selectedListings.length > 0 ? selectedListings[0] : null;

  const offerStrength = useMemo(() => {
    if (!firstSelected || !maxBudget) return null;
    try {
      return generateOfferStrength({
        listingPrice: firstSelected.price,
        maxBudget: maxBudget,
        downPaymentPercent: downPayment && maxBudget ? (parseFloat(downPayment) / maxBudget * 100) : 10,
        creditRange: creditRange,
        preapproved: tourForm.preapproved,
        timeline: timeline,
      });
    } catch {
      return null;
    }
  }, [firstSelected, maxBudget, downPayment, creditRange, tourForm.preapproved, timeline]);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="sw-page page-enter">
      {/* ═══ STEPPER ═══ */}
      <div className="sw-stepper">
        <div className="sw-stepper-inner">
          {STEPS.map((step, i) => (
            <React.Fragment key={step.id}>
              {i > 0 && (
                <div className={`sw-connector ${i <= currentStep ? 'done' : ''}`} />
              )}
              <button
                className={`sw-step ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'completed' : ''} ${i > currentStep ? 'locked' : ''}`}
                onClick={() => goToStep(i)}
                type="button"
                aria-label={`Step ${i + 1}: ${step.label}`}
                aria-current={i === currentStep ? 'step' : undefined}
              >
                <div className="sw-step-dot">
                  {i < currentStep ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <div className="sw-step-info">
                  <span className="sw-step-label">{step.label}</span>
                  <span className="sw-step-sub">{step.sublabel}</span>
                </div>
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <div className="sw-content" key={currentStep}>

        {/* ─────────────────────────────────────────────────────────────────────
            STEP 1: BUDGET (Guided 3-Part Flow)
            ───────────────────────────────────────────────────────────────────── */}
        {currentStep === 0 && (
          <>
            <div className="sw-header">
              <h2>Set Your Budget</h2>
              <p>A quick guided walkthrough to find what you can comfortably afford</p>
            </div>

            <div className="sw-card sw-card-centered" style={{ maxWidth: 620 }}>
              <BudgetWizard
                income={income} setIncome={setIncome}
                monthlyDebts={monthlyDebts} setMonthlyDebts={setMonthlyDebts}
                downPayment={downPayment} setDownPayment={setDownPayment}
                interestRate={interestRate} setInterestRate={setInterestRate}
                creditRange={creditRange} setCreditRange={setCreditRange}
                timeline={timeline} setTimeline={setTimeline}
                maxBudget={maxBudget} setMaxBudget={setMaxBudget}
                monthlyBreakdown={monthlyBreakdown} setMonthlyBreakdown={setMonthlyBreakdown}
                readinessScore={readinessScore} setReadinessScore={setReadinessScore}
                readinessInsights={readinessInsights} setReadinessInsights={setReadinessInsights}
                budgetCalculated={budgetCalculated} setBudgetCalculated={setBudgetCalculated}
                onToast={(type, msg) => toast[type]?.(msg)}
              />
            </div>
          </>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            STEP 2: MATCH (Smart Home Search)
            ───────────────────────────────────────────────────────────────────── */}
        {currentStep === 1 && (
          <>
            <div className="sw-header">
              <h2>Find Your Match</h2>
              <p>
                Search for homes
                {maxBudget ? ` (budget up to ${fmt(maxBudget)})` : ''}
              </p>
              <div className="sw-mode-toggle">
                <button
                  type="button"
                  className={`sw-mode-btn ${searchMode === 'normal' ? 'active' : ''}`}
                  onClick={() => setSearchMode('normal')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  Normal Search
                </button>
                <button
                  type="button"
                  className={`sw-mode-btn ${searchMode === 'smart' ? 'active' : ''}`}
                  onClick={() => setSearchMode('smart')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  Smart Finder
                </button>
              </div>
            </div>

            {/* Search Bar — Normal Mode */}
            {searchMode === 'normal' && (
            <div className="sw-card sw-card-full" style={{ marginBottom: 20 }}>
              <div className="sw-search-row">
                <div className="sw-field" style={{ flex: '0 0 180px' }}>
                  <label className="input-label" htmlFor="sw-state-select">State</label>
                  <select
                    id="sw-state-select"
                    className="input-field"
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setCity('');
                      setSelectedCities([]);
                      setMatchResults([]);
                      setHasSearched(false);
                    }}
                    aria-label="Select a state"
                  >
                    <option value="">Select a state</option>
                    {US_STATES.map((s) => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="sw-field" style={{ flex: '0 0 150px' }}>
                  <label className="input-label" htmlFor="sw-proptype">Property Type</label>
                  <select
                    id="sw-proptype"
                    className="input-field"
                    value={propType}
                    onChange={(e) => setPropType(e.target.value)}
                    aria-label="Property type"
                  >
                    <option value="">All Types</option>
                    <option value="house">House</option>
                    <option value="condo">Condo</option>
                    <option value="townhome">Townhouse</option>
                    <option value="multi_family">Multi-Family</option>
                  </select>
                </div>
                <div className="sw-field" style={{ flex: '0 0 90px' }}>
                  <label className="input-label" htmlFor="sw-beds">Beds</label>
                  <select
                    id="sw-beds"
                    className="input-field"
                    value={beds}
                    onChange={(e) => setBeds(e.target.value)}
                    aria-label="Number of bedrooms"
                  >
                    <option value="">Any</option>
                    <option value="1">1+</option>
                    <option value="2">2+</option>
                    <option value="3">3+</option>
                    <option value="4">4+</option>
                    <option value="5">5+</option>
                  </select>
                </div>
                <div className="sw-field" style={{ flex: '0 0 90px' }}>
                  <label className="input-label" htmlFor="sw-baths">Baths</label>
                  <select
                    id="sw-baths"
                    className="input-field"
                    value={baths}
                    onChange={(e) => setBaths(e.target.value)}
                    aria-label="Number of bathrooms"
                  >
                    <option value="">Any</option>
                    <option value="1">1+</option>
                    <option value="2">2+</option>
                    <option value="3">3+</option>
                    <option value="4">4+</option>
                  </select>
                </div>
              </div>

              {/* City multi-select — appears after state is selected */}
              {state && (
                <div style={{ marginTop: 16 }}>
                  <CityMultiSelect
                    stateCode={state}
                    selectedCities={selectedCities}
                    onChange={setSelectedCities}
                    maxCities={5}
                  />
                </div>
              )}

              {/* Search button */}
              {state && (
                <div style={{ marginTop: 16 }}>
                  <button
                    className="btn btn-primary sw-search-btn"
                    onClick={handleMatchSearch}
                    disabled={matchLoading || selectedCities.length === 0}
                    type="button"
                    style={{ width: '100%', justifyContent: 'center', height: 48 }}
                  >
                    {matchLoading ? (
                      <><span className="sw-spinner" /> Searching...</>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.35-4.35" />
                        </svg>
                        Search {selectedCities.length > 0
                          ? `${selectedCities.length} ${selectedCities.length === 1 ? 'city' : 'cities'}`
                          : ''}
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Expandable filters row */}
              <div className="sw-filter-toggle-row">
                <button
                  className="sw-filter-toggle"
                  onClick={() => setShowFilters(!showFilters)}
                  type="button"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  {showFilters ? 'Hide Filters' : 'More Filters'}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: showFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  {(priceMin || priceMax || sortBy !== 'relevance' || sqftMin || features.length > 0) && (
                    <span className="sw-filter-badge">
                      {[priceMin, priceMax, sortBy !== 'relevance' && 'Sort', sqftMin].filter(Boolean).length + features.length}
                    </span>
                  )}
                </button>
                {features.length > 0 && (
                  <div className="sw-active-features">
                    {features.map(f => (
                      <span key={f} className="sw-active-chip">
                        {f.replace(/_/g, ' ')}
                        <button type="button" onClick={() => setFeatures(prev => prev.filter(x => x !== f))} aria-label={`Remove ${f}`}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {showFilters && (
                <div className="sw-filters-expanded">
                  {/* Price / Sort / Sqft row */}
                  <div className="sw-filters-grid">
                    <div className="sw-field">
                      <label className="input-label" htmlFor="sw-price-min">Min Price</label>
                      <select
                        id="sw-price-min"
                        className="input-field"
                        value={priceMin}
                        onChange={(e) => setPriceMin(e.target.value)}
                        aria-label="Minimum price"
                      >
                        <option value="">No Min</option>
                        <option value="50000">$50k</option>
                        <option value="100000">$100k</option>
                        <option value="150000">$150k</option>
                        <option value="200000">$200k</option>
                        <option value="250000">$250k</option>
                        <option value="300000">$300k</option>
                        <option value="350000">$350k</option>
                        <option value="400000">$400k</option>
                        <option value="450000">$450k</option>
                        <option value="500000">$500k</option>
                        <option value="600000">$600k</option>
                        <option value="700000">$700k</option>
                        <option value="800000">$800k</option>
                        <option value="900000">$900k</option>
                        <option value="1000000">$1M</option>
                        <option value="1500000">$1.5M</option>
                        <option value="2000000">$2M</option>
                      </select>
                    </div>
                    <div className="sw-field">
                      <label className="input-label" htmlFor="sw-price-max">Max Price</label>
                      <select
                        id="sw-price-max"
                        className="input-field"
                        value={priceMax}
                        onChange={(e) => setPriceMax(e.target.value)}
                        aria-label="Maximum price"
                      >
                        <option value="">{maxBudget ? `Budget (${fmt(maxBudget)})` : 'No Max'}</option>
                        <option value="100000">$100k</option>
                        <option value="150000">$150k</option>
                        <option value="200000">$200k</option>
                        <option value="250000">$250k</option>
                        <option value="300000">$300k</option>
                        <option value="350000">$350k</option>
                        <option value="400000">$400k</option>
                        <option value="450000">$450k</option>
                        <option value="500000">$500k</option>
                        <option value="600000">$600k</option>
                        <option value="700000">$700k</option>
                        <option value="800000">$800k</option>
                        <option value="900000">$900k</option>
                        <option value="1000000">$1M</option>
                        <option value="1250000">$1.25M</option>
                        <option value="1500000">$1.5M</option>
                        <option value="2000000">$2M</option>
                        <option value="3000000">$3M+</option>
                      </select>
                    </div>
                    <div className="sw-field">
                      <label className="input-label" htmlFor="sw-sqft-min">Min Sq Ft</label>
                      <select
                        id="sw-sqft-min"
                        className="input-field"
                        value={sqftMin}
                        onChange={(e) => setSqftMin(e.target.value)}
                        aria-label="Minimum square footage"
                      >
                        <option value="">Any Size</option>
                        <option value="500">500+ sqft</option>
                        <option value="750">750+ sqft</option>
                        <option value="1000">1,000+ sqft</option>
                        <option value="1250">1,250+ sqft</option>
                        <option value="1500">1,500+ sqft</option>
                        <option value="1750">1,750+ sqft</option>
                        <option value="2000">2,000+ sqft</option>
                        <option value="2500">2,500+ sqft</option>
                        <option value="3000">3,000+ sqft</option>
                        <option value="4000">4,000+ sqft</option>
                        <option value="5000">5,000+ sqft</option>
                      </select>
                    </div>
                    <div className="sw-field">
                      <label className="input-label" htmlFor="sw-sort">Sort By</label>
                      <select
                        id="sw-sort"
                        className="input-field"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        aria-label="Sort order"
                      >
                        <option value="relevance">Relevance</option>
                        <option value="price_low">Price: Low → High</option>
                        <option value="price_high">Price: High → Low</option>
                        <option value="newest">Newest First</option>
                        <option value="sqft">Largest First</option>
                      </select>
                    </div>
                  </div>

                  {/* Feature / Amenity chips */}
                  <div className="sw-features-section">
                    <label className="input-label">Features &amp; Amenities</label>
                    <div className="sw-feature-chips">
                      {[
                        { id: 'pool', label: 'Pool', icon: '🏊' },
                        { id: 'garage', label: 'Garage', icon: '🚗' },
                        { id: 'open_floor_plan', label: 'Open Floor Plan', icon: '🏠' },
                        { id: 'home_gym', label: 'Home Gym', icon: '🏋️' },
                        { id: 'heated_floors', label: 'Heated Floors', icon: '🔥' },
                        { id: 'smart_home', label: 'Smart Home', icon: '📱' },
                        { id: 'fireplace', label: 'Fireplace', icon: '🪵' },
                        { id: 'hardwood_floors', label: 'Hardwood Floors', icon: '🪵' },
                        { id: 'granite_countertops', label: 'Granite Counters', icon: '💎' },
                        { id: 'stainless_steel', label: 'Stainless Steel', icon: '🍳' },
                        { id: 'walk_in_closet', label: 'Walk-in Closet', icon: '👔' },
                        { id: 'home_office', label: 'Home Office', icon: '💻' },
                        { id: 'basement', label: 'Basement', icon: '🏗️' },
                        { id: 'waterfront', label: 'Waterfront', icon: '🌊' },
                        { id: 'mountain_view', label: 'Mountain View', icon: '⛰️' },
                        { id: 'solar', label: 'Solar Panels', icon: '☀️' },
                        { id: 'ev_charging', label: 'EV Charging', icon: '⚡' },
                        { id: 'wine_cellar', label: 'Wine Cellar', icon: '🍷' },
                        { id: 'outdoor_kitchen', label: 'Outdoor Kitchen', icon: '🔥' },
                        { id: 'guest_house', label: 'Guest House', icon: '🏡' },
                      ].map(feat => (
                        <button
                          key={feat.id}
                          type="button"
                          className={`sw-feature-chip ${features.includes(feat.id) ? 'active' : ''}`}
                          onClick={() => {
                            setFeatures(prev =>
                              prev.includes(feat.id) ? prev.filter(f => f !== feat.id) : [...prev, feat.id]
                            );
                          }}
                        >
                          <span className="sw-feature-chip-icon">{feat.icon}</span>
                          {feat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Search UI — Smart Finder Mode (Guided Wizard) */}
            {searchMode === 'smart' && (
              <div className="sw-card sw-card-full" style={{ marginBottom: 20 }}>
                <SmartFinderWizard
                  maxBudget={maxBudget}
                  onSearch={handleSmartFinderSearch}
                  searchLoading={matchLoading}
                  fmtPrice={fmt}
                />
              </div>
            )}

            {/* Results Header */}
            {!matchLoading && matchResults.length > 0 && (
              <div className="sw-match-header">
                <div className="sw-match-count">
                  <strong>{matchResults.length}</strong> homes in {selectedCities.length > 0 ? selectedCities.join(', ') : city}
                </div>
                <button
                  className={`btn ${compareMode ? 'btn-primary' : 'btn-outline'} sw-compare-toggle`}
                  onClick={() => setCompareMode(!compareMode)}
                  type="button"
                >
                  Compare ({selectedListings.length}/3)
                </button>
              </div>
            )}

            {/* Loading skeletons */}
            {matchLoading && (
              <div className="sw-match-grid">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="sw-match-card sw-skeleton-card">
                    <div className="sw-mc-image sw-skeleton-shimmer" />
                    <div className="sw-mc-body">
                      <div className="sw-skeleton-line sw-skeleton-shimmer" style={{ width: '60%', height: 20 }} />
                      <div className="sw-skeleton-line sw-skeleton-shimmer" style={{ width: '40%', height: 14, marginTop: 8 }} />
                      <div className="sw-skeleton-line sw-skeleton-shimmer" style={{ width: '80%', height: 12, marginTop: 6 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Results Grid */}
            {!matchLoading && matchResults.length > 0 && (
              <div className="sw-match-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                {matchResults.map((listing) => {
                  const badges = generateBadges ? generateBadges(listing) : [];
                  const selected = isSelected(listing);
                  const estMonthly = maxBudget && listing.price
                    ? Math.round(listing.price * 0.006)
                    : null;

                  return (
                    <div
                      key={listing.property_id}
                      className={`sw-match-card ${selected ? 'selected' : ''}`}
                      onClick={() => {
                        if (compareMode) {
                          toggleListing(listing);
                        } else {
                          setQuickViewListing(listing);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (compareMode) {
                            toggleListing(listing);
                          } else {
                            setQuickViewListing(listing);
                          }
                        }
                      }}
                      aria-label={`${listing.address?.full || 'Home'} - ${fmt(listing.price)}`}
                    >
                      <div className="sw-mc-image">
                        {listing.thumbnail || listing.photo ? (
                          <img
                            src={listing.thumbnail || listing.photo}
                            alt={listing.address?.full || 'Home'}
                            loading="lazy"
                          />
                        ) : (
                          <div className="sw-mc-noimg">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                              <rect x="3" y="3" width="18" height="18" rx="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <path d="M21 15l-5-5L5 21" />
                            </svg>
                          </div>
                        )}

                        {/* Badges overlay */}
                        {badges.length > 0 && (
                          <div className="sw-mc-badges">
                            {badges.map((badge, bi) => (
                              <span key={bi} className={`badge sw-badge-${badge.type || 'default'}`}>
                                {badge.label || badge}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Selected checkmark */}
                        {selected && (
                          <div className="sw-mc-check">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          </div>
                        )}

                        {/* Heart icon (when not comparing) */}
                        {!compareMode && (
                          <button
                            className="sw-mc-heart"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleListing(listing);
                            }}
                            aria-label={selected ? 'Remove from selection' : 'Add to selection'}
                            type="button"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill={selected ? '#ef4444' : 'none'} stroke={selected ? '#ef4444' : '#fff'} strokeWidth="2">
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                          </button>
                        )}
                      </div>

                      <div className="sw-mc-body">
                        <div className="sw-mc-price">{fmt(listing.price)}</div>
                        <div className="sw-mc-details">
                          {listing.beds} bd | {listing.baths} ba
                          {listing.sqft ? ` | ${Number(listing.sqft).toLocaleString()} sqft` : ''}
                        </div>
                        <div className="sw-mc-address">
                          {listing.address?.full || listing.address || 'Address unavailable'}
                        </div>
                        {estMonthly && (
                          <div className="sw-mc-est-monthly badge badge-primary" style={{ marginTop: 6, fontSize: '0.72rem' }}>
                            Est. {fmt(estMonthly)}/mo
                          </div>
                        )}
                        <button
                          className="sw-mc-why-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickViewListing(listing);
                          }}
                          type="button"
                        >
                          Why this matches
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {!matchLoading && matchResults.length === 0 && hasSearched && (
              <div className="sw-empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--color-border)" strokeWidth="1.5" style={{ marginBottom: 16 }}>
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <p>No homes found. Try a different city or adjust your filters.</p>
              </div>
            )}

            {/* Quick View Modal */}
            {quickViewListing && (
              <div
                className="modal-overlay"
                onClick={() => setQuickViewListing(null)}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                ref={(el) => el && el.focus()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setQuickViewListing(null);
                  if (e.key === 'ArrowLeft' && qvPhotos.length > 1) setQvPhotoIndex((i) => (i === 0 ? qvPhotos.length - 1 : i - 1));
                  if (e.key === 'ArrowRight' && qvPhotos.length > 1) setQvPhotoIndex((i) => (i === qvPhotos.length - 1 ? 0 : i + 1));
                }}
              >
                <div className="modal-content sw-quickview-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Property Details</h3>
                    <button className="modal-close" onClick={() => setQuickViewListing(null)} type="button" aria-label="Close">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="modal-body">
                    {/* Photo Gallery */}
                    {qvPhotos.length > 0 ? (
                      <div className="sw-qv-gallery">
                        <img
                          src={qvPhotos[qvPhotoIndex]}
                          alt={`${quickViewListing.address?.full || 'Home'} - Photo ${qvPhotoIndex + 1}`}
                          className="sw-qv-image"
                        />
                        {qvPhotos.length > 1 && (
                          <>
                            <button
                              className="sw-qv-nav sw-qv-nav-prev"
                              onClick={() => setQvPhotoIndex((i) => (i === 0 ? qvPhotos.length - 1 : i - 1))}
                              type="button"
                              aria-label="Previous photo"
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                            </button>
                            <button
                              className="sw-qv-nav sw-qv-nav-next"
                              onClick={() => setQvPhotoIndex((i) => (i === qvPhotos.length - 1 ? 0 : i + 1))}
                              type="button"
                              aria-label="Next photo"
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                            </button>
                            <div className="sw-qv-photo-counter">
                              {qvPhotoIndex + 1} / {qvPhotos.length}
                            </div>
                          </>
                        )}
                        {qvPhotosLoading && qvPhotos.length <= 1 && (
                          <div className="sw-qv-photo-loading">Loading photos…</div>
                        )}
                      </div>
                    ) : (
                      <div className="sw-qv-noimg">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                        <span>No photos available</span>
                      </div>
                    )}

                    {/* Thumbnail Strip */}
                    {qvPhotos.length > 1 && (
                      <div className="sw-qv-thumbstrip">
                        {qvPhotos.slice(0, 8).map((photo, idx) => (
                          <button
                            key={idx}
                            className={`sw-qv-thumb ${idx === qvPhotoIndex ? 'active' : ''}`}
                            onClick={() => setQvPhotoIndex(idx)}
                            type="button"
                            aria-label={`View photo ${idx + 1}`}
                          >
                            <img src={photo} alt="" loading="lazy" />
                          </button>
                        ))}
                        {qvPhotos.length > 8 && (
                          <span className="sw-qv-thumb-more">+{qvPhotos.length - 8}</span>
                        )}
                      </div>
                    )}

                    <div className="sw-qv-info">
                      <div className="sw-qv-price">{fmt(quickViewListing.price)}</div>
                      <div className="sw-qv-address">
                        {quickViewListing.address?.full || quickViewListing.address || 'Address unavailable'}
                      </div>
                      <div className="sw-qv-details">
                        {quickViewListing.beds} bd | {quickViewListing.baths} ba
                        {quickViewListing.sqft ? ` | ${Number(quickViewListing.sqft).toLocaleString()} sqft` : ''}
                        {formatLotSize(quickViewListing.lot_sqft) ? ` | ${formatLotSize(quickViewListing.lot_sqft)}` : ''}
                        {quickViewListing.year_built ? ` | Built ${quickViewListing.year_built}` : ''}
                      </div>
                      {quickViewListing.prop_type && quickViewListing.prop_type !== 'unknown' && (
                        <div className="sw-qv-prop-type">{quickViewListing.prop_type}</div>
                      )}
                    </div>

                    {/* Why This Matches panel */}
                    {(() => {
                      const matchExplanation = generateMatchExplanation
                        ? generateMatchExplanation({
                            listing: quickViewListing,
                            maxBudget: maxBudget,
                            preferences: { beds, baths, city },
                          })
                        : null;

                      return matchExplanation ? (
                        <div className="sw-qv-match-panel">
                          <h4>Why This Matches</h4>
                          {matchExplanation.matchScore != null && (
                            <div className="sw-qv-match-score">
                              <svg width="60" height="60" viewBox="0 0 60 60">
                                <circle cx="30" cy="30" r="24" fill="none" stroke="var(--color-border-light)" strokeWidth="5" />
                                <circle
                                  cx="30"
                                  cy="30"
                                  r="24"
                                  fill="none"
                                  stroke="var(--color-primary)"
                                  strokeWidth="5"
                                  strokeDasharray={2 * Math.PI * 24}
                                  strokeDashoffset={(2 * Math.PI * 24) - (matchExplanation.matchScore / 100) * (2 * Math.PI * 24)}
                                  strokeLinecap="round"
                                  transform="rotate(-90 30 30)"
                                />
                                <text x="30" y="34" textAnchor="middle" style={{ fontSize: '14px', fontWeight: 700, fill: 'var(--color-primary)' }}>
                                  {matchExplanation.matchScore}
                                </text>
                              </svg>
                            </div>
                          )}
                          {matchExplanation.reasons && (
                            <ul className="sw-qv-reasons">
                              {matchExplanation.reasons.map((reason, ri) => (
                                <li key={ri}>{reason}</li>
                              ))}
                            </ul>
                          )}
                          {matchExplanation.overpriced && (
                            <div className="sw-qv-overpriced badge" style={{ background: '#fef2f2', color: '#dc2626', marginTop: 8 }}>
                              Potentially Overpriced
                            </div>
                          )}
                        </div>
                      ) : null;
                    })()}

                    <div className="sw-qv-actions">
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          toggleListing(quickViewListing);
                          setQuickViewListing(null);
                        }}
                        type="button"
                      >
                        {isSelected(quickViewListing) ? 'Remove This Home' : 'Select This Home'}
                      </button>
                      <Link
                        to={`/listing/${quickViewListing.property_id}`}
                        state={{ listing: quickViewListing, from: '/start' }}
                        className="btn btn-outline"
                        onClick={() => setQuickViewListing(null)}
                      >
                        View Full Details
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Compare Modal */}
            {compareMode && selectedListings.length >= 2 && (
              <div className="sw-compare-panel" style={{ marginTop: 24 }}>
                <div className="sw-card sw-card-full">
                  <h3>Compare Selected Homes</h3>
                  <div className="sw-compare-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Feature</th>
                          {selectedListings.map((l) => (
                            <th key={l.property_id}>
                              {l.address?.full
                                ? l.address.full.split(',')[0]
                                : `Home ${selectedListings.indexOf(l) + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Photo</td>
                          {selectedListings.map((l) => (
                            <td key={l.property_id}>
                              {(l.thumbnail || l.photo) ? (
                                <img
                                  src={l.thumbnail || l.photo}
                                  alt=""
                                  style={{ width: 100, height: 66, objectFit: 'cover', borderRadius: 8 }}
                                />
                              ) : (
                                <span style={{ color: 'var(--color-text-light)' }}>No photo</span>
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td>Price</td>
                          {selectedListings.map((l) => {
                            const prices = selectedListings.map((s) => s.price || Infinity);
                            const minPrice = Math.min(...prices);
                            return (
                              <td
                                key={l.property_id}
                                style={l.price === minPrice ? { background: 'rgba(16,185,129,0.08)' } : {}}
                              >
                                <strong>{fmt(l.price)}</strong>
                              </td>
                            );
                          })}
                        </tr>
                        <tr>
                          <td>Beds</td>
                          {selectedListings.map((l) => {
                            const vals = selectedListings.map((s) => s.beds || 0);
                            const maxVal = Math.max(...vals);
                            return (
                              <td
                                key={l.property_id}
                                style={l.beds === maxVal ? { background: 'rgba(16,185,129,0.08)' } : {}}
                              >
                                {l.beds}
                              </td>
                            );
                          })}
                        </tr>
                        <tr>
                          <td>Baths</td>
                          {selectedListings.map((l) => {
                            const vals = selectedListings.map((s) => s.baths || 0);
                            const maxVal = Math.max(...vals);
                            return (
                              <td
                                key={l.property_id}
                                style={l.baths === maxVal ? { background: 'rgba(16,185,129,0.08)' } : {}}
                              >
                                {l.baths}
                              </td>
                            );
                          })}
                        </tr>
                        <tr>
                          <td>Sqft</td>
                          {selectedListings.map((l) => {
                            const vals = selectedListings.map((s) => s.sqft || 0);
                            const maxVal = Math.max(...vals);
                            return (
                              <td
                                key={l.property_id}
                                style={l.sqft === maxVal ? { background: 'rgba(16,185,129,0.08)' } : {}}
                              >
                                {l.sqft ? Number(l.sqft).toLocaleString() : '--'}
                              </td>
                            );
                          })}
                        </tr>
                        <tr>
                          <td>$/sqft</td>
                          {selectedListings.map((l) => {
                            const ppsf = l.sqft && l.price ? Math.round(l.price / l.sqft) : null;
                            const allPpsf = selectedListings.map((s) => s.sqft && s.price ? s.price / s.sqft : Infinity);
                            const minPpsf = Math.min(...allPpsf);
                            return (
                              <td
                                key={l.property_id}
                                style={ppsf && ppsf === Math.round(minPpsf) ? { background: 'rgba(16,185,129,0.08)' } : {}}
                              >
                                {ppsf ? `$${ppsf.toLocaleString()}` : '--'}
                              </td>
                            );
                          })}
                        </tr>
                        <tr>
                          <td>Est. Monthly</td>
                          {selectedListings.map((l) => {
                            const monthly = l.price ? Math.round(l.price * 0.006) : null;
                            return (
                              <td key={l.property_id}>
                                {monthly ? fmt(monthly) : '--'}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            STEP 3: TOUR (Lead Capture + Agent Matching)
            ───────────────────────────────────────────────────────────────────── */}
        {currentStep === 2 && (
          <>
            <div className="sw-header">
              <h2>Schedule a Tour</h2>
              <p>Tell us about yourself and get matched with a top local agent</p>
            </div>

            <div className="sw-two-col">
              {/* ── LEFT: Tour Form ── */}
              <div className="sw-card">
                <h3>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Request a Tour
                </h3>

                {tourSubmitted ? (
                  <div className="sw-success-card" style={{ padding: '32px 16px', textAlign: 'center' }}>
                    <div className="sw-success-icon">
                      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <path d="M22 4L12 14.01l-3-3" />
                      </svg>
                    </div>
                    <h3 style={{ justifyContent: 'center' }}>We got your request!</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                      A local agent will reach out within 2 hours.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleTourSubmit}>
                    {/* Selected homes chips */}
                    {selectedListings.length > 0 && (
                      <div className="sw-tour-listings" style={{ marginBottom: 16 }}>
                        <span className="sw-tl-label">
                          Selected Homes ({selectedListings.length})
                        </span>
                        <div className="sw-tl-chips">
                          {selectedListings.map((l) => (
                            <span key={l.property_id} className="sw-tl-chip">
                              {fmt(l.price)} - {l.address?.full || 'Home'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="sw-form-grid">
                      <div className="sw-field">
                        <label className="input-label" htmlFor="sw-tour-name">Name *</label>
                        <input
                          id="sw-tour-name"
                          className="input-field"
                          type="text"
                          value={tourForm.name}
                          onChange={(e) => updateTourField('name', e.target.value)}
                          placeholder="Your full name"
                          required
                          aria-required="true"
                        />
                      </div>

                      <div className="sw-field">
                        <label className="input-label" htmlFor="sw-tour-email">Email *</label>
                        <input
                          id="sw-tour-email"
                          className="input-field"
                          type="email"
                          value={tourForm.email}
                          onChange={(e) => updateTourField('email', e.target.value)}
                          placeholder="email@example.com"
                          required
                          aria-required="true"
                        />
                      </div>

                      <div className="sw-field">
                        <label className="input-label" htmlFor="sw-tour-phone">Phone</label>
                        <input
                          id="sw-tour-phone"
                          className="input-field"
                          type="tel"
                          value={tourForm.phone}
                          onChange={(e) => updateTourField('phone', e.target.value)}
                          placeholder="(555) 123-4567"
                        />
                      </div>

                      <div className="sw-field">
                        <label className="input-label" htmlFor="sw-tour-timeline">Timeline</label>
                        <select
                          id="sw-tour-timeline"
                          className="input-field"
                          value={tourForm.timeline}
                          onChange={(e) => updateTourField('timeline', e.target.value)}
                          aria-label="Tour timeline preference"
                        >
                          <option value="">Select timeline</option>
                          {TOUR_TIMELINE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="sw-checkbox-row">
                      <label className="sw-checkbox">
                        <input
                          type="checkbox"
                          checked={tourForm.preapproved}
                          onChange={(e) => updateTourField('preapproved', e.target.checked)}
                        />
                        <span className="sw-checkmark" />
                        I am pre-approved for a mortgage
                      </label>
                    </div>

                    <div className="sw-form-grid">
                      <div className="sw-field">
                        <label className="input-label" htmlFor="sw-tour-date">Preferred Date</label>
                        <input
                          id="sw-tour-date"
                          className="input-field"
                          type="date"
                          value={tourForm.preferredDate}
                          onChange={(e) => updateTourField('preferredDate', e.target.value)}
                          aria-label="Preferred tour date"
                        />
                      </div>

                      <div className="sw-field">
                        <label className="input-label" htmlFor="sw-tour-time">Preferred Time</label>
                        <select
                          id="sw-tour-time"
                          className="input-field"
                          value={tourForm.preferredTime}
                          onChange={(e) => updateTourField('preferredTime', e.target.value)}
                          aria-label="Preferred tour time"
                        >
                          <option value="">Select time</option>
                          {TIME_SLOTS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="sw-field sw-field-full" style={{ marginTop: 8 }}>
                      <label className="input-label" htmlFor="sw-tour-msg">Message (optional)</label>
                      <textarea
                        id="sw-tour-msg"
                        className="input-field"
                        value={tourForm.message}
                        onChange={(e) => updateTourField('message', e.target.value)}
                        placeholder="Anything else you'd like us to know?"
                        rows={3}
                      />
                    </div>

                    <button
                      className="btn btn-gradient"
                      style={{ width: '100%', marginTop: 16 }}
                      type="submit"
                      disabled={tourSubmitting}
                    >
                      {tourSubmitting ? (
                        <><span className="sw-spinner" /> Submitting...</>
                      ) : (
                        'Request Tour'
                      )}
                    </button>
                  </form>
                )}
              </div>

              {/* ── RIGHT: Matched Agents ── */}
              <div className="sw-tour-right">
                <div className="sw-card">
                  <h3>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Your Matched Agents
                  </h3>

                  {matchedAgents && matchedAgents.length > 0 ? (
                    <div className="sw-agents-list">
                      {matchedAgents.slice(0, 3).map((agent, ai) => (
                        <div key={ai} className="sw-agent-card">
                          <div className="sw-agent-header">
                            <div
                              className="sw-agent-avatar"
                              style={{ background: `hsl(${ai * 120}, 55%, 55%)` }}
                            >
                              {(agent.name || 'Agent')
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()
                                .slice(0, 2)}
                            </div>
                            <div className="sw-agent-info">
                              <div className="sw-agent-name">{agent.name || 'Agent'}</div>
                              <div className="sw-agent-title">
                                {agent.title || 'Real Estate Agent'}
                                {agent.brokerage ? ` - ${agent.brokerage}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="sw-agent-rating">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span key={star} className="sw-agent-star">
                                {star <= (agent.rating || 4) ? '\u2605' : '\u2606'}
                              </span>
                            ))}
                            {agent.reviewCount != null && (
                              <span className="sw-agent-review-count">({agent.reviewCount})</span>
                            )}
                          </div>

                          {agent.responseTime && (
                            <div className="badge badge-primary" style={{ fontSize: '0.7rem', marginTop: 4 }}>
                              Responds in {agent.responseTime}
                            </div>
                          )}

                          {agent.matchReasons && agent.matchReasons.length > 0 && (
                            <ul className="sw-agent-reasons">
                              {agent.matchReasons.map((reason, ri) => (
                                <li key={ri}>{reason}</li>
                              ))}
                            </ul>
                          )}

                          {agent.score != null && (
                            <div className="sw-agent-score-bar">
                              <div
                                className="sw-agent-score-fill"
                                style={{ width: `${Math.min(agent.score, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--color-text-light)', fontSize: '0.85rem' }}>
                      Complete the search step to see matched agents.
                    </p>
                  )}

                  {/* How it works / monetization hook */}
                  <div className="sw-agent-connect-section">
                    <div className="badge" style={{ marginBottom: 8 }}>How it works</div>
                    <p className="sw-agent-connect-text">
                      HomeMatch connects you with top-rated local agents. Agents receive only qualified, AI-verified buyers — meaning you get expert guidance at no extra cost.
                    </p>
                  </div>
                </div>

                {/* Offer Strength Card */}
                {offerStrength && (
                  <div className="sw-card" style={{ marginTop: 16 }}>
                    <h3>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                      </svg>
                      Offer Strength
                    </h3>
                    <div className="sw-offer-strength">
                      <div className="sw-offer-gauge">
                        <svg width="80" height="80" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="32" fill="none" stroke="var(--color-border-light)" strokeWidth="6" />
                          <circle
                            cx="40"
                            cy="40"
                            r="32"
                            fill="none"
                            stroke={
                              offerStrength.score >= 80 ? '#10b981' :
                              offerStrength.score >= 60 ? '#3b82f6' :
                              offerStrength.score >= 40 ? '#f59e0b' : '#ef4444'
                            }
                            strokeWidth="6"
                            strokeDasharray={2 * Math.PI * 32}
                            strokeDashoffset={(2 * Math.PI * 32) - (offerStrength.score / 100) * (2 * Math.PI * 32)}
                            strokeLinecap="round"
                            transform="rotate(-90 40 40)"
                            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                          />
                          <text x="40" y="44" textAnchor="middle" style={{ fontSize: '18px', fontWeight: 700, fill: 'var(--color-text)' }}>
                            {offerStrength.score}
                          </text>
                        </svg>
                      </div>
                      <div className={`badge sw-offer-level-badge ${
                        offerStrength.level === 'Strong' ? 'badge-success' :
                        offerStrength.level === 'Competitive' ? 'badge-primary' :
                        offerStrength.level === 'Moderate' ? 'badge-warning' : 'badge-danger'
                      }`}>
                        {offerStrength.level || 'Moderate'}
                      </div>
                      {offerStrength.tips && offerStrength.tips.length > 0 && (
                        <ul className="sw-offer-tips">
                          {offerStrength.tips.map((tip, ti) => (
                            <li key={ti}>{tip}</li>
                          ))}
                        </ul>
                      )}
                      <p className="sw-ai-disclaimer">This estimate is for educational purposes based on available data. Final strategy should be reviewed with your licensed HomeMatch Partner Agent.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ─────────────────────────────────────────────────────────────────────
            STEP 4: MOVE (Plan Ahead Dashboard)
            ───────────────────────────────────────────────────────────────────── */}
        {currentStep === 3 && (
          <>
            <div className="sw-header">
              <h2>Plan Your Move</h2>
              <p>Your personalized closing roadmap and move planner</p>
            </div>

            {/* Selected Home Banner */}
            {firstSelected && (
              <div className="sw-selected-home">
                {(firstSelected.thumbnail || firstSelected.photo) && (
                  <img src={firstSelected.thumbnail || firstSelected.photo} alt="" />
                )}
                <div className="sw-sh-info">
                  <div className="sw-sh-price">{fmt(firstSelected.price)}</div>
                  <div className="sw-sh-address">
                    {firstSelected.address?.full || firstSelected.address || 'Address'}
                  </div>
                  <div className="sw-sh-details">
                    {firstSelected.beds} bd | {firstSelected.baths} ba
                    {firstSelected.sqft ? ` | ${Number(firstSelected.sqft).toLocaleString()} sqft` : ''}
                  </div>
                </div>
              </div>
            )}

            {/* Closing Timeline - UPGRADED */}
            <div className="sw-card sw-timeline-card">
              <div className="sw-timeline-header">
                <h3>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  Closing Timeline
                </h3>
                <div className="sw-timeline-progress-ring">
                  <svg width="56" height="56" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="var(--color-border-light)" strokeWidth="4" />
                    <circle cx="28" cy="28" r="24" fill="none"
                      stroke={closingProgress >= 80 ? '#10b981' : closingProgress >= 40 ? '#3b82f6' : '#f59e0b'}
                      strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 24}
                      strokeDashoffset={(2 * Math.PI * 24) - (closingProgress / 100) * (2 * Math.PI * 24)}
                      transform="rotate(-90 28 28)"
                      style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                    />
                    <text x="28" y="32" textAnchor="middle" style={{ fontSize: '14px', fontWeight: 800, fill: 'var(--color-text)' }}>
                      {closingProgress}%
                    </text>
                  </svg>
                </div>
              </div>

              {/* Show confetti when 100% */}
              {closingProgress === 100 && (
                <div className="sw-confetti-banner">
                  <span className="sw-confetti-icon">\uD83C\uDF89</span>
                  <div>
                    <strong>All milestones complete!</strong>
                    <p>You're ready for closing day.</p>
                  </div>
                </div>
              )}

              <div className="sw-milestone-timeline">
                {closingChecklist.map((item, idx) => (
                  <div key={item.id} className={`sw-milestone ${item.status === 'completed' ? 'completed' : ''} ${idx === closingChecklist.findIndex(i => i.status !== 'completed') ? 'current' : ''}`}>
                    <div className="sw-milestone-dot-col">
                      <div className="sw-milestone-dot" onClick={() => toggleClosingItem(item.id)}>
                        {item.status === 'completed' ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                        ) : (
                          <span className="sw-milestone-num">{idx + 1}</span>
                        )}
                      </div>
                      {idx < closingChecklist.length - 1 && <div className="sw-milestone-line" />}
                    </div>
                    <div className="sw-milestone-content">
                      <div className="sw-milestone-top">
                        <span className="sw-milestone-label">{item.label}</span>
                        <span className="sw-milestone-time">{item.timeline}</span>
                      </div>
                      <div className="sw-milestone-details">
                        <div className="sw-milestone-what">
                          <strong>What it means:</strong> {getMilestoneDescription(item.id)}
                        </div>
                        <div className="sw-milestone-prep">
                          <strong>Prepare:</strong> {getMilestonePrep(item.id)}
                        </div>
                        <div className="sw-milestone-ai-tip">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/></svg>
                          {getMilestoneAITip(item.id)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sw-two-col">
              {/* Move Planner - UPGRADED with categories */}
              <div className="sw-card sw-move-planner-card">
                <div className="sw-move-planner-header">
                  <h3>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="1" y="3" width="15" height="13" />
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                    Move Planner
                  </h3>
                  {/* Move Readiness Ring */}
                  <div className="sw-move-readiness-ring">
                    <svg width="48" height="48" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-border-light)" strokeWidth="3" />
                      <circle cx="24" cy="24" r="20" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 20}
                        strokeDashoffset={(2 * Math.PI * 20) - (moveReadinessPercent / 100) * (2 * Math.PI * 20)}
                        transform="rotate(-90 24 24)"
                        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                      />
                      <text x="24" y="28" textAnchor="middle" style={{ fontSize: '11px', fontWeight: 700, fill: 'var(--color-text)' }}>
                        {moveReadinessPercent}%
                      </text>
                    </svg>
                  </div>
                </div>

                {/* Category sections */}
                {MOVE_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="sw-move-category">
                    <div className="sw-move-cat-header" onClick={() => toggleMoveCategory(cat.id)}>
                      <div className="sw-move-cat-icon">{cat.icon}</div>
                      <span className="sw-move-cat-title">{cat.title}</span>
                      <span className="sw-move-cat-count">
                        {moveCategoryChecks[cat.id]?.filter(Boolean).length || 0}/{cat.items.length}
                      </span>
                      <svg className={`sw-move-cat-chevron ${expandedMoveCategories.includes(cat.id) ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                    {expandedMoveCategories.includes(cat.id) && (
                      <div className="sw-move-cat-items">
                        {cat.items.map((item, ii) => (
                          <label key={ii} className="sw-move-cat-item">
                            <input type="checkbox"
                              checked={moveCategoryChecks[cat.id]?.[ii] || false}
                              onChange={() => toggleMoveCategoryItem(cat.id, ii)}
                            />
                            <span className="sw-checkmark" />
                            {item}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Move cost estimate from API */}
                {moveLoading && (
                  <div className="sw-loading-state compact" style={{marginTop: 16}}>
                    <span className="sw-spinner lg" />
                    <p>Loading move estimate...</p>
                  </div>
                )}
                {!moveLoading && moveEstimate && (
                  <div className="sw-move-cost-card" style={{marginTop: 16}}>
                    <div className="sw-move-cost-label">Estimated Moving Cost</div>
                    <div className="sw-move-cost-amount">
                      {moveEstimate.estimatedCostRange
                        ? `${fmt(moveEstimate.estimatedCostRange.low)} \u2013 ${fmt(moveEstimate.estimatedCostRange.high)}`
                        : moveEstimate.totalEstimate != null ? fmt(moveEstimate.totalEstimate) : 'N/A'
                      }
                    </div>
                  </div>
                )}

                <button className="btn btn-secondary" style={{ width: '100%', marginTop: 16 }} onClick={() => setShowShareCard(true)} type="button">
                  Export Buyer Report
                </button>
              </div>

              {/* Premium Section - COMPLETELY REDESIGNED */}
              <div className="sw-card sw-premium-v2">
                <div className="sw-premium-v2-badge">7-day free trial</div>
                <h3 className="sw-premium-v2-title">HomeMatch Premium</h3>
                <div className="sw-premium-v2-price">
                  <span className="sw-premium-v2-amount">$19</span>
                  <span className="sw-premium-v2-period">/month</span>
                </div>

                {/* Urgency copy */}
                <div className="sw-premium-urgency">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                  Homes in your price range sell in 11 days.
                </div>

                {/* Comparison table */}
                <div className="sw-premium-compare">
                  <div className="sw-premium-compare-header">
                    <span></span>
                    <span>Free</span>
                    <span className="sw-premium-compare-pro">Premium</span>
                  </div>
                  {[
                    { feature: 'AI Budget Analysis', free: true, premium: true },
                    { feature: 'Home Matching', free: true, premium: true },
                    { feature: 'Agent Matching', free: true, premium: true },
                    { feature: 'AI Offer Strategy', free: false, premium: true },
                    { feature: 'Market Trends', free: false, premium: true },
                    { feature: 'Priority Response', free: false, premium: true },
                    { feature: 'Buyer Report PDF', free: false, premium: true },
                  ].map((row, i) => (
                    <div key={i} className="sw-premium-compare-row">
                      <span>{row.feature}</span>
                      <span>{row.free ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      )}</span>
                      <span>{row.premium ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                      ) : null}</span>
                    </div>
                  ))}
                </div>

                <button className="btn btn-gradient sw-premium-v2-cta" onClick={() => setShowPremiumModal(true)} type="button">
                  Start 7-Day Free Trial
                </button>

                {/* Testimonial */}
                <div className="sw-premium-testimonial">
                  <p>"The offer strategy alone saved us $12,000. Worth every penny."</p>
                  <span className="sw-premium-testimonial-author">\u2014 Sarah K., Indianapolis</span>
                </div>
              </div>
            </div>

            {/* Share Card Modal */}
            {showShareCard && (
              <div className="modal-overlay" onClick={() => setShowShareCard(false)} role="dialog" aria-modal="true">
                <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
                  <div className="modal-header">
                    <h3>Buyer Report</h3>
                    <button className="modal-close" onClick={() => setShowShareCard(false)} type="button" aria-label="Close">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="modal-body">
                    <div className="sw-share-card-content">
                      <div className="sw-share-row">
                        <span className="sw-share-label">Buyer</span>
                        <span className="sw-share-value">{tourForm.name || 'Not provided'}</span>
                      </div>
                      <div className="sw-share-row">
                        <span className="sw-share-label">Readiness Score</span>
                        <span className="sw-share-value" style={{ fontWeight: 700, color: readinessScore?.color }}>
                          {readinessScore ? readinessScore.score : '--'}/100
                        </span>
                      </div>
                      <div className="sw-share-row">
                        <span className="sw-share-label">Max Budget</span>
                        <span className="sw-share-value">{fmt(maxBudget)}</span>
                      </div>
                      <div className="sw-share-row">
                        <span className="sw-share-label">Selected Homes</span>
                        <span className="sw-share-value">{selectedListings.length}</span>
                      </div>
                      <div className="sw-share-row">
                        <span className="sw-share-label">Agent Matched</span>
                        <span className="sw-share-value">
                          {matchedAgents.length > 0 ? matchedAgents[0].name : 'Pending'}
                        </span>
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', marginTop: 16 }}
                      onClick={handleCopyShareLink}
                      type="button"
                    >
                      Copy Link
                    </button>
                    <p style={{ textAlign: 'center', color: 'var(--color-text-light)', fontSize: '0.78rem', marginTop: 8 }}>
                      Share this report with your agent or lender.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Premium Modal */}
            {showPremiumModal && (
              <div className="modal-overlay" onClick={() => setShowPremiumModal(false)} role="dialog" aria-modal="true">
                <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
                  <div className="modal-header">
                    <h3>HomeMatch Premium</h3>
                    <button className="modal-close" onClick={() => setShowPremiumModal(false)} type="button" aria-label="Close">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="modal-body" style={{ textAlign: 'center' }}>
                    <div className="sw-premium-modal-price">
                      <span className="sw-premium-amount" style={{ fontSize: '2.5rem' }}>$19</span>
                      <span className="sw-premium-period">/mo</span>
                    </div>
                    <ul className="sw-premium-features" style={{ textAlign: 'left', margin: '20px 0' }}>
                      <li>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        AI-powered offer strategy
                      </li>
                      <li>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        Real-time market trend insights
                      </li>
                      <li>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        Priority response from agents
                      </li>
                      <li>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        Comprehensive buyer report
                      </li>
                    </ul>
                    <button
                      className="btn btn-gradient"
                      style={{ width: '100%' }}
                      onClick={() => {
                        toast.success('Premium trial started!');
                        setShowPremiumModal(false);
                      }}
                      type="button"
                    >
                      Start 14-day Free Trial
                    </button>
                    <p style={{ color: 'var(--color-text-light)', fontSize: '0.78rem', marginTop: 10 }}>
                      No credit card required
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            BOTTOM NAVIGATION — inline (not fixed)
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="sw-nav-inline">
          {/* Back button (hidden on step 0) */}
          {currentStep > 0 ? (
            <button className="sw-btn-back" onClick={goPrev} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          ) : (
            <div />
          )}

          {/* Step label */}
          <span className="sw-nav-step-label">
            Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].label}
          </span>

          {/* Next / Finish button */}
          {currentStep < 3 ? (
            <button
              className="sw-btn-next"
              onClick={goNext}
              type="button"
              disabled={
                (currentStep === 0 && !budgetCalculated) ||
                (currentStep === 1 && selectedListings.length === 0)
              }
            >
              Next: {STEPS[currentStep + 1]?.label}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              className="sw-btn-finish"
              onClick={() => navigate('/homes')}
              type="button"
            >
              Finish &amp; Browse
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="M22 4L12 14.01l-3-3" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default StartWizard;
