export type User = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  aiEnabled?: boolean;
  creditBalance?: number;
};

export type Guest = {
  guest: true;
  name: string;
  previewRemaining: number;
  used: boolean;
  preview?: Plan | null;
};

export type PlanEvent = { name: string; note?: string };
export type PlanDay = { day: string; date?: string; city?: string; stayArea?: string; events: PlanEvent[] };
export type TransportLeg = {
  day?: string; time?: string; mode?: string; from?: string; to?: string;
  route?: string; duration?: string; cost?: number; costDetail?: string; booking?: string;
};
export type Recommendation = {
  type?: 'hotel' | 'restaurant'; name: string; area?: string; rating?: string | number;
  positiveRate?: string | number; estimatedCost?: number; costDetail?: string;
  booking?: string; sourceUrl?: string; sourceName?: string;
  imageUrl?: string; bookingUrl?: string;
};
export type Plan = {
  title: string;
  summary?: string;
  advice?: string;
  days: PlanDay[];
  transportLegs?: TransportLeg[];
  recommendations?: { hotels?: Recommendation[]; restaurants?: Recommendation[] };
  budget?: {
    currency?: string;
    total?: number;
    transport?: { total?: number; items?: unknown[] };
    lodging?: { total?: number; items?: unknown[] };
    foodTickets?: { total?: number; items?: unknown[] };
  };
  reviewed?: boolean;
  reviewWarning?: string;
  billing?: { cost?: number; balance?: number | null; unlimited?: boolean };
  previewLocked?: boolean;
};

export type SavedTrip = { id: string; savedAt: string; plan: Plan };
export type AccountState = Record<string, unknown> & {
  'tripmate.v1.draft'?: Plan;
  'tripmate.v1.trips'?: unknown[];
};

export type NavigationGuide = {
  completed: boolean;
  reachedIndex: number;
  totalStops: number;
  currentStep?: number;
  currentStop?: { name: string; index: number } | null;
  nextStop?: { name: string; index: number; time?: string; mode?: string };
  distance?: number;
  duration?: number;
  accuracy?: number;
  inference: string;
  navigationUrl?: string;
  nativeNavigationUrl?: string;
  routeMode?: 'walk' | 'car' | 'transfer';
  routeModeLabel?: string;
  outOfTripArea?: boolean;
  routeRangeFallback?: boolean;
  steps?: Array<{ instruction: string; distance: number; duration: number; road?: string }>;
};
