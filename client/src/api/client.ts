/** Typed API client for NowCart backend */

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.detail || err.error || 'Request failed');
  }
  return res.json();
}

import type { components } from './schema';

// --- Types derived from the OpenAPI contract (single source of truth) ---
// Cart shapes are generated from the backend schema (src/api/schema.d.ts) so
// the frontend and backend cannot drift. Collections that the backend always
// returns (via default_factory) are normalized to be present here, and an
// optional per-item reasoning_trail is layered on for the comparison-collapse UI.

type Schemas = components['schemas'];

export type Substitution = Schemas['SubstitutionResponse'];

export type CartItem = Schemas['CartItemResponse'] & {
  /** optional per-pick decision steps (comparison-collapse UI) */
  reasoning_trail?: string[];
  /** recently-ordered prompt: true if ordered within last 30 days */
  recently_ordered?: boolean;
  /** days since last order (0 = not recently ordered) */
  days_ago?: number;
  /** OOS suggestion: shown when best match was OOS, frontend lets user decide */
  out_of_stock_suggestion?: {
    product_id: string;
    name: string;
    price: number;
    image_url: string | null;
  } | null;
};

export type CartResponse = Omit<
  Schemas['CartResponse'],
  'items' | 'economical_items' | 'substitutions' | 'notes' | 'reasoning_trail'
> & {
  items: CartItem[];
  economical_items: CartItem[];
  substitutions: Substitution[];
  notes: string[];
  reasoning_trail: string[];
  economical_total: number;
};

export interface Product {
  product_id: string;
  name: string;
  brand: string;
  category: string;
  sub_category: string;
  sale_price: number;
  market_price: number;
  rating: number | null;
  unit: string;
  in_stock: boolean;
  delivery_eta_min: number;
  image_url: string | null;
  description?: string;
  type?: string;
  tags?: string[];
}

// --- API Functions ---

export async function postOutcome(text: string, servings?: number): Promise<CartResponse> {
  return request<CartResponse>('/outcome', {
    method: 'POST',
    body: JSON.stringify({ text, servings }),
  });
}

export async function postVoiceIntent(transcript: string, session_id?: string): Promise<CartResponse> {
  return request<CartResponse>('/voice/intent', {
    method: 'POST',
    body: JSON.stringify({ transcript, session_id }),
  });
}

/** Show it (B2) — analyze a dish photo (multipart). Falls back to text when no file. */
export async function postVisionAnalyze(file?: File | null, text?: string): Promise<CartResponse> {
  const form = new FormData();
  if (file) form.append('file', file);
  // text is an optional query param on the backend route
  const qs = text ? `?text=${encodeURIComponent(text)}` : '';
  const res = await fetch(`${BASE}/vision/analyze${qs}`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.detail || err.error || 'Image analysis failed');
  }
  return res.json();
}

/** Share it (B4) — parse a recipe link or pasted recipe text. */
export async function postShareParse(input: { url?: string; text?: string }): Promise<CartResponse> {
  return request<CartResponse>('/share/parse', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function postConstraint(budget: number, servings: number, text?: string): Promise<CartResponse> {
  return request<CartResponse>('/constraint', {
    method: 'POST',
    body: JSON.stringify({ budget, servings, text }),
  });
}

// postSos removed — SOS mode no longer exists

export async function postCartOp(
  session_id: string,
  op: string,
  entity?: string,
  quantity?: number
): Promise<CartResponse> {
  return request<CartResponse>('/cart/op', {
    method: 'POST',
    body: JSON.stringify({ session_id, op, entity, quantity }),
  });
}

export async function getCart(session_id: string): Promise<CartResponse> {
  return request<CartResponse>(`/cart/${session_id}`);
}

export async function searchCatalog(q?: string, category?: string, limit = 20): Promise<Product[]> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  params.set('limit', String(limit));
  return request<Product[]>(`/catalog/search?${params}`);
}

export async function getProduct(productId: string): Promise<Product> {
  return request<Product>(`/catalog/product/${productId}`);
}

export async function postStockOverride(product_id: string, in_stock: boolean): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/admin/stock', {
    method: 'POST',
    body: JSON.stringify({ product_id, in_stock }),
  });
}

/** Recommend best-rated product + alternatives for a search query (without adding to cart). */
export interface RecommendResponse {
  best: Product | null;
  alternatives: Product[];
}

export async function searchRecommend(q: string, limit = 5): Promise<RecommendResponse> {
  const params = new URLSearchParams();
  params.set('q', q);
  params.set('limit', String(limit));
  return request<RecommendResponse>(`/catalog/recommend?${params}`);
}

// postSosRecommend removed — SOS mode no longer exists



// ============ NEW FEATURES: Subscribe, Preferences, Pantry, Replan, Counterfactuals ============

/** Subscribe "Zero Door" — predicted restock cart + recurring schedules */
export interface SubscribeResponse {
  message: string;
  cart: CartResponse | null;
  predictions?: PredictionInsight[];
}

export interface PredictionInsight {
  product_id: string;
  product_name: string;
  avg_interval_days: number;
  days_since_last: number;
  predicted_depletion_days: number;
  confidence: number;
  purchase_count: number;
  reason: string;
}

