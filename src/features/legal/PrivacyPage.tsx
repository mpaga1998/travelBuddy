interface PrivacyPageProps {
  onBack: () => void;
}

export function PrivacyPage({ onBack }: PrivacyPageProps) {
  return (
    <div className="h-screen overflow-y-auto bg-white text-gray-900">
      <header className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 z-10">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 shrink-0"
        >
          ← Back
        </button>
        <h1 className="text-lg font-semibold text-gray-900 m-0">Privacy Policy</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Draft notice */}
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
          Draft pending legal review.
        </div>

        <p className="text-sm text-gray-500 mb-8">Last updated: June 5, 2026</p>

        <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>

        <p className="mb-6 leading-relaxed text-gray-700">
          nook ("we", "our", "us") is committed to protecting your personal data. This policy explains
          what data we collect, why we collect it, how we use it, and what rights you have under the
          General Data Protection Regulation (GDPR) and applicable Italian law.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">1. Data Controller</h2>
        <p className="mb-4 leading-relaxed">
          The data controller is the operator of nook. For any privacy-related requests, contact us
          through the app.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">2. Data We Collect</h2>
        <p className="mb-3 leading-relaxed">We collect only what is necessary to operate the service:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
          <li>
            <strong>Account data:</strong> email address, username, optional first name and profile
            picture — provided when you sign up.
          </li>
          <li>
            <strong>Content you create:</strong> pins (title, description, category, photos, tips,
            geographic coordinates), itineraries, reactions, and bookmarks.
          </li>
          <li>
            <strong>Usage data:</strong> timestamps of actions (e.g. when a pin was created), your
            IP address (retained in server logs for up to 30 days for security purposes).
          </li>
          <li>
            <strong>AI inputs:</strong> the trip details you submit to the itinerary generator
            (destination, dates, preferences, notes). These are sent to OpenAI for processing — see
            Section 5.
          </li>
        </ul>
        <p className="mb-4 leading-relaxed">
          We do <strong>not</strong> collect payment information, precise device location, or
          advertising identifiers.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">3. Legal Basis for Processing</h2>
        <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
          <li>
            <strong>Performance of a contract (Art. 6(1)(b) GDPR):</strong> processing your account
            data and content is necessary to provide the service you signed up for.
          </li>
          <li>
            <strong>Legitimate interests (Art. 6(1)(f) GDPR):</strong> security logging, fraud
            prevention, and service improvement.
          </li>
          <li>
            <strong>Consent (Art. 6(1)(a) GDPR):</strong> where we rely on consent (e.g. optional
            marketing communications), you may withdraw it at any time.
          </li>
        </ul>

        <h2 className="text-lg font-semibold mt-8 mb-3">4. How We Use Your Data</h2>
        <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
          <li>To create and manage your account.</li>
          <li>To display your pins and itineraries on the map and to other users.</li>
          <li>To generate AI-powered itineraries based on your trip inputs.</li>
          <li>To enforce our Community Guidelines and Terms of Service.</li>
          <li>To investigate security incidents and prevent abuse.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-8 mb-3">5. Third-Party Services</h2>
        <p className="mb-3 leading-relaxed">We use the following sub-processors:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
          <li>
            <strong>Supabase</strong> (database and authentication) — data is stored in EU data
            centres. See <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">supabase.com/privacy</a>.
          </li>
          <li>
            <strong>Mapbox</strong> (maps and geocoding) — location search queries are sent to
            Mapbox. See <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline">mapbox.com/legal/privacy</a>.
          </li>
          <li>
            <strong>OpenAI</strong> (itinerary generation and content moderation) — your trip inputs
            and pin text are sent to OpenAI's API. OpenAI does not use API data to train its models
            by default. See <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline">openai.com/policies/privacy-policy</a>.
          </li>
          <li>
            <strong>Vercel</strong> (hosting and serverless functions) — request logs including IP
            addresses are retained per Vercel's data retention policy. See <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline">vercel.com/legal/privacy-policy</a>.
          </li>
          <li>
            <strong>Sentry</strong> (error tracking, optional) — error reports may include
            anonymised request context. No personal data is intentionally sent to Sentry.
          </li>
        </ul>

        <h2 className="text-lg font-semibold mt-8 mb-3">6. Cookies and Local Storage</h2>
        <p className="mb-4 leading-relaxed">
          nook uses <strong>no third-party advertising or tracking cookies</strong>. We use:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
          <li>
            <strong>Authentication session storage</strong> (via Supabase): a session token stored in
            your browser's local storage to keep you signed in. This is strictly necessary for the
            service to function and does not require consent under the ePrivacy Directive.
          </li>
        </ul>
        <p className="mb-4 leading-relaxed">
          You can clear this data at any time by signing out or clearing your browser storage.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">7. Data Retention</h2>
        <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
          <li>Account and content data: retained until you delete your account.</li>
          <li>Server logs (IP addresses): deleted after 30 days.</li>
          <li>Deleted content: removed from our database immediately; may persist in backups for up to 30 days.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-8 mb-3">8. Your Rights (GDPR)</h2>
        <p className="mb-3 leading-relaxed">Under the GDPR you have the right to:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
          <li><strong>Access</strong> a copy of the personal data we hold about you.</li>
          <li><strong>Rectification</strong> of inaccurate or incomplete data.</li>
          <li><strong>Erasure</strong> ("right to be forgotten") — delete your account from your profile settings.</li>
          <li><strong>Restriction</strong> of processing in certain circumstances.</li>
          <li><strong>Data portability</strong> — receive your data in a machine-readable format.</li>
          <li><strong>Object</strong> to processing based on legitimate interests.</li>
          <li><strong>Withdraw consent</strong> at any time where processing is consent-based.</li>
        </ul>
        <p className="mb-4 leading-relaxed">
          To exercise any of these rights, contact us through the app. We will respond within 30 days.
          You also have the right to lodge a complaint with the Italian data protection authority
          (Garante per la protezione dei dati personali, <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" className="underline">garanteprivacy.it</a>).
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">9. Changes to This Policy</h2>
        <p className="mb-4 leading-relaxed">
          We may update this policy from time to time. When we do, we will revise the "Last updated"
          date at the top of this page. For material changes we will notify you by email or in-app
          notice. Your continued use of the service after any change constitutes acceptance of the
          revised policy.
        </p>

        <hr className="my-8 border-gray-200" />
        <p className="text-sm text-gray-500">
          Privacy questions? Contact us through the app.
        </p>
      </main>
    </div>
  );
}
