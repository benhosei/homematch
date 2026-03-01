import React from 'react';
import { Link } from 'react-router-dom';
import './LegalPages.css';

export default function TermsOfService() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: February 2025</p>

        <div className="legal-important-notice">
          <strong>Important:</strong> HomeMatch is not a licensed real estate brokerage.
          HomeMatch operates as an AI-powered buyer qualification and tour lead platform.
          We do not negotiate real estate transactions, collect commissions, or act as a
          licensed real estate agent or broker.
        </div>

        <section className="legal-section">
          <h2>1. About HomeMatch</h2>
          <p>HomeMatch provides AI-powered tools to help home buyers prepare for the home-buying process,
          including budget analysis, market insights, and readiness assessments. Our platform connects
          qualified buyers with licensed partner agents through our Verified Tour Lead system.</p>
          <p>Our revenue model is a flat fee charged to partner agents for each verified completed tour.
          Buyers use HomeMatch for free.</p>
        </section>

        <section className="legal-section">
          <h2>2. AI Tools Disclaimer</h2>
          <p>All AI-generated insights, scores, estimates, and recommendations provided by HomeMatch
          are for <strong>educational purposes only</strong> and should not be construed as professional
          real estate, financial, or legal advice.</p>
          <p>AI outputs are estimates based on available data and should be reviewed with your licensed
          HomeMatch Partner Agent before making any real estate decisions.</p>
        </section>

        <section className="legal-section">
          <h2>3. Buyer Qualification Process</h2>
          <p>To request a tour through HomeMatch, buyers must complete our qualification process,
          which includes a budget profile, readiness assessment, and timeline confirmation. This
          process is designed to ensure productive tours for both buyers and agents.</p>
        </section>

        <section className="legal-section">
          <h2>4. Agent Partners</h2>
          <p>Partner agents on HomeMatch are independent licensed professionals. HomeMatch does not
          employ, direct, or control partner agents. Agent participation in the HomeMatch platform
          does not create an employer-employee relationship.</p>
        </section>

        <section className="legal-section">
          <h2>5. User Responsibilities</h2>
          <p>Users agree to provide accurate information during the qualification process.
          Misrepresentation of financial status, pre-approval, or intent may result in account
          suspension.</p>
        </section>

        <section className="legal-section">
          <h2>6. Limitation of Liability</h2>
          <p>HomeMatch provides tools and connections but does not guarantee any specific outcome
          from real estate transactions. We are not responsible for the actions or advice of
          partner agents, lenders, or other third parties.</p>
        </section>

        <section className="legal-section">
          <h2>7. Modifications</h2>
          <p>We reserve the right to modify these terms at any time. Continued use of the platform
          after changes constitutes acceptance of the modified terms.</p>
        </section>

        <section className="legal-section">
          <h2>8. Contact</h2>
          <p>Questions about these terms? Contact us at <a href="mailto:legal@homematch.ai">legal@homematch.ai</a></p>
        </section>

        <div className="legal-nav">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/">Return Home</Link>
        </div>
      </div>
    </div>
  );
}
