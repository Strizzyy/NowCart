import { Link } from 'react-router-dom';

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <p className="text-sm text-muted mb-6">
        <Link to="/" className="hover:text-primary">Home</Link> / <span className="text-dark">Privacy Policy</span>
      </p>

      <h1 className="text-3xl font-heading font-bold text-dark mb-2">Privacy Policy</h1>
      <p className="text-muted text-sm mb-10">Last updated: June 2026</p>

      <div className="space-y-8 text-sm text-muted leading-relaxed">

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">1. Introduction</h2>
          <p>NowCart ("we", "our", "us") is committed to protecting your personal information. This Privacy Policy explains what data we collect, how we use it, and your rights over it. By using our platform you agree to the practices described here.</p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">2. Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><span className="font-medium text-dark">Account information:</span> name, email address, and hashed password when you register.</li>
            <li><span className="font-medium text-dark">Order data:</span> items purchased, quantities, prices, and timestamps to build your order history and power personalised recommendations.</li>
            <li><span className="font-medium text-dark">Usage data:</span> pages visited, search queries, front-door interactions (voice, photo, link, budget), and session identifiers for analytics and performance monitoring.</li>
            <li><span className="font-medium text-dark">Device & technical data:</span> IP address, browser type, and operating system for security and fraud prevention.</li>
            <li><span className="font-medium text-dark">Optional inputs:</span> dish photos you upload (processed in real time and not stored after analysis) and recipe URLs you share.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">3. How We Use Your Data</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>To assemble and deliver your grocery cart and process your orders.</li>
            <li>To personalise your experience — confidence scores, brand preferences, and predictive restock (Subscribe) rely on your order history.</li>
            <li>To improve our AI pipeline, matching algorithms, and product catalog.</li>
            <li>To send transactional emails (order confirmation, delivery updates) and, if you subscribed, our newsletter. You can unsubscribe at any time.</li>
            <li>To detect and prevent fraud, abuse, or security incidents.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">4. Data Sharing</h2>
          <p className="mb-2">We do not sell your personal data. We share data only:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>With delivery partners to fulfil your order (name, address, contact number).</li>
            <li>With cloud service providers (AWS) under strict data processing agreements.</li>
            <li>When required by law or a valid legal process.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">5. Data Retention</h2>
          <p>Account data is retained while your account is active and for up to 2 years after closure for legal and tax purposes. Order history is retained for 7 years as required by Indian GST regulations. Anonymised analytics data may be retained indefinitely.</p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">6. Your Rights</h2>
          <p className="mb-2">Under applicable data protection law you have the right to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Access the personal data we hold about you.</li>
            <li>Correct inaccurate data.</li>
            <li>Request deletion of your account and associated data.</li>
            <li>Opt out of marketing communications at any time.</li>
          </ul>
          <p className="mt-2">To exercise these rights, email us at <span className="text-dark font-medium">hello@nowcart.in</span>.</p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">7. Cookies</h2>
          <p>We use session cookies to maintain your cart and login state. We do not use third-party advertising cookies. You can disable cookies in your browser settings, though some features may not function correctly.</p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">8. Security</h2>
          <p>All data is transmitted over HTTPS. Passwords are stored as salted hashes (bcrypt). Access to production systems is restricted to authorised personnel and protected by IAM roles on AWS.</p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">9. Changes to This Policy</h2>
          <p>We may update this policy periodically. Significant changes will be communicated via email or an in-app notice. Continued use of NowCart after changes constitutes acceptance.</p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">10. Contact</h2>
          <p>For privacy-related questions: <span className="text-dark font-medium">hello@nowcart.in</span> · 1800-266-2278 · Mumbai, India.</p>
        </section>

      </div>
    </div>
  );
}
