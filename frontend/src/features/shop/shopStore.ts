import { create } from 'zustand';
import type { InsuranceType } from '@/mock/products';
import { shopProductById, type Answers, type PriceUnit } from '@/mock/shop';

export interface Order {
  id: string;
  productId: string;
  type: InsuranceType;
  premium: number;
  unit: PriceUnit;
  answers: Answers;
  startDate: string;
  policyNo: string;
  method: string;
}

export const MAX_COMPARE = 3;

interface ShopState {
  /** Quote answers per category; absent until the user has filled the quote form. */
  quotes: Partial<Record<InsuranceType, Answers>>;
  compare: string[];
  /** While on, product cards show a round select circle and a bottom bar offers to continue to 问微晓. */
  compareMode: boolean;
  orders: Order[];
  saveQuote: (type: InsuranceType, a: Answers) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  setCompareMode: (v: boolean) => void;
  addOrder: (o: Order) => void;
}

export const useShopStore = create<ShopState>((set) => ({
  quotes: {},
  compare: [],
  compareMode: false,
  orders: [],
  saveQuote: (type, a) => set((s) => ({ quotes: { ...s.quotes, [type]: a } })),
  // Comparison is within one category: picking from another category starts a new list.
  toggleCompare: (id) => set((s) => {
    if (s.compare.includes(id)) return { compare: s.compare.filter((x) => x !== id) };
    const first = s.compare[0] && shopProductById(s.compare[0]);
    const next = first && first.type !== shopProductById(id)?.type ? [id] : [...s.compare, id];
    return { compare: next.slice(-MAX_COMPARE) };
  }),
  clearCompare: () => set({ compare: [] }),
  setCompareMode: (compareMode) => set({ compareMode, compare: [] }),
  addOrder: (o) => set((s) => ({ orders: [o, ...s.orders] })),
}));
