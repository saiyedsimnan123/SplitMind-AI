"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderPlus,
  Loader2,
  LockKeyhole,
  Plus,
  Save,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { CURRENCY_META, PLAN_TYPE_LABELS, getCurrencySymbol, type Category } from "@/lib/finance";
import type {
  CurrencyCode,
  GroupExpense,
  GroupMember,
  GroupRecord,
  GroupRole,
  PlanType,
} from "@/lib/types";
import { money } from "@/components/ui";

const ALLOWED_RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_RECEIPT_BYTES = 250_000;

function useEscapeClose(onClose: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
}

export function ConfirmDialog({
  kicker = "CONFIRM ACTION",
  title,
  message,
  confirmLabel = "Confirm",
  tone = "danger",
  busy = false,
  onCancel,
  onConfirm,
}: {
  kicker?: string;
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEscapeClose(onCancel);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="section-kicker">{kicker}</div>
            <h2 id="confirm-dialog-title">{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Close" disabled={busy}>
            <X size={18} />
          </button>
        </div>

        <div className={tone === "danger" ? "confirm-warning-box" : "safety-note"} style={{ marginTop: 14 }}>
          <AlertTriangle size={17} />
          <span>{message}</span>
        </div>

        <div className="modal-actions">
          <button type="button" className="button button-outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`button ${tone === "danger" ? "button-danger" : "button-primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <Loader2 size={14} className="spin" />}
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function GroupModal({
  mode,
  initialGroup,
  defaultCurrency = "INR",
  busy = false,
  serverError = "",
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  initialGroup?: GroupRecord;
  defaultCurrency?: CurrencyCode;
  busy?: boolean;
  serverError?: string;
  onClose: () => void;
  onSubmit: (values: {
    name: string;
    planType: PlanType;
    description: string;
    currency: CurrencyCode;
    totalBudget: number;
    startDate: string;
    endDate: string | null;
  }) => void;
}) {
  useEscapeClose(onClose);

  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState(initialGroup?.name ?? "");
  const [planType, setPlanType] = useState<PlanType>(initialGroup?.planType ?? "trip");
  const [description, setDescription] = useState(initialGroup?.description ?? "");
  const [currency, setCurrency] = useState<CurrencyCode>(initialGroup?.currency ?? defaultCurrency);
  const [totalBudget, setTotalBudget] = useState(
    initialGroup ? String(initialGroup.totalBudget) : "25000",
  );
  const [startDate, setStartDate] = useState(initialGroup?.startDate ?? today);
  const [endDate, setEndDate] = useState(initialGroup?.endDate ?? "");
  const [error, setError] = useState("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      setError("Enter a group name between 1 and 100 characters.");
      return;
    }
    if (description.trim().length > 500) {
      setError("Keep the group description under 500 characters.");
      return;
    }
    const parsedBudget = Number(totalBudget);
    if (!Number.isFinite(parsedBudget) || parsedBudget < 0 || parsedBudget > 100_000_000) {
      setError("Enter a valid non-negative total budget up to 100,000,000.");
      return;
    }
    if (!startDate) {
      setError("Choose a start date for this group.");
      return;
    }
    if (endDate && endDate < startDate) {
      setError("End date cannot be earlier than start date.");
      return;
    }

    setError("");
    onSubmit({
      name: trimmedName,
      planType,
      description: description.trim(),
      currency,
      totalBudget: Math.round(parsedBudget * 100) / 100,
      startDate,
      endDate: endDate.trim() || null,
    });
  };

  const displayError = error || serverError;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="section-kicker">{mode === "create" ? "NEW SHARED WORKSPACE" : "EDIT GROUP DETAILS"}</div>
            <h2 id="group-modal-title">{mode === "create" ? "Create a new group" : `Edit ${initialGroup?.name}`}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close" disabled={busy}>
            <X size={18} />
          </button>
        </div>

        <p className="muted-copy">
          {mode === "create"
            ? "Each group maintains its own members, budget categories, expenses, contributions, and settlement plan."
            : "Changes apply only to this group. Updating the total budget scales category allocations proportionally."}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-two-col">
            <label className="form-label">
              Group name
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Indiranagar Flat 4B"
                disabled={busy}
              />
            </label>

            <label className="form-label">
              Plan type
              <select value={planType} onChange={(e) => setPlanType(e.target.value as PlanType)} disabled={busy}>
                {(Object.keys(PLAN_TYPE_LABELS) as PlanType[]).map((key) => (
                  <option key={key} value={key}>
                    {PLAN_TYPE_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="form-label">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Monthly rent, electricity, Wi-Fi and shared groceries"
              disabled={busy}
            />
          </label>

          <div className="form-two-col">
            <label className="form-label">
              Currency
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                disabled={busy}
              >
                {(Object.keys(CURRENCY_META) as CurrencyCode[]).map((code) => (
                  <option key={code} value={code}>
                    {CURRENCY_META[code].label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-label">
              Total budget ({getCurrencySymbol(currency)})
              <input
                type="number"
                min="0"
                max="100000000"
                step="any"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>

          <div className="form-two-col">
            <label className="form-label">
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={busy}
              />
            </label>

            <label className="form-label">
              End date (optional)
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={busy}
              />
            </label>
          </div>

          {displayError && (
            <p className="form-error" role="alert">
              {displayError}
            </p>
          )}

          <div className="modal-actions">
            <button type="button" className="button button-outline" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? (
                <Loader2 size={15} className="spin" />
              ) : mode === "create" ? (
                <FolderPlus size={15} />
              ) : (
                <Save size={15} />
              )}
              {busy
                ? mode === "create"
                  ? "Creating group..."
                  : "Saving..."
                : mode === "create"
                  ? "Create group"
                  : "Save group changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function ExpenseModal({
  groupName,
  currency,
  members,
  categories,
  initialExpense,
  busy = false,
  onClose,
  onSave,
}: {
  groupName: string;
  currency: CurrencyCode;
  members: GroupMember[];
  categories: Category[];
  initialExpense?: GroupExpense | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (expense: {
    id?: string;
    title: string;
    amount: number;
    category: string;
    paidByMemberId: string;
    submittedBy: string;
    date: string;
    notes: string;
    receiptName?: string;
    receiptData?: string;
  }) => void;
}) {
  useEscapeClose(onClose);

  const isEdit = Boolean(initialExpense);
  const [title, setTitle] = useState(initialExpense?.title ?? "");
  const [amount, setAmount] = useState(initialExpense ? String(initialExpense.amount) : "");
  const [category, setCategory] = useState(initialExpense?.category ?? categories[0]?.label ?? "Other");
  const initialMember =
    members.find((m) => m.id === initialExpense?.paidByMemberId) ??
    members.find((m) => m.name === initialExpense?.submittedBy) ??
    members[0];
  const [paidByMemberId, setPaidByMemberId] = useState(initialMember?.id ?? "");
  const [date, setDate] = useState(initialExpense?.date ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(initialExpense?.notes ?? "");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState("");

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
      setError(`Enter a description and a valid amount greater than 0 ${currency}.`);
      return;
    }
    const payer = members.find((m) => m.id === paidByMemberId) ?? members[0];
    if (!payer) {
      setError("Add a member to the group before logging expenses.");
      return;
    }

    let receiptData = initialExpense?.receiptData;
    let receiptName = initialExpense?.receiptName;
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
        receiptName = receipt.name;
      } catch (readError) {
        setError(readError instanceof Error ? readError.message : "Receipt could not be read.");
        return;
      }
    }

    onSave({
      id: initialExpense?.id,
      title: title.trim(),
      category,
      amount: Math.round(parsedAmount * 100) / 100,
      paidByMemberId: payer.id,
      submittedBy: payer.name,
      date,
      notes: notes.trim(),
      receiptName,
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
            <div className="section-kicker">{groupName.toUpperCase()} · LEDGER</div>
            <h2 id="expense-modal-title">{isEdit ? "Edit expense" : "Log an expense"}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close" disabled={busy}>
            <X size={18} />
          </button>
        </div>

        <p className="muted-copy">
          {isEdit
            ? "Updating the amount or payer automatically recalculates group balances and remaining budget."
            : "New submissions start as unverified until someone opens the attached receipt and confirms review."}
        </p>

        <form onSubmit={save}>
          <label className="form-label">
            What was it for?
            <input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Shared groceries or booking deposit"
              disabled={busy}
            />
          </label>

          <div className="form-two-col">
            <label className="form-label">
              Amount ({currency})
              <input
                inputMode="decimal"
                type="number"
                min="0.01"
                max="10000000"
                step="any"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0"
                disabled={busy}
              />
            </label>

            <label className="form-label">
              Paid by
              <select
                value={paidByMemberId}
                onChange={(event) => setPaidByMemberId(event.target.value)}
                disabled={busy}
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-two-col">
            <label className="form-label">
              Category
              <select value={category} onChange={(event) => setCategory(event.target.value)} disabled={busy}>
                {categories.map((item) => (
                  <option key={item.id} value={item.label}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-label">
              Expense date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
            </label>
          </div>

          <label className="form-label">
            Notes (optional)
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Invoice reference or split context"
              disabled={busy}
            />
          </label>

          {!isEdit && (
            <label className="form-label">
              Receipt evidence
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                disabled={busy}
              />
              <small>
                {receipt
                  ? `${receipt.name} · ${Math.ceil(receipt.size / 1024)} KB`
                  : "Optional · JPEG, PNG, WebP, or PDF · max 250 KB"}
              </small>
            </label>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="modal-actions">
            <button type="button" className="button button-outline" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? <Loader2 size={15} className="spin" /> : isEdit ? <Save size={15} /> : <Plus size={15} />}
              {busy ? "Saving..." : isEdit ? "Save changes" : "Add unverified expense"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function ReceiptReviewModal({
  expense,
  currency = "INR",
  onClose,
  onConfirmVerify,
}: {
  expense: GroupExpense;
  currency?: CurrencyCode;
  onClose: () => void;
  onConfirmVerify: (id: string) => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  useEscapeClose(onClose);

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
            <strong className="tabular">{money(expense.amount, currency)}</strong>
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
              I opened the attached receipt and confirm the amount ({money(expense.amount, currency)}) and details match.
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
              className="button button-primary"
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

export function MemberModal({
  mode,
  groupName,
  currency,
  members,
  initialMember,
  busy = false,
  onClose,
  onSubmit,
}: {
  mode: "add" | "edit";
  groupName: string;
  currency: CurrencyCode;
  members: GroupMember[];
  initialMember?: GroupMember | null;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (values: { id?: string; name: string; role: GroupRole; email: string }) => void;
}) {
  useEscapeClose(onClose);

  const [name, setName] = useState(initialMember?.name ?? "");
  const [role, setRole] = useState<GroupRole>(initialMember?.role ?? "member");
  const [email, setEmail] = useState(initialMember?.email ?? "");
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (mode === "add" && members.length >= 30) {
      setError("A group can have up to 30 members.");
      return;
    }
    if (!trimmed) {
      setError(`Enter a name to ${mode === "add" ? "add to" : "update in"} ${groupName}.`);
      return;
    }
    if (trimmed.length > 80) {
      setError("Keep member names under 80 characters.");
      return;
    }
    if (
      members.some(
        (member) =>
          member.id !== initialMember?.id &&
          member.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
      )
    ) {
      setError(`${trimmed} is already in ${groupName}.`);
      return;
    }
    if (initialMember?.role === "owner" && role !== "owner") {
      setError("Transfer ownership to another member before changing the current owner's role.");
      return;
    }
    onSubmit({
      id: initialMember?.id,
      name: trimmed,
      role,
      email: email.trim(),
    });
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
            <div className="section-kicker">{groupName.toUpperCase()} · ROSTER</div>
            <h2 id="member-modal-title">{mode === "add" ? "Add a group member" : `Edit ${initialMember?.name}`}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close" disabled={busy}>
            <X size={18} />
          </button>
        </div>

        <p className="muted-copy">
          {mode === "add"
            ? `New members start with ${money(0, currency)} contributed and join ${groupName}'s SmartSplit calculations.`
            : "Update member display details or promote a co-organizer for this group."}
        </p>

        <form onSubmit={submit}>
          <label className="form-label">
            Member name
            <input
              autoFocus
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
              placeholder="e.g. Rohan Verma"
              disabled={busy}
            />
          </label>

          <div className="form-two-col">
            <label className="form-label">
              Role in group
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as GroupRole)}
                disabled={busy || initialMember?.role === "owner"}
              >
                <option value="member">Member</option>
                <option value="organizer">Organizer</option>
                {mode === "edit" && <option value="owner">Owner / Primary Organizer</option>}
              </select>
            </label>

            <label className="form-label">
              Email (optional)
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="rohan@example.com"
                disabled={busy}
              />
            </label>
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="modal-actions">
            <button type="button" className="button button-outline" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? (
                <Loader2 size={15} className="spin" />
              ) : mode === "add" ? (
                <UserPlus size={15} />
              ) : (
                <Save size={15} />
              )}
              {busy ? "Saving..." : mode === "add" ? "Add to group" : "Save member"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function ContributionModal({
  groupName,
  currency,
  members,
  busy = false,
  onClose,
  onSubmit,
}: {
  groupName: string;
  currency: CurrencyCode;
  members: GroupMember[];
  busy?: boolean;
  onClose: () => void;
  onSubmit: (values: { fromMemberId: string; toMemberId: string; amount: number; note: string }) => void;
}) {
  useEscapeClose(onClose);

  const [fromMemberId, setFromMemberId] = useState(members[1]?.id ?? members[0]?.id ?? "");
  const [toMemberId, setToMemberId] = useState(members[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = Number(amount);
    if (!fromMemberId || !toMemberId || fromMemberId === toMemberId) {
      setError("Select two distinct group members.");
      return;
    }
    const recipient = members.find((m) => m.id === toMemberId);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid contribution amount greater than 0.");
      return;
    }
    if (recipient && recipient.paid + 0.01 < parsed) {
      setError(`Amount exceeds ${recipient.name}'s current credited balance (${money(recipient.paid, currency)}).`);
      return;
    }
    onSubmit({
      fromMemberId,
      toMemberId,
      amount: Math.round(parsed * 100) / 100,
      note: note.trim() || "Member reimbursement contribution",
    });
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contrib-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="section-kicker">{groupName.toUpperCase()} · CONTRIBUTION</div>
            <h2 id="contrib-modal-title">Record a contribution</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close" disabled={busy}>
            <X size={18} />
          </button>
        </div>

        <p className="muted-copy">
          Record a direct reimbursement from a member who owes to a member who paid upfront. Balances update
          immediately.
        </p>

        <form onSubmit={submit}>
          <div className="form-two-col">
            <label className="form-label">
              From (member paying)
              <select
                value={fromMemberId}
                onChange={(e) => setFromMemberId(e.target.value)}
                disabled={busy}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-label">
              To (member reimbursed)
              <select value={toMemberId} onChange={(e) => setToMemberId(e.target.value)} disabled={busy}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({money(m.paid, currency)})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="form-label">
            Amount ({currency})
            <input
              type="number"
              min="0.01"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              disabled={busy}
            />
          </label>

          <label className="form-label">
            Note (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. UPI transfer for villa deposit"
              disabled={busy}
            />
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="modal-actions">
            <button type="button" className="button button-outline" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="button button-primary" disabled={busy}>
              {busy ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
              {busy ? "Recording..." : "Record contribution"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
