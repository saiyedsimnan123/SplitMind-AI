"use client";

import {
  CheckCircle2,
  ExternalLink,
  FileText,
  LockKeyhole,
  Plus,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Category, Expense, Member } from "@/lib/finance";
import { money } from "@/components/ui";

const ALLOWED_RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_RECEIPT_BYTES = 250_000;

export function ExpenseModal({
  members,
  categories,
  onClose,
  onSave,
}: {
  members: Member[];
  categories: Category[];
  onClose: () => void;
  onSave: (expense: Expense) => void;
}) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0]?.label ?? "Other");
  const [submitter, setSubmitter] = useState(members[0]?.name ?? "You");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setReceipt(null);
      return;
    }
    if (!ALLOWED_RECEIPT_TYPES.includes(file.type) || file.size > MAX_RECEIPT_BYTES) {
      setReceipt(null);
      event.target.value = "";
      setError("Attach a JPEG, PNG, WebP, or PDF receipt smaller than 250 KB.");
      return;
    }
    setReceipt(file);
    setError("");
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!title.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 10_000_000) {
      setError("Enter a description and a valid amount between ₹1 and ₹1,00,00,000.");
      return;
    }

    let receiptData: string | undefined;
    if (receipt) {
      try {
        receiptData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            typeof reader.result === "string"
              ? resolve(reader.result)
              : reject(new Error("Receipt could not be read."));
          reader.onerror = () => reject(new Error("Receipt could not be read."));
          reader.readAsDataURL(receipt);
        });
      } catch (readError) {
        setError(readError instanceof Error ? readError.message : "Receipt could not be read.");
        return;
      }
    }

    onSave({
      id: crypto.randomUUID(),
      title: title.trim(),
      category,
      amount: parsedAmount,
      submittedBy: submitter,
      verified: false,
      createdAt: "Just now",
      receiptName: receipt?.name,
      receiptData,
    });
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="section-kicker">ADD TO THE LEDGER</div>
            <h2 id="expense-modal-title">Log an expense</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p className="muted-copy">
          New submissions start as unverified until someone opens the attached receipt and confirms review.
        </p>

        <form onSubmit={save}>
          <label className="form-label">
            What was it for?
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Sunday brunch at Anjuna"
            />
          </label>

          <div className="form-two-col">
            <label className="form-label">
              Amount (INR)
              <input
                inputMode="decimal"
                type="number"
                min="1"
                max="10000000"
                step="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0"
              />
            </label>

            <label className="form-label">
              Paid by
              <select value={submitter} onChange={(event) => setSubmitter(event.target.value)}>
                {members.map((member) => (
                  <option key={member.id}>{member.name}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="form-label">
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => (
                <option key={item.id}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="form-label">
            Receipt evidence
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileChange}
            />
            <small>
              {receipt
                ? `${receipt.name} · ${Math.ceil(receipt.size / 1024)} KB`
                : "Optional · JPEG, PNG, WebP, or PDF · max 250 KB"}
            </small>
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="modal-actions">
            <button type="button" className="button button-outline" onClick={onClose}>
              Cancel
            </button>
            <button className="button button-dark" type="submit">
              <Plus size={15} /> Add unverified expense
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function ReceiptReviewModal({
  expense,
  onClose,
  onConfirmVerify,
}: {
  expense: Expense;
  onClose: () => void;
  onConfirmVerify: (id: string) => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const hasReceipt = Boolean(expense.receiptData);
  const isImage = Boolean(expense.receiptData?.startsWith("data:image/"));
  const isPdf = Boolean(expense.receiptData?.startsWith("data:application/pdf"));

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="section-kicker">HUMAN RECEIPT VERIFICATION</div>
            <h2 id="review-modal-title">{expense.title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="review-meta-grid">
          <div>
            <span>Amount</span>
            <strong className="tabular">{money(expense.amount)}</strong>
          </div>
          <div>
            <span>Category</span>
            <strong>{expense.category}</strong>
          </div>
          <div>
            <span>Paid by</span>
            <strong>{expense.submittedBy}</strong>
          </div>
          <div>
            <span>Submitted</span>
            <strong>{expense.createdAt}</strong>
          </div>
        </div>

        {hasReceipt ? (
          <div className="receipt-preview-card">
            <div className="receipt-preview-head">
              <span>
                <FileText size={14} /> {expense.receiptName ?? "Attached receipt"}
              </span>
              <a href={expense.receiptData} target="_blank" rel="noreferrer" className="inline-link">
                Open full file <ExternalLink size={12} />
              </a>
            </div>
            {isImage && (
              <div className="receipt-preview-frame">
                {/* eslint-disable-next-line @next/next/no-img-element -- local FileReader data URL preview */}
                <img src={expense.receiptData} alt={`Receipt for ${expense.title}`} />
              </div>
            )}
            {isPdf && (
              <iframe
                title={`PDF receipt for ${expense.title}`}
                src={expense.receiptData}
                className="receipt-pdf-frame"
              />
            )}
            {!isImage && !isPdf && (
              <p className="muted-copy">
                Use &ldquo;Open full file&rdquo; above to inspect the attached document before confirming.
              </p>
            )}
          </div>
        ) : (
          <div className="receipt-missing-box" role="status">
            <ShieldAlert size={18} />
            <div>
              <strong>No receipt attachment on file</strong>
              <p>
                SplitMind requires a receipt image or PDF before an expense can be marked verified. Ask{" "}
                {expense.submittedBy} to resubmit this entry with an attachment.
              </p>
            </div>
          </div>
        )}

        {hasReceipt && !expense.verified && (
          <label className="confirm-checkbox">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>
              I opened the attached receipt and confirm the amount ({money(expense.amount)}) and details match.
            </span>
          </label>
        )}

        <div className="safety-note">
          <LockKeyhole size={14} />
          <span>
            OCR and automated duplicate checks are not used; verification reflects explicit human review.
          </span>
        </div>

        <div className="modal-actions">
          <button type="button" className="button button-outline" onClick={onClose}>
            Close
          </button>
          {hasReceipt && !expense.verified && (
            <button
              type="button"
              className="button button-dark"
              disabled={!acknowledged}
              onClick={() => onConfirmVerify(expense.id)}
            >
              <ShieldCheck size={15} /> Confirm &amp; mark verified
            </button>
          )}
          {expense.verified && (
            <span className="status-pill status-pill-verified">
              <CheckCircle2 size={14} /> Already verified
            </span>
          )}
        </div>
      </section>
    </div>
  );
}

export function AddMemberModal({
  members,
  onClose,
  onAdd,
}: {
  members: Member[];
  onClose: () => void;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (members.length >= 30) {
      setError("A demo group can have up to 30 members.");
      return;
    }
    if (!trimmed) {
      setError("Enter a friend's name to add them to Goa Trip 2026.");
      return;
    }
    if (trimmed.length > 80) {
      setError("Keep member names under 80 characters.");
      return;
    }
    if (members.some((member) => member.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      setError(`${trimmed} is already in this group.`);
      return;
    }
    onAdd(trimmed);
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="section-kicker">GROUP ROSTER</div>
            <h2 id="member-modal-title">Add a group member</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p className="muted-copy">
          New members start with ₹0 contributed and are included in SmartSplit equal-share calculations.
        </p>

        <form onSubmit={submit}>
          <label className="form-label">
            Friend&apos;s name
            <input
              autoFocus
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
              placeholder="e.g. Rohan Verma"
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="modal-actions">
            <button type="button" className="button button-outline" onClick={onClose}>
              Cancel
            </button>
            <button className="button button-dark" type="submit">
              <UserPlus size={15} /> Add to group
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
