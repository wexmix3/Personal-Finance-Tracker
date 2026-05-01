import {
  ShoppingCart, Utensils, Apple, Car, Zap, Film, Plane,
  Home, Sparkles, Shield, Repeat, GraduationCap, ArrowDownCircle,
  ArrowRightLeft, CircleDollarSign, HelpCircle, Fuel, Dumbbell,
  type LucideIcon,
} from "lucide-react";

interface CategoryMeta {
  icon: LucideIcon;
  color: string;
  bg: string;
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  "Food & Drink":     { icon: Utensils,          color: "text-orange-500",  bg: "bg-orange-500/10" },
  "Groceries":        { icon: Apple,              color: "text-green-600",   bg: "bg-green-500/10" },
  "Restaurants":      { icon: Utensils,           color: "text-orange-500",  bg: "bg-orange-500/10" },
  "Shopping":         { icon: ShoppingCart,       color: "text-violet-500",  bg: "bg-violet-500/10" },
  "Transportation":   { icon: Car,                color: "text-sky-500",     bg: "bg-sky-500/10" },
  "Gas & Fuel":       { icon: Fuel,               color: "text-yellow-600",  bg: "bg-yellow-500/10" },
  "Entertainment":    { icon: Film,               color: "text-pink-500",    bg: "bg-pink-500/10" },
  "Health & Fitness": { icon: Dumbbell,           color: "text-teal-500",    bg: "bg-teal-500/10" },
  "Travel":           { icon: Plane,              color: "text-blue-500",    bg: "bg-blue-500/10" },
  "Utilities":        { icon: Zap,                color: "text-amber-500",   bg: "bg-amber-500/10" },
  "Housing":          { icon: Home,               color: "text-stone-500",   bg: "bg-stone-500/10" },
  "Personal Care":    { icon: Sparkles,           color: "text-rose-400",    bg: "bg-rose-500/10" },
  "Insurance":        { icon: Shield,             color: "text-slate-500",   bg: "bg-slate-500/10" },
  "Subscriptions":    { icon: Repeat,             color: "text-purple-500",  bg: "bg-purple-500/10" },
  "Education":        { icon: GraduationCap,      color: "text-indigo-500",  bg: "bg-indigo-500/10" },
  "Income":           { icon: ArrowDownCircle,    color: "text-emerald-600", bg: "bg-emerald-500/10" },
  "Transfer":         { icon: ArrowRightLeft,     color: "text-gray-500",    bg: "bg-gray-500/10" },
  "Uncategorized":    { icon: HelpCircle,         color: "text-amber-400",   bg: "bg-amber-500/10" },
};

export function getCategoryMeta(category: string | undefined | null): CategoryMeta {
  const key = category ?? "Uncategorized";
  return CATEGORY_META[key] ?? { icon: CircleDollarSign, color: "text-primary", bg: "bg-primary/10" };
}
