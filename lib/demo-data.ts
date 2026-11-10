import type { Category, Expense, Member } from "@/lib/finance";

export const initialMembers: Member[] = [
  { id: "m1", name: "You", initials: "AK", color: "coral", paid: 8000 },
  { id: "m2", name: "Priya Sharma", initials: "PS", color: "violet", paid: 6500 },
  { id: "m3", name: "Arjun Mehta", initials: "AM", color: "blue", paid: 3800 },
  { id: "m4", name: "Sana Khan", initials: "SK", color: "mint", paid: 0 },
  { id: "m5", name: "Ishaan Rao", initials: "IR", color: "yellow", paid: 3000 },
  { id: "m6", name: "Neha Kapoor", initials: "NK", color: "pink", paid: 2250 },
  { id: "m7", name: "Kabir Patel", initials: "KP", color: "sky", paid: 0 },
  { id: "m8", name: "Riya Das", initials: "RD", color: "lime", paid: 0 },
];

export const initialCategories: Category[] = [
  { id: "stay", label: "Stay & accommodation", budget: 16000, spent: 12400, color: "#b9a2ff" },
  { id: "transport", label: "Getting around", budget: 8500, spent: 6100, color: "#f6ad85" },
  { id: "food", label: "Food & drinks", budget: 6500, spent: 3850, color: "#a7e4c0" },
  { id: "activities", label: "Activities", budget: 5500, spent: 1200, color: "#f4d786" },
  { id: "buffer", label: "Just-in-case fund", budget: 3500, spent: 0, color: "#9ccbf5" },
];

export const initialExpenses: Expense[] = [
  { id: "e1", title: "Villa deposit · nights 1–3", category: "Stay & accommodation", amount: 12400, submittedBy: "Priya Sharma", verified: false, createdAt: "Today, 10:42 AM" },
  { id: "e2", title: "Airport transfers · both ways", category: "Getting around", amount: 3200, submittedBy: "Arjun Mehta", verified: false, createdAt: "Today, 9:18 AM" },
  { id: "e3", title: "Scooter hire · 2 days", category: "Getting around", amount: 2900, submittedBy: "You", verified: false, createdAt: "Yesterday" },
  { id: "e4", title: "First-night dinner", category: "Food & drinks", amount: 3850, submittedBy: "Neha Kapoor", verified: false, createdAt: "Yesterday" },
];