export async function getSubscribedCart(userId: string): Promise<SubscribeResponse> {
  return request<SubscribeResponse>(`/subscribe/${userId}`);
}

export async function getPredictionInsights(userId: string): Promise<{ predictions: PredictionInsight[]; count: number }> {
  return request<{ predictions: PredictionInsight[]; count: number }>(`/subscribe/${userId}/insights`);
}

/** Recurring schedule subscription */
export interface Subscription {
  user_id: string;
  product_id: string;
  product_name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  next_due_date: string;
}

export async function addSubscription(
  userId: string,
  productId: string,
  productName: string,
  frequency: 'daily' | 'weekly' | 'monthly',
): Promise<{ message: string; subscription: Subscription }> {
  return request(`/subscribe`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, product_id: productId, product_name: productName, frequency }),
  });
}

export async function removeSubscription(userId: string, productId: string): Promise<{ message: string }> {
  return request(`/subscribe/${userId}/${productId}`, { method: 'DELETE' });
}

export async function getUserSubscriptions(userId: string): Promise<{ subscriptions: Subscription[]; count: number }> {
  return request(`/subscribe/${userId}/schedules`);
}

export async function getDueSubscriptions(userId: string): Promise<{ due: Subscription[]; due_count: number; cart: CartResponse | null }> {
  return request(`/subscribe/${userId}/due`);
}

export async function getAllSubscriptionsCart(userId: string): Promise<{ cart: CartResponse | null; message: string }> {
  return request(`/subscribe/${userId}/all-cart`);
}

/** User preferences (taste graph) */
export interface UserPreference {
  user_id: string;
  brand_affinity: Record<string, number>;
  category_frequency: Record<string, number>;
  product_loyalty: Record<string, number>;
  avg_item_price: number;
  price_tier: string;
  dietary_tags: string[];
  total_orders: number;
  avg_items_per_order: number;
  top_products: string[];
  top_brands: string[];
}

export async function getUserPreferences(userId: string): Promise<{ message: string; preference: UserPreference | null }> {
  return request<{ message: string; preference: UserPreference | null }>(`/preferences/${userId}`);
}

/** Pantry — recently ordered items (ordered in last 30 days) */
export interface PantryItem {
  product_id: string;
  name: string;
  days_ago: number;
}

export async function getUserPantry(userId: string): Promise<{ items: PantryItem[]; count: number }> {
  return request<{ items: PantryItem[]; count: number }>(`/pantry/${userId}`);
}

/** Replan — conversational cart refinement */
export async function postReplan(text: string, feedback: string, userId?: string, servings?: number): Promise<CartResponse> {
  return request<CartResponse>('/replan', {
    method: 'POST',
    body: JSON.stringify({ text, feedback, user_id: userId, servings }),
  });
}

/** Outcome with user_id for personalized matching */
export async function postOutcomePersonalized(text: string, userId: string, servings?: number): Promise<CartResponse> {
  return request<CartResponse>('/outcome', {
    method: 'POST',
    body: JSON.stringify({ text, servings, user_id: userId }),
  });
}

/** Counterfactuals — "Why NOT this one?" */
export interface RejectedAlternative {
  product_id: string;
  name: string;
  brand: string;
  price: number;
  match_score: number;
  rejection_reasons: string[];
  image_url: string | null;
}

export interface CounterfactualResponse {
  need: string;
  selected_product_id: string;
  alternatives_considered: number;
  rejected: RejectedAlternative[];
}

export async function getCounterfactuals(
  needName: string,
  selectedProductId: string,
  candidates: any[],
  userId?: string,
): Promise<CounterfactualResponse> {
  return request<CounterfactualResponse>('/counterfactuals', {
    method: 'POST',
    body: JSON.stringify({
      need_name: needName,
      selected_product_id: selectedProductId,
      candidates,
      user_id: userId,
    }),
  });
}


// ============ ORDER PLACEMENT & HISTORY ============

export interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface OrderRecord {
  order_id: string;
  user_id?: string;
  order_date: string;
  items: OrderItem[];
  total: number;
  status: string;
  payment_method: string;
  payment_status: string;
}

export async function placeOrder(
  sessionId: string,
  userId: string,
  paymentMethod: 'upi' | 'card' | 'cod' | 'wallet' = 'cod',
): Promise<OrderRecord> {
  return request<OrderRecord>('/orders/place', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, user_id: userId, payment_method: paymentMethod }),
  });
}

export async function getOrderHistory(userId: string): Promise<{ orders: OrderRecord[]; count: number }> {
  return request<{ orders: OrderRecord[]; count: number }>(`/orders/${userId}`);
}


// ============ AUTH ============

export interface AuthUser {
  user_id: string;
  name: string;
  email: string;
  role: string;
  preferences: string[];
  region?: string;
  age?: number | null;
  gender?: string;
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  region?: string,
  city?: string,
  state?: string,
  age?: number | null,
  gender?: string,
): Promise<AuthUser> {
  return request<AuthUser>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name, email, password,
      region: region || '', city: city || '', state: state || '',
      age: age || null, gender: gender || '',
    }),
  });
}

export async function loginUser(email: string, password: string): Promise<AuthUser> {
  return request<AuthUser>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
