"use client";

import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import type { CurrencyCode, PaymentFeedback } from "@/lib/types";

export function PaymentsView({
  groupName,
  groupCurrency,
  paymentAmount,
  paymentBusy,
  paymentFeedback,
  onChangeAmount,
  onCreateOrder,
}: {
  groupName: string;
  groupCurrency: CurrencyCode;
  paymentAmount: string;
  paymentBusy: boolean;
  paymentFeedback: PaymentFeedback;
  onChangeAmount: (value: string) => void;
  onCreateOrder: () => void;
}) {
  const isValidFormat =
    /^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/.test(paymentAmount) &&
    Number(paymentAmount) >= 0.01 &&
    Number(paymentAmount) <= 9999.99;

  return (
    <div className="workspace-grid">
      <section className="panel payment-panel">
        <div className="panel-heading">
          <div>
            <div className="section-kicker">{groupName.toUpperCase()} · PAYPAL SANDBOX</div>
            <h2>Payments, with a paper trail.</h2>
          </div>
          <span className="save-badge">
            <ShieldCheck size={14} /> USD Sandbox only
          </span>
        </div>

        <p className="muted-copy">
          Create a PayPal Sandbox order linked to {groupName}. PayPal holds and transfers funds directly
          between test accounts—SplitMind is not a wallet or custodian, and USD Sandbox amounts are separate
          from the {groupCurrency} group ledger.
        </p>

        <div className="preset-chips" aria-label="Quick Sandbox USD amounts">
          {["10.00", "25.00", "50.00", "100.00"].map((preset) => (
            <button
              type="button"
              key={preset}
              className={`preset-chip tabular ${paymentAmount === preset ? "active" : ""}`}
              onClick={() => onChangeAmount(preset)}
              disabled={paymentBusy}
            >
              ${preset} USD
            </button>
          ))}
        </div>

        <label className="form-label">
          Sandbox payment amount (USD)
          <input
            value={paymentAmount}
            onChange={(event) => onChangeAmount(event.target.value)}
            inputMode="decimal"
            placeholder="10.00"
            disabled={paymentBusy}
          />
          <small>
            {isValidFormat
              ? "Allowed range: $0.01 – $9,999.99 USD · Protected by client idempotency key."
              : "Enter a valid USD amount between 0.01 and 9999.99 (up to 2 decimal places)."}
          </small>
        </label>

        <button
          type="button"
          className="button button-dark"
          onClick={onCreateOrder}
          disabled={paymentBusy || !paymentAmount.trim()}
        >
          {paymentBusy ? <Loader2 size={15} className="spin" /> : <CreditCard size={15} />}
          {paymentBusy ? "Working with PayPal..." : "Continue to PayPal Sandbox"}
          {!paymentBusy && <ArrowUpRight size={14} />}
        </button>

        {paymentFeedback.tone !== "idle" && (
          <div className={`payment-banner payment-banner-${paymentFeedback.tone}`} role="status">
            <div className="payment-banner-icon">
              {paymentFeedback.tone === "success" && <CheckCircle2 size={17} />}
              {paymentFeedback.tone === "pending" && <Clock3 size={17} />}
              {(paymentFeedback.tone === "warning" || paymentFeedback.tone === "error") && (
                <AlertCircle size={17} />
              )}
            </div>
            <div className="payment-banner-copy">
              <strong>{paymentFeedback.headline}</strong>
              {paymentFeedback.detail && <p>{paymentFeedback.detail}</p>}
              {paymentFeedback.captureId && (
                <div className="payment-meta-chips">
                  <span className="tabular">
                    {paymentFeedback.amount} {paymentFeedback.currency}
                  </span>
                  <span className="mono-chip">Capture: {paymentFeedback.captureId}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="safety-note">
          <LockKeyhole size={14} />
          <span>
            Orders are persisted before redirect and only marked <strong>COMPLETED</strong> after server-side
            PayPal capture and exact amount/currency verification.
          </span>
        </div>
      </section>

      <aside className="panel">
        <div className="section-kicker">BEFORE YOU START</div>
        <h2>What happens next?</h2>

        <div className="steps-list">
          <div>
            <span>01</span>
            <p>
              <strong>Server creates an order.</strong>
              <br />
              Your browser sends an idempotency key; PayPal credentials never leave the server.
            </p>
          </div>
          <div>
            <span>02</span>
            <p>
              <strong>Approve at PayPal Sandbox.</strong>
              <br />
              Sign in with a Sandbox test buyer account. Cancellations never mark an order paid.
            </p>
          </div>
          <div>
            <span>03</span>
            <p>
              <strong>Server verifies capture.</strong>
              <br />
              Return redirects trigger server-side capture and amount/currency reconciliation in Supabase.
            </p>
          </div>
        </div>

        <a
          className="inline-link"
          href="https://developer.paypal.com/tools/sandbox/"
          target="_blank"
          rel="noreferrer"
        >
          PayPal Sandbox setup <ArrowUpRight size={13} />
        </a>
      </aside>
    </div>
  );
}
