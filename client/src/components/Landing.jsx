import React, { useState, useEffect, useRef, useCallback } from 'react';
import API_BASE from '../utils/apiBase';
import './Landing.css';

const LIFESTYLE_CHIPS = [
  { id: 'fitness', label: 'Fitness Enthusiast', icon: '\u{1F4AA}' },
  { id: 'family', label: 'Growing Family', icon: '\u{1F46A}' },
  { id: 'remote_work', label: 'Remote Worker', icon: '\u{1F4BB}' },
  { id: 'entertainer', label: 'Love Hosting', icon: '\u{1F37E}' },
  { id: 'outdoors', label: 'Outdoor Lover', icon: '\u{1F3DE}\uFE0F' },
  { id: 'investor', label: 'Investor Mindset', icon: '\u{1F4C8}' },
  { id: 'pets', label: 'Pet Parent', icon: '\u{1F436}' },
  { id: 'sustainability', label: 'Eco-Conscious', icon: '\u2600\uFE0F' },
  { id: 'creative', label: 'Creative/Artist', icon: '\u{1F3A8}' },
  { id: 'downsizer', label: 'Downsizing', icon: '\u{1F33F}' },
];

const TESTIMONIALS = [
  {
    quote: "I told HomeMatch I needed a home office with natural light and a yard for my dog. Within minutes, it found three places I never would have discovered on Zillow. My agent helped me close in two weeks.",
    name: 'Sarah Chen',
    location: 'Indianapolis, IN',
    found: '4BR Colonial with home office',
    initials: 'SC',
    gradient: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    stars: 5,
  },
  {
    quote: "As a first-time buyer, I had no idea where to start. I typed in my budget and that I wanted to be near the gym and good coffee shops. The AI nailed it. My realtor said it was the smoothest deal he's had all year.",
    name: 'Marcus Johnson',
    location: 'Carmel, IN',
    found: '2BR Condo near Monon Trail',
    initials: 'MJ',
    gradient: 'linear-gradient(135deg, #10b981, #2563eb)',
    stars: 5,
  },
  {
    quote: "We have three kids and needed good schools, a big backyard, and space for a playroom. HomeMatch understood our lifestyle and found a neighborhood we didn't even know existed. Absolutely worth it.",
    name: 'Priya & Raj Patel',
    location: 'Fishers, IN',
    found: '5BR Home near top-rated schools',
    initials: 'PP',
    gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    stars: 5,
  },
];

// Hook for scroll-triggered animations via IntersectionObserver
function useScrollAnimation() {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(node);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.unobserve(node);
  }, []);

  return [ref, isVisible];
}

