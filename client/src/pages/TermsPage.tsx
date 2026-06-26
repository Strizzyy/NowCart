import { Link } from 'react-router-dom';

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <p className="text-sm text-muted mb-6">
        <Link to="/" className="hover:text-primary">Home</Link> / <span className="text-dark">Terms & Conditions</span>
      </p>

      <h1 className="text-3xl font-heading font-bold text-dark mb-2">Terms & Conditions</h1>
      <p className="text-muted text-sm mb-10">Last updated: June 2026</p>

      <div className="space-y-8 text-sm text-muted leading-relaxed">

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">1. Acceptance of Terms</h2>
          <p>By accessing or using NowCart ("Platform", "we", "us") you agree to be bound by these Terms & Conditions. If you do not agree, please do not use the Platform. These terms apply to all visitors, registered users, and purchasers.</p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">2. Eligibility</h2>
          <p>You must be at least 18 years old and capable of entering into a legally binding contract under the Indian Contract Act, 1872, to use NowCart. By using the Platform you represent that you meet this requirement.</p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">3. Platform Use</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>NowCart is an intent-capture and cart-assembly service. We facilitate the ordering of grocery and household products from our catalog.</li>
            <li>You are responsible for the accuracy of the delivery address and contact information provided at checkout.</li>
            <li>You agree not to misuse the Platform, including through automated scraping, reverse engineering, or submitting fraudulent orders.</li>
            <li>NowCart reserves the right to suspend or terminate accounts engaged in abusive, fraudulent, or unlawful activity.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">4. Orders & Pricing</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>All prices are in Indian Rupees (₹) and inclusive of applicable taxes unless stated otherwise.</li>
            <li>Prices are subject to change without notice. The price shown at the time you confirm your cart is the price you will be charged.</li>
            <li>NowCart reserves the right to cancel or limit orders in cases of pricing errors, stock unavailability, or suspected fraud. A full refund will be issued for any cancelled paid orders.</li>
            <li>Out-of-stock substitutions are offered transparently within the cart. You may remove any substituted item before checkout.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">5. Payment</h2>
          <p className="mb-2">We accept UPI, credit/debit cards, and net banking via our payment partners. All transactions are processed over secure, encrypted channels. NowCart does not store card details.</p>
          <p>In the event of a payment failure, your order will not be placed. Please retry or use an alternate payment method.</p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">6. Cancellations & Refunds</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Orders may be cancelled within 60 seconds of placement for a full refund.</li>
            <li>Once the order is picked up by a delivery partner, cancellations are not guaranteed.</li>
            <li>Refunds for defective, damaged, or incorrect products are processed within 3–5 business days to the original payment method.</li>
            <li>NowCart credits issued as compensation expire 90 days after issue.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">7. AI-Assisted Cart Assembly</h2>
          <p className="mb-2">NowCart uses AI to suggest products based on your stated intent. These suggestions are:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Presented with confidence scores and reasoning to help you make an informed decision.</li>
            <li>Not guaranteed to be error-free. You should review your cart before confirming checkout.</li>
            <li>Subject to catalog availability. Substitutions are clearly marked and can be removed.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">8. Intellectual Property</h2>
          <p>All content on the Platform — including the NowCart brand, design, AI pipeline, and codebase — is the intellectual property of NowCart and its licensors. You may not copy, modify, distribute, or create derivative works without our prior written consent.</p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">9. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, NowCart is not liable for indirect, incidental, or consequential damages arising from use of the Platform. Our total liability for any claim is limited to the value of the order in question.</p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">10. Governing Law</h2>
          <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Mumbai, Maharashtra.</p>
        </section>

        <section>
          <h2 className="text-lg font-heading font-bold text-dark mb-3">11. Contact</h2>
          <p>For questions about these Terms: <span className="text-dark font-medium">hello@nowcart.in</span> · 1800-266-2278 · Mumbai, India.</p>
        </section>

      </div>
    </div>
  );
}
