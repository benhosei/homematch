import React from 'react';
import { Link } from 'react-router-dom';
import './LegalPages.css';

export default function PrivacyPolicy() {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: February 2025</p>

        <section className="legal-section">
          <h2>1. Information We Collect</h2>
          <p>We collect information you provide during the buyer qualification process, including:</p>
          <ul>
            <li>Contact information (name, email, phone)</li>
            <li>Financial readiness data (budget range, pre-approval status, timeline)</li>
            <li>Search preferences (location, property type, features)</li>
            <li>Tour activity and completion status</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>To qualify and match you with appropriate listings and partner agents</li>
            <li>To provide personalized AI-powered insights and recommendations</li>
            <li>To verify tour completion for our partner agent billing</li>
            <li>To improve our platform and AI tools</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>3. Information Sharing</h2>
          <p>We share your qualification data with matched partner agents to facilitate productive tours.
          We do not sell your personal information to third parties. Agent partners receive only the
          information necessary to prepare for your tour.</p>
        </section>

        <section className="legal-section">
          <h2>4. Data Security</h2>
          <p>We use industry-standard encryption and security practices to protect your data.
          Financial information is processed securely and is not stored beyond what is necessary
          for qualification purposes.</p>
        </section>

        <section className="legal-section">
          <h2>5. Your Rights</h2>
          <p>You may request access to, correction of, or deletion of your personal data at any time
          by contacting us. You may also opt out of marketing communications.</p>
        </section>

        <section className="legal-section">
          <h2>6. Cookies &amp; Analytics</h2>
          <p>We use cookies and analytics tools to improve your experience. You can control cookie
          preferences through your browser settings.</p>
        </section>

        <section className="legal-section">
          <h2>7. Contact</h2>
          <p>Privacy questions? Contact us at <a href="mailto:privacy@homematch.ai">privacy@homematch.ai</a></p>
        </section>

        <div className="legal-nav">
          <Link to="/terms">Terms of Service</Link>
          <Link to="/">Return Home</Link>
        </div>
      </div>
    </div>
  );
}