function AnimatedSection({ className, children, delay = 0 }) {
  const [ref, isVisible] = useScrollAnimation();
  return (
    <div
      ref={ref}
      className={`${className} ${isVisible ? 'fade-in visible' : 'fade-in'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function Landing() {
  // Hero state
  const [prompt, setPrompt] = useState('');
  const [selectedLifestyles, setSelectedLifestyles] = useState([]);
  const [heroLoading, setHeroLoading] = useState(false);

  // Results preview state
  const [showResults, setShowResults] = useState(false);
  const [parsedIntent, setParsedIntent] = useState(null);
  const [lifestyleInsights, setLifestyleInsights] = useState(null);

  // Lead form state
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const [leadError, setLeadError] = useState(null);

  const resultsRef = useRef(null);
  const leadFormRef = useRef(null);

  const toggleLifestyle = (chipId) => {
    setSelectedLifestyles(prev =>
      prev.includes(chipId) ? prev.filter(c => c !== chipId) : [...prev, chipId]
    );
  };

  const scrollTo = useCallback((ref) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, []);

  const handleHeroSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || heroLoading) return;

    setHeroLoading(true);
    setParsedIntent(null);
    setLifestyleInsights(null);
    setShowResults(false);
    setShowLeadForm(false);
    setLeadSuccess(false);

    try {
      // Build enriched prompt with lifestyle context
      let enrichedPrompt = prompt.trim();
      if (selectedLifestyles.length > 0) {
        const lifestyleLabels = selectedLifestyles
          .map(id => LIFESTYLE_CHIPS.find(c => c.id === id)?.label)
          .filter(Boolean);
        enrichedPrompt += ` (lifestyle: ${lifestyleLabels.join(', ')})`;
      }

      // Step 1: Parse the prompt
      const parseRes = await fetch(`${API_BASE}/api/assistant/parse-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: enrichedPrompt }),
      });
      const parseData = await parseRes.json();
      setParsedIntent(parseData);

      // Step 2: Analyze lifestyle
      const lifestyleRes = await fetch(`${API_BASE}/api/intelligence/analyze-lifestyle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: enrichedPrompt,
          lifestyles: selectedLifestyles,
        }),
      });
      const lifestyleData = await lifestyleRes.json();
      setLifestyleInsights(lifestyleData);

      // Show results
      setShowResults(true);
      scrollTo(resultsRef);

      // After a beat, show the lead form
      setTimeout(() => {
        setShowLeadForm(true);
        setTimeout(() => scrollTo(leadFormRef), 300);
      }, 1200);

    } catch (err) {
      console.error('Hero submit failed:', err);
    } finally {
      setHeroLoading(false);
    }
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();
    if (!leadForm.name.trim() || !leadForm.email.trim()) return;

    setLeadSubmitting(true);
    setLeadError(null);

    try {
      const payload = {
        name: leadForm.name,
        email: leadForm.email,
        phone: leadForm.phone || null,
        message: leadForm.message || prompt,
        prompt,
        lifestyles: selectedLifestyles,
        parsedIntent,
        lifestyleInsights,
        source: 'landing_page',
        timestamp: new Date().toISOString(),
      };

      const res = await fetch(`${API_BASE}/api/leads/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setLeadSuccess(true);
      } else {
        setLeadError('Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Lead capture failed:', err);
      setLeadError('Could not connect to server. Please try again.');
    } finally {
      setLeadSubmitting(false);
    }
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing">
      {/* ===== HERO SECTION ===== */}
      <section className="landing-hero">
        <div className="landing-hero-bg">
          <div className="landing-hero-overlay" />
          <div className="landing-hero-content">
            <div className="landing-hero-badge">
              <span className="landing-badge-icon">{'\u{1F3E0}'}</span>
              AI-Powered Home Search
            </div>

            <h1 className="landing-hero-title">
              Tell Us Your Dream Home.{'\n'}
              <span className="landing-title-accent">We'll Find It.</span>
            </h1>

            <p className="landing-hero-subtitle">
              Skip the endless scrolling. Describe your ideal home in plain English — our AI matches you with homes that fit your life, budget, and style.
            </p>

            {/* Main CTA textarea */}
            <form className="landing-hero-form" onSubmit={handleHeroSubmit}>
              <div className="landing-prompt-box">
                <div className="landing-prompt-glow" />
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="I'm looking for a 3 bedroom house near good schools with a big yard under $400k..."
                  className="landing-prompt-textarea"
                  rows={3}
                  disabled={heroLoading}
                />
                <div className="landing-prompt-footer">
                  <div className="landing-prompt-hint">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    Powered by AI
                  </div>
                  <span className="landing-prompt-count">{prompt.length}/500</span>
                </div>
              </div>

              {/* Lifestyle chips */}
              <div className="landing-lifestyle-row">
                <span className="landing-lifestyle-label">I'm a:</span>
                <div className="landing-lifestyle-chips">
                  {LIFESTYLE_CHIPS.map(chip => (
                    <button
                      key={chip.id}
                      type="button"
                      className={`landing-lifestyle-chip ${selectedLifestyles.includes(chip.id) ? 'active' : ''}`}
                      onClick={() => toggleLifestyle(chip.id)}
                    >
                      <span className="landing-lc-icon">{chip.icon}</span>
                      <span className="landing-lc-label">{chip.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="landing-hero-cta"
                disabled={heroLoading || !prompt.trim()}
              >
                {heroLoading ? (
                  <span className="landing-btn-loading" />
                ) : (
                  <>
                    Find My Dream Home
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </>
                )}
              </button>
            </form>

            {/* Social proof row */}
            <div className="landing-hero-proof">
              <div className="landing-avatar-stack">
                {['SC', 'MJ', 'PP', 'AK', 'LT'].map((initials, i) => (
                  <div
                    key={i}
                    className="landing-avatar-circle"
                    style={{
                      background: [
                        'linear-gradient(135deg, #2563eb, #7c3aed)',
                        'linear-gradient(135deg, #10b981, #2563eb)',
                        'linear-gradient(135deg, #f59e0b, #ef4444)',
                        'linear-gradient(135deg, #8b5cf6, #ec4899)',
                        'linear-gradient(135deg, #06b6d4, #2563eb)',
                      ][i],
                      zIndex: 5 - i,
                    }}
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <span className="landing-proof-text">
                Join <strong>2,400+</strong> homebuyers who found their match
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== RESULTS PREVIEW (slides in after hero submit) ===== */}
      {showResults && (
        <section className="landing-results-preview" ref={resultsRef}>
          <div className="landing-results-inner slide-up">
            <div className="landing-results-header">
              <div className="landing-results-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>
                AI Analysis Complete
              </div>
              <p className="landing-results-sub">Here's what our AI understood from your description</p>
            </div>

            {/* Parsed intent chips */}
            {parsedIntent && parsedIntent.searchParams && (
              <div className="landing-intent-chips">
                {parsedIntent.searchParams.city && (
                  <span className="landing-intent-chip location">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {parsedIntent.searchParams.city}{parsedIntent.searchParams.stateCode ? `, ${parsedIntent.searchParams.stateCode}` : ''}
                  </span>
                )}
                {parsedIntent.searchParams.priceMax && (
                  <span className="landing-intent-chip budget">
                    ${Number(parsedIntent.searchParams.priceMax).toLocaleString()} max
                  </span>
                )}
                {parsedIntent.searchParams.beds && (
                  <span className="landing-intent-chip">{parsedIntent.searchParams.beds}+ beds</span>
                )}
                {parsedIntent.searchParams.baths && (
                  <span className="landing-intent-chip">{parsedIntent.searchParams.baths}+ baths</span>
                )}
                {parsedIntent.searchParams.propType && (
                  <span className="landing-intent-chip type">{parsedIntent.searchParams.propType}</span>
                )}
                {parsedIntent.features && parsedIntent.features.map((f, i) => (
                  <span key={i} className="landing-intent-chip feature">{f}</span>
                ))}
              </div>
            )}

            {/* Lifestyle insights */}
            {lifestyleInsights && (
              <div className="landing-lifestyle-insights">
                {lifestyleInsights.personalInsight && (
                  <div className="landing-insight-box">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    <p>{lifestyleInsights.personalInsight}</p>
                  </div>
                )}
                {lifestyleInsights.nicheTips && lifestyleInsights.nicheTips.length > 0 && (
                  <div className="landing-tips-grid">
                    {lifestyleInsights.nicheTips.slice(0, 3).map((tip, i) => (
                      <div key={i} className="landing-tip-card">
                        <span className="landing-tip-icon">{tip.icon}</span>
                        <strong>{tip.title}</strong>
                        <span>{tip.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Transition to lead form */}
            {showLeadForm && !leadSuccess && (
              <div className="landing-results-cta-bridge" ref={leadFormRef}>
                <h3>Love what you see? Let us connect you with a local expert.</h3>
                <form className="landing-lead-form-inline" onSubmit={handleLeadSubmit}>
                  <div className="landing-lead-fields">
                    <input
                      type="text"
                      placeholder="Your name"
                      value={leadForm.name}
                      onChange={(e) => setLeadForm(f => ({ ...f, name: e.target.value }))}
                      required
                    />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={leadForm.email}
                      onChange={(e) => setLeadForm(f => ({ ...f, email: e.target.value }))}
                      required
                    />
                    <input
                      type="tel"
                      placeholder="Phone (optional)"
                      value={leadForm.phone}
                      onChange={(e) => setLeadForm(f => ({ ...f, phone: e.target.value }))}
                    />
                  </div>
                  <textarea
                    placeholder="Anything else you'd like your agent to know?"
                    value={leadForm.message}
                    onChange={(e) => setLeadForm(f => ({ ...f, message: e.target.value }))}
                    rows={2}
                    className="landing-lead-message"
                  />
                  {leadError && <p className="landing-lead-error">{leadError}</p>}
                  <button type="submit" className="landing-lead-submit" disabled={leadSubmitting}>
                    {leadSubmitting ? (
                      <span className="landing-btn-loading" />
                    ) : (
                      <>
                        Get Matched with a Local Expert
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </>
                    )}
                  </button>
                  <p className="landing-lead-fine-print">Free &bull; No obligation &bull; Takes 60 seconds</p>
                </form>
              </div>
            )}

            {/* Success state */}
            {leadSuccess && (
              <div className="landing-lead-success" ref={leadFormRef}>
                <div className="landing-success-icon">{'\u{1F389}'}</div>
                <h3>You're matched!</h3>
                <p>A local real estate expert will reach out within 24 hours to help you find exactly what you're looking for.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ===== HOW IT WORKS ===== */}
      <section className="landing-how" id="how-it-works">
        <AnimatedSection className="landing-section-header">
          <span className="landing-section-badge">How It Works</span>
          <h2>Three Steps to Your Dream Home</h2>
          <p>No complicated filters. No endless browsing. Just tell us what matters to you.</p>
        </AnimatedSection>

        <div className="landing-steps">
          <div className="landing-steps-line" />
          <AnimatedSection className="landing-step-card" delay={0}>
            <div className="landing-step-number">1</div>
            <div className="landing-step-icon-wrap">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3>Describe Your Lifestyle</h3>
            <p>Tell our AI what matters to you in plain English. Your commute, your hobbies, your family size, your budget. No forms, no jargon.</p>
          </AnimatedSection>

          <AnimatedSection className="landing-step-card" delay={150}>
            <div className="landing-step-number">2</div>
            <div className="landing-step-icon-wrap">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <h3>AI Finds Your Match</h3>
            <p>Our engine scores every listing against your unique lifestyle. It understands context like "near good schools" or "quiet neighborhood for remote work."</p>
          </AnimatedSection>

          <AnimatedSection className="landing-step-card" delay={300}>
            <div className="landing-step-number">3</div>
            <div className="landing-step-icon-wrap">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h3>Get Expert Help</h3>
            <p>We connect you with a top local agent who already knows what you want. No cold calls, no pressure — just a warm, informed introduction.</p>
          </AnimatedSection>
        </div>
      </section>

      {/* ===== AI FEATURES SHOWCASE ===== */}
      <section className="landing-features" id="features">
        <AnimatedSection className="landing-section-header">
          <span className="landing-section-badge">AI Features</span>
          <h2>Smarter Search. Better Results.</h2>
          <p>Traditional search filters can't understand your life. Our AI can.</p>
        </AnimatedSection>

        <div className="landing-features-grid">
          <AnimatedSection className="landing-feature-card" delay={0}>
            <div className="landing-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </div>
            <h3>Lifestyle AI</h3>
            <p>Goes beyond beds and baths. Understands your daily routines, hobbies, and family needs to find homes that truly fit how you live.</p>
          </AnimatedSection>

          <AnimatedSection className="landing-feature-card" delay={100}>
            <div className="landing-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <h3>Smart Scoring</h3>
            <p>Every home gets a personalized match score based on how well it fits YOU. See exactly why each property made the cut.</p>
          </AnimatedSection>

          <AnimatedSection className="landing-feature-card" delay={200}>
            <div className="landing-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <h3>Investment Intel</h3>
            <p>Future value predictions, neighborhood growth trends, and ROI analysis so you can buy with confidence and build wealth.</p>
          </AnimatedSection>

          <AnimatedSection className="landing-feature-card" delay={300}>
            <div className="landing-feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <h3>Budget Clarity</h3>
            <p>Know exactly what you can afford in 60 seconds. Real monthly costs, not just listing price. Property tax, insurance, and HOA all included.</p>
          </AnimatedSection>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="landing-testimonials" id="testimonials">
        <AnimatedSection className="landing-section-header">
          <span className="landing-section-badge">Success Stories</span>
          <h2>Real People. Real Matches.</h2>
          <p>See how HomeMatch helped homebuyers find exactly what they were looking for.</p>
        </AnimatedSection>

        <div className="landing-testimonials-grid">
          {TESTIMONIALS.map((t, i) => (
            <AnimatedSection key={i} className="landing-testimonial-card" delay={i * 120}>
              <div className="landing-testimonial-stars">
                {Array.from({ length: t.stars }).map((_, s) => (
                  <svg key={s} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                ))}
              </div>
              <p className="landing-testimonial-quote">"{t.quote}"</p>
              <div className="landing-testimonial-author">
                <div className="landing-testimonial-avatar" style={{ background: t.gradient }}>
                  {t.initials}
                </div>
                <div className="landing-testimonial-info">
                  <strong>{t.name}</strong>
                  <span>{t.location}</span>
                  <span className="landing-testimonial-found">Found: {t.found}</span>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ===== BOTTOM CTA / LEAD CAPTURE ===== */}
      <section className="landing-cta" id="get-started">
        <div className="landing-cta-bg" />
        <AnimatedSection className="landing-cta-content">
          <h2>Ready to Find Your Dream Home?</h2>
          <p>Tell us a little about yourself and we'll connect you with a local expert who already understands what you're looking for.</p>

          {!leadSuccess ? (
            <form className="landing-cta-form" onSubmit={handleLeadSubmit}>
              <div className="landing-cta-fields">
                <input
                  type="text"
                  placeholder="Your name"
                  value={leadForm.name}
                  onChange={(e) => setLeadForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <textarea
                placeholder="What are you looking for?"
                value={leadForm.message}
                onChange={(e) => setLeadForm(f => ({ ...f, message: e.target.value }))}
                rows={3}
                className="landing-cta-message"
              />
              {leadError && <p className="landing-lead-error">{leadError}</p>}
              <button type="submit" className="landing-cta-submit" disabled={leadSubmitting}>
                {leadSubmitting ? (
                  <span className="landing-btn-loading" />
                ) : (
                  <>
                    Get Matched with a Local Expert
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </>
                )}
              </button>
              <p className="landing-cta-fine-print">Free &bull; No obligation &bull; Takes 60 seconds</p>
            </form>
          ) : (
            <div className="landing-lead-success">
              <div className="landing-success-icon">{'\u{1F389}'}</div>
              <h3>You're matched!</h3>
              <p>A local real estate expert will reach out within 24 hours to help you find exactly what you're looking for.</p>
            </div>
          )}
        </AnimatedSection>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <div className="landing-footer-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>HomeMatch</span>
            </div>
            <p className="landing-footer-tagline">Built with AI &bull; Indianapolis, IN</p>
          </div>
          <nav className="landing-footer-links">
            <button type="button" onClick={() => scrollToSection('how-it-works')}>How It Works</button>
            <button type="button" onClick={() => scrollToSection('features')}>Features</button>
            <button type="button" onClick={() => scrollToSection('testimonials')}>Reviews</button>
            <button type="button" onClick={() => scrollToSection('get-started')}>Get Started</button>
          </nav>
          <p className="landing-footer-copy">&copy; {new Date().getFullYear()} HomeMatch. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
