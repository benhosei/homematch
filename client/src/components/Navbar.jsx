import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import './Navbar.css';

const STEP_LABELS = ['Basics', 'Location', 'Features', 'Budget', 'Review'];
const OWNER_EMAIL = (process.env.REACT_APP_OWNER_EMAIL || '').trim().toLowerCase();

function Navbar({ wizardStep = -1, totalSteps = 5, favoritesCount }) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const theme = useTheme();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const userMenuRef = useRef(null);
  const hamburgerRef = useRef(null);

  /* ── Scroll listener for transparent navbar ─────────────────────── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Click-outside to close user dropdown ───────────────────────── */
  useEffect(() => {
    if (!showUserMenu) return;
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  /* ── Lock body scroll when mobile menu is open ──────────────────── */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  /* ── Close mobile menu on route change ──────────────────────────── */
  useEffect(() => {
    setMobileOpen(false);
    setShowUserMenu(false);
  }, [location.pathname]);

  /* ── Keyboard support for user dropdown ─────────────────────────── */
  const handleUserMenuKeyDown = useCallback((e) => {
    if (e.key === 'Escape') setShowUserMenu(false);
  }, []);

  const handleSignOut = async () => {
    setShowUserMenu(false);
    setMobileOpen(false);
    await signOut();
  };

  const isHome = location.pathname === '/';
  const isTransparent = isHome && !scrolled;
  const showStepper = location.pathname === '/start' && wizardStep >= 0;

  const navClasses = [
    'navbar',
    isTransparent ? 'navbar-transparent' : '',
    scrolled ? 'navbar-scrolled' : '',
  ].filter(Boolean).join(' ');

  /* ── Nav link helper ────────────────────────────────────────────── */
  const isActive = (path) => location.pathname === path;

  return (
    <>
      <nav className={navClasses} role="navigation" aria-label="Main navigation">
        <div className="navbar-inner">
          {/* Brand */}
          <Link to="/" className="navbar-brand" aria-label="HomeMatch home">
            <span className="brand-icon" aria-hidden="true">&#9978;</span>
            <span className="brand-text">HomeMatch</span>
          </Link>

          {/* Desktop nav links */}
          <div className="navbar-links" role="menubar">
            <Link
              to="/start"
              className={`nav-link ${isActive('/start') ? 'active' : ''}`}
              role="menuitem"
              aria-current={isActive('/start') ? 'page' : undefined}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Start
            </Link>

            <Link
              to="/favorites"
              className={`nav-link ${isActive('/favorites') ? 'active' : ''}`}
              role="menuitem"
              aria-current={isActive('/favorites') ? 'page' : undefined}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill={isActive('/favorites') ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              Saved
              {favoritesCount > 0 && <span className="nav-badge">{favoritesCount}</span>}
            </Link>
          </div>

          {/* Desktop actions */}
          <div className="navbar-actions">
            {/* Owner dashboard link — only visible to owner */}
            {user && (!OWNER_EMAIL || user.email?.toLowerCase() === OWNER_EMAIL) && (
              <Link
                to="/owner"
                className={`nav-admin-link ${isActive('/owner') ? 'active' : ''}`}
                aria-label="Owner dashboard"
                title="Owner Dashboard"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </Link>
            )}

            {/* Dark mode toggle */}
            <button
              className="theme-toggle"
              onClick={theme.toggle}
              aria-label={theme.dark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme.dark ? 'Light mode' : 'Dark mode'}
              type="button"
            >
              {theme.dark ? (
                /* Sun icon (shown in dark mode) */
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                /* Moon icon (shown in light mode) */
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {/* Auth section */}
            {user ? (
              <div className="user-menu-wrapper" ref={userMenuRef} onKeyDown={handleUserMenuKeyDown}>
                <button
                  className="user-avatar-btn"
                  onClick={() => setShowUserMenu((v) => !v)}
                  aria-label="User menu"
                  aria-expanded={showUserMenu}
                  aria-haspopup="true"
                  type="button"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="user-avatar" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="user-avatar-placeholder">
                      {(user.displayName || user.email || '?')[0].toUpperCase()}
                    </span>
                  )}
                </button>

                {showUserMenu && (
                  <div className="user-dropdown" role="menu" aria-label="User options">
                    <div className="user-dropdown-info">
                      <span className="user-dropdown-name">{user.displayName || 'User'}</span>
                      <span className="user-dropdown-email">{user.email}</span>
                    </div>
                    <div className="user-dropdown-divider" role="separator" />
                    <button
                      className="user-dropdown-signout"
                      onClick={handleSignOut}
                      role="menuitem"
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="nav-link-signin" aria-label="Sign in">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Sign In
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              className="hamburger"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
              ref={hamburgerRef}
              type="button"
            >
              <span className="hamburger-line" />
              <span className="hamburger-line" />
              <span className="hamburger-line" />
            </button>
          </div>
        </div>

        {/* Wizard progress stepper */}
        {showStepper && (
          <div className="navbar-stepper" role="progressbar" aria-valuenow={wizardStep + 1} aria-valuemin={1} aria-valuemax={totalSteps}>
            <div
              className="navbar-stepper-fill"
              style={{ width: `${((wizardStep + 1) / totalSteps) * 100}%` }}
            />
            <div className="stepper-labels">
              {STEP_LABELS.slice(0, totalSteps).map((label, i) => (
                <span
                  key={label}
                  className={`stepper-label ${i <= wizardStep ? 'stepper-label-done' : ''} ${i === wizardStep ? 'stepper-label-active' : ''}`}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ── Mobile slide-out menu ──────────────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="mobile-overlay"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="mobile-menu" role="dialog" aria-label="Navigation menu">
            <div className="mobile-menu-header">
              <Link to="/" className="navbar-brand" aria-label="HomeMatch home" onClick={() => setMobileOpen(false)}>
                <span className="brand-icon" aria-hidden="true">&#9978;</span>
                <span className="brand-text">HomeMatch</span>
              </Link>
              <button
                className="mobile-close"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <nav className="mobile-nav-links" aria-label="Mobile navigation">
              <Link
                to="/start"
                className={`mobile-nav-link ${isActive('/start') ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Start
              </Link>

              <Link
                to="/favorites"
                className={`mobile-nav-link ${isActive('/favorites') ? 'active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={isActive('/favorites') ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                Saved
                {favoritesCount > 0 && <span className="nav-badge">{favoritesCount}</span>}
              </Link>
            </nav>

            <div className="mobile-divider" />

            {/* Owner dashboard in mobile — only visible to owner */}
            {user && (!OWNER_EMAIL || user.email?.toLowerCase() === OWNER_EMAIL) && (
              <>
                <Link
                  to="/owner"
                  className={`mobile-nav-link ${isActive('/owner') ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Dashboard
                </Link>
                <div className="mobile-divider" />
              </>
            )}

            {/* Theme toggle in mobile */}
            <button
              className="mobile-theme-toggle"
              onClick={theme.toggle}
              type="button"
            >
              {theme.dark ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
              {theme.dark ? 'Light Mode' : 'Dark Mode'}
            </button>

            <div className="mobile-divider" />

            {/* Auth in mobile */}
            {user ? (
              <div className="mobile-user-section">
                <div className="mobile-user-info">
                  <span className="mobile-user-avatar">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="user-avatar-placeholder">
                        {(user.displayName || user.email || '?')[0].toUpperCase()}
                      </span>
                    )}
                  </span>
                  <div className="mobile-user-details">
                    <span className="mobile-user-name">{user.displayName || 'User'}</span>
                    <span className="mobile-user-email">{user.email}</span>
                  </div>
                </div>
                <button
                  className="mobile-signout"
                  onClick={handleSignOut}
                  type="button"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="mobile-signin"
                onClick={() => setMobileOpen(false)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Sign In
              </Link>
            )}
          </aside>
        </>
      )}
    </>
  );
}

export default Navbar;
