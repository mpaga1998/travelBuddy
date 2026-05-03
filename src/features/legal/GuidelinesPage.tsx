interface GuidelinesPageProps {
  onBack: () => void;
}

export function GuidelinesPage({ onBack }: GuidelinesPageProps) {
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
        <h1 className="text-lg font-semibold text-gray-900 m-0">Community Guidelines</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Draft notice */}
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
          Draft pending legal review.
        </div>

        <p className="text-sm text-gray-500 mb-8">Last updated: April 28, 2026</p>

        <h1 className="text-2xl font-bold mb-4">Community Guidelines</h1>
        <p className="mb-8 leading-relaxed text-gray-700">
          nook exists to help travellers discover and share great experiences. These
          guidelines set out what kind of community we want to build — and what we won't tolerate.
          By using the platform you agree to follow them.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">1. No Harassment, Hate Speech, or Threats</h2>
        <p className="mb-4 leading-relaxed">
          Harassment, hate speech, threats, and personal attacks of any kind are strictly
          prohibited. This includes content that targets individuals or groups based on race,
          ethnicity, nationality, religion, gender, sexual orientation, disability, or any other
          characteristic. Treat every member of the community with respect.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">2. Respect for Private Locations</h2>
        <p className="mb-4 leading-relaxed">
          Do not pin, map, or otherwise share the location of private addresses without the
          owner's explicit consent. This includes private residences, unlisted accommodation
          (such as a small guest house whose host has not consented to public listing), and
          similar sensitive addresses. Doxxing — the deliberate exposure of someone's private
          location — is a serious violation and may result in immediate account termination.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">3. No Illegal-Activity Recommendations</h2>
        <p className="mb-4 leading-relaxed">
          Do not post content that encourages, facilitates, or glorifies illegal activity. This
          includes recommendations involving drug use or purchase, smuggling, unauthorised border
          crossings, and anything else that could endanger you, other travellers, or local
          communities. Content of this nature will be removed and may be reported to the relevant
          authorities.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">4. No Spam or Low-Effort Content</h2>
        <p className="mb-4 leading-relaxed">
          Spam, scraped content, duplicate pins, and low-effort submissions that add no genuine
          value to the community are prohibited. Every pin or itinerary you share should reflect a
          real experience or a genuine recommendation that another traveller would find useful.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">5. Disclose Commercial Relationships</h2>
        <p className="mb-4 leading-relaxed">
          Commercial promotion is permitted on nook, but only with clear and honest
          disclosure. If you operate a hostel, tour company, or other travel business, you must
          self-identify by selecting the appropriate account role when setting up your profile
          (the platform supports <strong>Traveler</strong> and <strong>Hostel</strong> profiles).
          Posting commercial content under a personal-traveler identity without disclosure is a
          violation of these guidelines.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">6. Reporting and Moderation</h2>
        <p className="mb-4 leading-relaxed">
          If you see a pin that violates these guidelines, please report it using the report button
          on the pin. Pins that receive three or more reports are automatically hidden from the map
          and queued for admin review. A moderator will then review the content and either restore
          the pin or remove it permanently. We aim to review flagged content promptly.
        </p>

        <h2 className="text-lg font-semibold mt-8 mb-3">7. Consequences</h2>
        <p className="mb-4 leading-relaxed">
          Violations of these guidelines may result in a formal warning, a temporary suspension of
          your account, or a permanent ban — the appropriate action is determined at our
          discretion based on the severity and frequency of the violation. Serious violations,
          including illegal content, may also be reported to the relevant authorities.
        </p>

        <hr className="my-8 border-gray-200" />
        <p className="text-sm text-gray-500">
          See something that violates these guidelines? Use the report button on any pin to flag
          it for review.
        </p>
      </main>
    </div>
  );
}
