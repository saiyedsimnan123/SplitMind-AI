export function AuthVisualPreview() {
  return (
    <div className="auth-visual-preview" aria-label="SplitMind AI connected group finance overview">
      <div className="auth-visual-head">
        <span className="auth-visual-dot" aria-hidden="true" />
        <span className="auth-visual-title">SMARTSPLIT INTELLIGENCE</span>
        <span className="auth-visual-status">RLS Verified</span>
      </div>

      <svg
        className="auth-network-svg"
        viewBox="0 0 420 112"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Connected group nodes coordinating budgets, payment flows, and settlement analytics"
      >
        <defs>
          <linearGradient id="sm-flow-a" x1="48" y1="56" x2="210" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="sm-flow-b" x1="210" y1="56" x2="372" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="sm-spark-fill" x1="280" y1="22" x2="280" y2="92" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Subtle analytics chart gridlines */}
        <line x1="16" y1="26" x2="404" y2="26" stroke="rgba(148,163,184,0.09)" strokeDasharray="3 4" />
        <line x1="16" y1="56" x2="404" y2="56" stroke="rgba(148,163,184,0.09)" strokeDasharray="3 4" />
        <line x1="16" y1="86" x2="404" y2="86" stroke="rgba(148,163,184,0.09)" strokeDasharray="3 4" />

        {/* Group intelligence payment connectors */}
        <path d="M52 34 C 102 34, 152 56, 206 56" stroke="url(#sm-flow-a)" strokeWidth="2" />
        <path d="M52 78 C 102 78, 152 56, 206 56" stroke="url(#sm-flow-a)" strokeWidth="2" strokeOpacity="0.7" />
        <path d="M214 56 C 272 56, 304 34, 368 34" stroke="url(#sm-flow-b)" strokeWidth="2" />
        <path d="M214 56 C 272 56, 304 78, 368 78" stroke="url(#sm-flow-b)" strokeWidth="2" strokeOpacity="0.7" />

        {/* Analytics sparkline right side */}
        <path
          d="M276 86 L304 74 L330 78 L354 52 L378 58 L402 32 L402 90 L276 90 Z"
          fill="url(#sm-spark-fill)"
        />
        <path
          d="M276 86 L304 74 L330 78 L354 52 L378 58 L402 32"
          stroke="#38BDF8"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Member nodes (Left) */}
        <rect x="20" y="21" width="64" height="26" rx="8" fill="#0F1C3A" stroke="rgba(96,165,250,0.4)" />
        <circle cx="33" cy="34" r="5" fill="#3B82F6" />
        <rect x="43" y="31" width="32" height="5" rx="2.5" fill="#CBD5E1" fillOpacity="0.85" />

        <rect x="20" y="65" width="64" height="26" rx="8" fill="#0F1C3A" stroke="rgba(167,139,250,0.38)" />
        <circle cx="33" cy="78" r="5" fill="#8B5CF6" />
        <rect x="43" y="75" width="32" height="5" rx="2.5" fill="#CBD5E1" fillOpacity="0.7" />

        {/* Central SplitMind Core Node */}
        <circle cx="210" cy="56" r="21" fill="#111F42" stroke="#6366F1" strokeWidth="1.75" />
        <circle cx="210" cy="56" r="13" fill="#1D4ED8" fillOpacity="0.32" />
        <circle cx="210" cy="56" r="4.5" fill="#2DD4BF" />
        <text
          x="210"
          y="92"
          textAnchor="middle"
          fill="#94A3B8"
          fontSize="9"
          fontWeight="600"
          letterSpacing="0.06em"
        >
          SMARTSPLIT AI
        </text>

        {/* Output Settlement Nodes (Right) */}
        <rect x="336" y="21" width="66" height="26" rx="8" fill="#0F1C3A" stroke="rgba(45,212,191,0.42)" />
        <circle cx="349" cy="34" r="4.5" fill="#2DD4BF" />
        <rect x="359" y="31" width="34" height="5" rx="2.5" fill="#E2E8F0" fillOpacity="0.85" />

        <rect x="336" y="65" width="66" height="26" rx="8" fill="#0F1C3A" stroke="rgba(56,189,248,0.35)" />
        <circle cx="349" cy="78" r="4.5" fill="#38BDF8" />
        <rect x="359" y="75" width="34" height="5" rx="2.5" fill="#CBD5E1" fillOpacity="0.72" />
      </svg>

      <div className="auth-visual-metrics">
        <span>SmartSplit Ledger</span>
        <span>Proof Engine</span>
        <span>IntentPay</span>
      </div>
    </div>
  );
}
