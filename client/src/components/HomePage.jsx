import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { TESTIMONIALS, PARTNER_LOGOS, HOW_IT_WORKS } from '../services/mockData';
import API_BASE from '../utils/apiBase';
import './HomePage.css';

// ─── Scroll-reveal hook (IntersectionObserver) ─────────────────────
function useScrollReveal(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(node);
        }
      },
      { threshold }
    );
    observer.observe(node);
    return () => observer.unobserve(node);
  }, [threshold]);

  return [ref, visible];
}

function RevealSection({ className = '', children, delay = 0 }) {
  const [ref, visible] = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ─── Inline SVG Icons ──────────────────────────────────────────────

const StepIcons = {
  dollar: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  heart: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  home: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
};

const FeatureIcons = {
  calculator: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="10" y2="10" />
      <line x1="14" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="10" y2="14" />
      <line x1="14" y1="14" x2="16" y2="14" />
      <line x1="8" y1="18" x2="10" y2="18" />
      <line x1="14" y1="18" x2="16" y2="18" />
    </svg>
  ),
  eye: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  chart: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
};

// ─── Star Rating ───────────────────────────────────────────────────

function StarRating({ rating }) {
  return (
    <div className="hp-stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={star <= rating ? '#f59e0b' : 'none'}
          stroke={star <= rating ? '#f59e0b' : '#d1d5db'}
          strokeWidth="1.5"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

// ─── AI Features Data ──────────────────────────────────────────────

const AI_FEATURES = [
  {
    key: 'budget',
    title: 'Smart Budget Analysis',
    description: 'Know exactly what you can afford with AI-powered financial modeling.',
    icon: 'calculator',
    gradient: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
    color: '#2563eb',
  },
  {
    key: 'vision',
    title: 'Vision Verified\u2122',
    description: 'Every listing photo analyzed for quality and accuracy.',
    icon: 'eye',
    gradient: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
    color: '#7c3aed',
  },
  {
    key: 'offer',
    title: 'Offer Intelligence',
    description: 'Data-driven offer recommendations that win.',
    icon: 'chart',
    gradient: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    color: '#059669',
  },
];

// ─── Main Component ────────────────────────────────────────────────

function HomePage() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  // Realtor CTA form
  const [realtorEmail, setRealtorEmail] = useState('');
  const [realtorSubmitting, setRealtorSubmitting] = useState(false);
  const [realtorSuccess, setRealtorSuccess] = useState(false);
  const [realtorError, setRealtorError] = useState(null);

  // Waitlist modal
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);

  // Testimonial auto-rotate
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % TESTIMONIALS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // ─── Realtor form submit ───────────────────────────────────────
  const handleRealtorSubmit = async (e) => {
    e.preventDefault();
    if (!realtorEmail.trim()) return;

    setRealtorSubmitting(true);
    setRealtorError(null);

    try {
      const res = await fetch(`${API_BASE}/api/leads/realtor-interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Agent',
          email: realtorEmail.trim(),
        }),
      });

      if (res.ok) {
        setRealtorSuccess(true);
      } else {
        setRealtorError('Something went wrong. Please try again.');
      }
    } catch (err) {
      console.error('Realtor interest submission failed:', err);
      setRealtorError('Could not connect to server. Please try again.');
    } finally {
      setRealtorSubmitting(false);
    }
  };

  // ─── Waitlist submit (mock) ────────────────────────────────────
  const handleWaitlistSubmit = (e) => {
    e.preventDefault();
    if (!waitlistEmail.trim()) return;
    setWaitlistSuccess(true);
  };

  // Derive first name for greeting
  const firstName = user?.displayName
    ? user.displayName.split(' ')[0]
    : user?.email
    ? user.email.split('@')[0]
    : null;

  return (
    <div className="hp">
      {/* ═══════════════════════════════════════════════════════════════
          1. HERO SECTION
          ═══════════════════════════════════════════════════════════════ */}
      <section className="hp-hero">
        {/* Floating decorative elements */}
        <div className="hp-hero-float hp-hero-float--1" />
        <div className="hp-hero-float hp-hero-float--2" />
        <div className="hp-hero-float hp-hero-float--3" />

        <div className="hp-hero-inner">
          {/* Logged-in greeting */}
          {user && firstName && (
            <div className="hp-hero-greeting">
              Welcome back, {firstName}!
            </div>
          )}

          <h1 className="hp-hero-title">
            From Budget to Keys
            <br />
            <span className="hp-hero-title-accent">Guided by AI.</span>
          </h1>

          <p className="hp-hero-subtitle">
            HomeMatch qualifies you as a buyer, matches you with homes that fit your life,
            and connects you with verified partner agents &mdash; so you tour with confidence.
          </p>

          <div className="hp-hero-actions">
            <Link to="/start" className="hp-btn hp-btn-primary">
              Start Your Journey
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link to="/homes" className="hp-btn hp-btn-outline">
              Browse Homes
            </Link>
          </div>

          {/* Stats bar */}
          <div className="hp-hero-stats">
            <div className="hp-stat">
              <span className="hp-stat-num">12,000+</span>
              <span className="hp-stat-label">homes analyzed</span>
            </div>
            <div className="hp-stat-divider" />
            <div className="hp-stat">
              <span className="hp-stat-num">3,200+</span>
              <span className="hp-stat-label">buyers matched</span>
            </div>
            <div className="hp-stat-divider" />
            <div className="hp-stat">
              <span className="hp-stat-num">98%</span>
              <span className="hp-stat-label">satisfaction</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          2. HOW IT WORKS
          ═══════════════════════════════════════════════════════════════ */}
      <section className="hp-how" id="how-it-works">
        <RevealSection className="hp-section-header">
          <h2>Your path to homeownership</h2>
          <p className="hp-section-sub">
            Three simple steps powered by AI to take you from dreaming to moved in.
          </p>
        </RevealSection>

        <div className="hp-steps-row">
          {HOW_IT_WORKS.map((step, i) => (
            <React.Fragment key={step.num}>
              <RevealSection className="hp-step-card" delay={i * 140}>
                <div className="hp-step-num">{step.num}</div>
                <div className="hp-step-icon">
                  {StepIcons[step.icon] || StepIcons.home}
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </RevealSection>
              {i < HOW_IT_WORKS.length - 1 && (
                <div className="hp-step-connector" />
              )}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          3. AI FEATURES
          ═══════════════════════════════════════════════════════════════ */}
      <section className="hp-ai" id="ai-features">
        <RevealSection className="hp-section-header">
          <h2>AI that actually helps</h2>
          <p className="hp-section-sub">
            Not gimmicks. Real intelligence that makes buying a home easier.
          </p>
        </RevealSection>

        <div className="hp-ai-grid">
          {AI_FEATURES.map((feat, i) => (
            <RevealSection key={feat.key} className="hp-ai-card" delay={i * 120}>
              <div
                className="hp-ai-icon"
                style={{ background: feat.gradient, color: feat.color }}
              >
                {FeatureIcons[feat.icon]}
              </div>
              <h3>{feat.title}</h3>
              <p>{feat.description}</p>
            </RevealSection>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          4. SOCIAL PROOF
          ═══════════════════════════════════════════════════════════════ */}
      <section className="hp-social" id="testimonials">
        <RevealSection className="hp-section-header">
          <h2>Trusted by thousands of homebuyers</h2>
        </RevealSection>

        {/* Partner logos */}
        <RevealSection className="hp-partners" delay={100}>
          {PARTNER_LOGOS.map((logo) => (
            <div key={logo.id} className="hp-partner-logo">
              <span>{logo.initials}</span>
            </div>
          ))}
        </RevealSection>

        {/* Testimonials grid */}
        <div className="hp-testimonials-grid">
          {TESTIMONIALS.map((t, i) => (
            <RevealSection key={t.id} className="hp-testimonial-card" delay={i * 100}>
              <div className="hp-testimonial-tag">{t.tag}</div>
              <StarRating rating={t.rating} />
              <blockquote className="hp-testimonial-quote">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <div className="hp-testimonial-author">
                <div className="hp-testimonial-avatar">
                  {t.author.charAt(0)}
                </div>
                <div>
                  <div className="hp-testimonial-name">{t.author}</div>
                  <div className="hp-testimonial-location">{t.location}</div>
                </div>
              </div>
            </RevealSection>
          ))}
        </div>

        {/* Dot indicators (mobile auto-rotate) */}
        <div className="hp-testimonial-dots">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              className={`hp-dot ${i === activeTestimonial ? 'hp-dot--active' : ''}`}
              onClick={() => setActiveTestimonial(i)}
              aria-label={`Show testimonial ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          5. CTA - FOR REALTORS
          ═══════════════════════════════════════════════════════════════ */}
      <section className="hp-cta-realtors">
        <div className="hp-cta-realtors-inner">
          <RevealSection className="hp-cta-realtors-content">
            <h2>Are you a real estate agent?</h2>
            <p>Join our network and receive qualified buyer leads.</p>

            {!realtorSuccess ? (
              <form className="hp-cta-form" onSubmit={handleRealtorSubmit}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={realtorEmail}
                  onChange={(e) => setRealtorEmail(e.target.value)}
                  required
                  className="hp-cta-input"
                />
                <button
                  type="submit"
                  className="hp-btn hp-btn-primary hp-cta-btn"
                  disabled={realtorSubmitting}
                >
                  {realtorSubmitting ? (
                    <span className="hp-btn-spinner" />
                  ) : (
                    'Get Early Access'
                  )}
                </button>
              </form>
            ) : (
              <div className="hp-cta-success">
                <div className="hp-cta-success-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <path d="M22 4L12 14.01l-3-3" />
                  </svg>
                </div>
                <span>You're on the list!</span>
              </div>
            )}
            {realtorError && <p className="hp-cta-error">{realtorError}</p>}
          </RevealSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          6. EMAIL WAITLIST MODAL
          ═══════════════════════════════════════════════════════════════ */}
      {showWaitlist && (
        <div className="hp-modal-overlay" onClick={() => setShowWaitlist(false)}>
          <div className="hp-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="hp-modal-close"
              onClick={() => setShowWaitlist(false)}
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {!waitlistSuccess ? (
              <>
                <h3 className="hp-modal-title">Get Early Access</h3>
                <p className="hp-modal-desc">
                  Be the first to know when new features launch.
                </p>
                <form className="hp-modal-form" onSubmit={handleWaitlistSubmit}>
                  <input
                    type="email"
                    placeholder="you@email.com"
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    required
                    className="hp-modal-input"
                  />
                  <button type="submit" className="hp-btn hp-btn-primary hp-modal-btn">
                    Join Waitlist
                  </button>
                </form>
              </>
            ) : (
              <div className="hp-modal-success">
                <div className="hp-modal-success-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <path d="M22 4L12 14.01l-3-3" />
                  </svg>
                </div>
                <h3>You're on the list!</h3>
                <p>We'll send you an invite soon.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          7. FOOTER
          ═══════════════════════════════════════════════════════════════ */}
      <footer className="hp-footer">
        <div className="hp-footer-inner">
          {/* Brand */}
          <div className="hp-footer-brand">
            <div className="hp-footer-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span>HomeMatch</span>
            </div>
            <p className="hp-footer-tagline">AI Buyer Readiness &bull; Verified Tour Leads</p>
          </div>

          {/* Link columns */}
          <div className="hp-footer-links">
            <div className="hp-footer-col">
              <h4>Product</h4>
              <ul>
                <li><Link to="/start">Start</Link></li>
                <li><Link to="/homes">Browse</Link></li>
                <li><Link to="/favorites">Saved</Link></li>
              </ul>
            </div>
            <div className="hp-footer-col">
              <h4>Company</h4>
              <ul>
                <li><a href="#about">About</a></li>
                <li><a href="#careers">Careers</a></li>
                <li><a href="#blog">Blog</a></li>
              </ul>
            </div>
            <div className="hp-footer-col">
              <h4>Legal</h4>
              <ul>
                <li><Link to="/privacy">Privacy</Link></li>
                <li><Link to="/terms">Terms</Link></li>
                <li>
                  <button
                    className="hp-footer-link-btn"
                    onClick={() => setShowWaitlist(true)}
                  >
                    Join Waitlist
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Social icons */}
          <div className="hp-footer-social">
            {/* Twitter/X */}
            <a href="#" className="hp-social-icon" aria-label="Twitter">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            {/* LinkedIn */}
            <a href="#" className="hp-social-icon" aria-label="LinkedIn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
            {/* Instagram */}
            <a href="#" className="hp-social-icon" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="hp-footer-bottom">
          <p>&copy; 2025 HomeMatch. All rights reserved.</p>
          <p className="hp-footer-disclaimer">HomeMatch is not a licensed real estate brokerage. AI insights are for educational purposes only.</p>
          <p className="hp-footer-love">Built with &hearts; and AI</p>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
