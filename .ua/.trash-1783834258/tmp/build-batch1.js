const fs = require('fs');

const extract = require('C:/Users/bijit/NowCart/.ua/tmp/ua-file-extract-results-1.json');
const batchMeta = require('C:/Users/bijit/NowCart/.ua/tmp/batch1-extract.json');
const importData = batchMeta.batchImportData || {};

// ---- File-level metadata (summary, tags, complexity, languageNotes?) ----
const fileMeta = {
  'client/src/App.tsx': {
    summary: 'Root React application component that sets up client-side routing, holds top-level user/cart state shared via context, and shows a location-permission prompt on load.',
    tags: ['entry-point', 'routing', 'state-management', 'react'],
    complexity: 'complex',
  },
  'client/src/api/client.ts': {
    summary: 'Central typed fetch wrapper exposing every backend API call used by the client, covering cart operations, catalog search, subscriptions, predictions, checkout and auth.',
    tags: ['api-handler', 'utility', 'data-fetching', 'service'],
    complexity: 'complex',
    languageNotes: 'A single shared `request()` helper wraps fetch/JSON handling so each exported function stays a thin, typed one-liner.',
  },
  'client/src/components/CartDrawer.tsx': {
    summary: 'Slide-out cart panel with recommended/economical tabs, per-item quantity controls, budget summary and a checkout call-to-action.',
    tags: ['component', 'cart', 'ui'],
    complexity: 'complex',
  },
  'client/src/components/Composer.tsx': {
    summary: 'Primary multi-mode input composer (text, voice, budget) used on the home page to capture shopping intent and trigger cart building.',
    tags: ['component', 'composer', 'input-handling'],
    complexity: 'moderate',
  },
  'client/src/components/Footer.tsx': {
    summary: 'Site footer with newsletter signup, PWA install prompt trigger, and category/legal navigation links.',
    tags: ['component', 'footer', 'pwa'],
    complexity: 'moderate',
  },
  'client/src/components/NowCartVerified.tsx': {
    summary: 'Small reusable badge component that renders a "NowCart Verified" trust signal on product listings.',
    tags: ['component', 'badge', 'ui'],
    complexity: 'simple',
  },
  'client/src/components/ProductCard.tsx': {
    summary: 'Reusable product tile showing image, rating stars, pricing and add/remove-from-cart controls, used across shop, search and home pages.',
    tags: ['component', 'product', 'ui'],
    complexity: 'moderate',
  },
  'client/src/components/cart/EngineTrail.tsx': {
    summary: 'Renders a human-readable "why this happened" trail translating the cart-building engine\'s internal reasoning steps into plain language.',
    tags: ['component', 'cart', 'explainability'],
    complexity: 'moderate',
  },
  'client/src/components/cart/HitlPrompt.tsx': {
    summary: 'Small human-in-the-loop confirmation prompt asking the user to proceed with the current cart or view alternatives.',
    tags: ['component', 'cart', 'hitl'],
    complexity: 'simple',
  },
  'client/src/components/cart/ReplanBar.tsx': {
    summary: 'Inline chat bar letting users give free-text or quick-chip feedback to swap items or replan the current cart.',
    tags: ['component', 'cart', 'replan'],
    complexity: 'moderate',
  },
  'client/src/components/cart/WhyThisOne.tsx': {
    summary: 'Expandable panel that humanizes the engine\'s reasoning trail and confidence score for why a specific product was chosen.',
    tags: ['component', 'cart', 'explainability'],
    complexity: 'simple',
  },
  'client/src/components/frontdoors/FrontDoorPanel.tsx': {
    summary: 'Modal dispatcher that renders the correct "front door" intent-capture panel (constrain/predict/share/show/speak) based on the selected door.',
    tags: ['component', 'modal', 'router'],
    complexity: 'simple',
  },
  'client/src/components/frontdoors/PanelResult.tsx': {
    summary: 'Shared result-summary UI (cart preview, item list, totals) rendered after any front-door panel finishes building a cart.',
    tags: ['component', 'cart', 'result'],
    complexity: 'moderate',
  },
  'client/src/components/frontdoors/doors.tsx': {
    summary: 'Static configuration array defining the five front-door entry points (constrain, predict, share, show, speak) with their icons and labels.',
    tags: ['config', 'data', 'ui'],
    complexity: 'simple',
  },
  'client/src/components/frontdoors/panels/ConstrainPanel.tsx': {
    summary: 'Front-door panel for capturing a budget and serving size to build a budget-constrained cart via the constraint API.',
    tags: ['component', 'constraint', 'cart-builder'],
    complexity: 'moderate',
  },
  'client/src/components/frontdoors/panels/PredictPanel.tsx': {
    summary: 'Front-door panel for subscription-based predictive reordering: manages recurring subscriptions, due-for-reorder carts, pantry tracking and personalized prediction insights.',
    tags: ['component', 'subscriptions', 'predictions'],
    complexity: 'complex',
  },
  'client/src/components/frontdoors/panels/SharePanel.tsx': {
    summary: 'Front-door panel that accepts a shared recipe/social link or pasted text and parses it into a cart via the share-parse API.',
    tags: ['component', 'share', 'cart-builder'],
    complexity: 'moderate',
  },
  'client/src/components/frontdoors/panels/ShowPanel.tsx': {
    summary: 'Front-door panel for image-based intent capture, letting users take a photo or upload an image analyzed by the vision API to build a cart.',
    tags: ['component', 'vision', 'cart-builder'],
    complexity: 'complex',
  },
  'client/src/components/frontdoors/panels/SpeakPanel.tsx': {
    summary: 'Front-door panel for voice-based intent capture using the Web Speech API, including live transcription, follow-up voice commands, and cart updates.',
    tags: ['component', 'voice', 'cart-builder'],
    complexity: 'complex',
  },
  'client/src/main.tsx': {
    summary: 'Application bootstrap entry point that mounts the React root and imports global CSS.',
    tags: ['entry-point', 'bootstrap'],
    complexity: 'simple',
  },
  'client/src/pages/AboutPage.tsx': {
    summary: 'Static "About Us" marketing page listing the team and company mission.',
    tags: ['page', 'marketing', 'static-content'],
    complexity: 'simple',
  },
  'client/src/pages/AdminDashboardPage.tsx': {
    summary: 'Internal admin dashboard showing usage statistics, scaling info, and LLM/AWS cost breakdowns with periodic auto-refresh.',
    tags: ['page', 'admin', 'dashboard', 'analytics'],
    complexity: 'complex',
  },
  'client/src/pages/DeliveryInfoPage.tsx': {
    summary: 'Static page describing delivery zones, timing windows and delivery policies.',
    tags: ['page', 'static-content'],
    complexity: 'simple',
  },
  'client/src/pages/HomePage.tsx': {
    summary: 'Landing page presenting the front-door intent panels and featured/recommended products to start a shopping session.',
    tags: ['page', 'landing', 'home'],
    complexity: 'complex',
  },
  'client/src/pages/LoginPage.tsx': {
    summary: 'Login and registration page handling user authentication against the backend auth API.',
    tags: ['page', 'auth', 'form'],
    complexity: 'complex',
  },
  'client/src/pages/OrderHistoryPage.tsx': {
    summary: 'Page listing a signed-in user\'s past orders fetched from the backend order-history API.',
    tags: ['page', 'orders', 'history'],
    complexity: 'moderate',
  },
  'client/src/pages/OrderSuccessPage.tsx': {
    summary: 'Post-checkout confirmation page summarizing the placed order, payment method and estimated delivery time.',
    tags: ['page', 'checkout', 'confirmation'],
    complexity: 'moderate',
  },
  'client/src/pages/PaymentPage.tsx': {
    summary: 'Checkout page handling delivery address, payment method selection (UPI, cards, wallets) and order placement, with numerous small icon/row sub-components.',
    tags: ['page', 'payment', 'checkout'],
    complexity: 'complex',
  },
  'client/src/pages/PrivacyPolicyPage.tsx': {
    summary: 'Static privacy policy legal page.',
    tags: ['page', 'legal', 'static-content'],
    complexity: 'simple',
  },
  'client/src/pages/ProductPage.tsx': {
    summary: 'Single product detail page with pricing, description and add/remove-from-cart actions.',
    tags: ['page', 'product', 'detail'],
    complexity: 'moderate',
  },
  'client/src/pages/SearchResultsPage.tsx': {
    summary: 'Search results page rendering products matching a catalog search query.',
    tags: ['page', 'search', 'product-listing'],
    complexity: 'moderate',
  },
  'client/src/pages/ShopPage.tsx': {
    summary: 'Category browsing page listing products with filtering by category and search term.',
    tags: ['page', 'shop', 'product-listing'],
    complexity: 'complex',
  },
  'client/src/pages/SubscriptionsPage.tsx': {
    summary: 'Page for managing recurring product subscriptions, including adding new subscriptions via brand search and adjusting frequency.',
    tags: ['page', 'subscriptions', 'recurring'],
    complexity: 'complex',
  },
  'client/src/pages/TermsPage.tsx': {
    summary: 'Static terms & conditions legal page.',
    tags: ['page', 'legal', 'static-content'],
    complexity: 'simple',
  },
  'client/src/ui/index.ts': {
    summary: 'Barrel file re-exporting shared UI primitives (Button, Card, Chip, Panel, Spinner, EmptyState, ErrorState, Toast provider, animation helpers) used across the client.',
    tags: ['barrel', 'ui-kit', 'design-system'],
    complexity: 'simple',
  },
};

// ---- Function-level metadata: key "path::name" -> {summary, tags, complexity} ----
const fnMeta = {
  'client/src/App.tsx::LocationPrompt': {
    summary: 'Modal prompting the user to share their location, handling geolocation permission requests and timeout/error states.',
    tags: ['component', 'geolocation', 'permission-prompt'],
    complexity: 'moderate',
  },
  'client/src/App.tsx::App': {
    summary: 'Top-level app shell wiring up React Router routes, cart/user state, and the header/footer/cart drawer layout.',
    tags: ['entry-point', 'routing', 'layout'],
    complexity: 'complex',
  },
  'client/src/api/client.ts::request': {
    summary: 'Shared low-level fetch helper that issues an HTTP request against the API base URL and parses the JSON response.',
    tags: ['utility', 'http', 'data-fetching'],
    complexity: 'simple',
  },
  'client/src/api/client.ts::postOutcome': { summary: 'Submits free-text shopping intent to build a cart outcome.', tags: ['api-handler', 'cart-builder'], complexity: 'simple' },
  'client/src/api/client.ts::postVoiceIntent': { summary: 'Submits a voice transcript to the intent API to build or update a cart.', tags: ['api-handler', 'voice'], complexity: 'simple' },
  'client/src/api/client.ts::postVisionAnalyze': { summary: 'Uploads an image (multipart form) plus optional text to the vision analysis endpoint to build a cart.', tags: ['api-handler', 'vision'], complexity: 'moderate' },
  'client/src/api/client.ts::postShareParse': { summary: 'Submits a shared link or text to the share-parse endpoint to extract a cart.', tags: ['api-handler', 'share'], complexity: 'simple' },
  'client/src/api/client.ts::postConstraint': { summary: 'Submits budget, servings and optional text constraints to build a budget-aware cart.', tags: ['api-handler', 'constraint'], complexity: 'simple' },
  'client/src/api/client.ts::postCartOp': { summary: 'Applies a single cart operation (add/remove/update quantity) for a given session.', tags: ['api-handler', 'cart'], complexity: 'simple' },
  'client/src/api/client.ts::getCart': { summary: 'Fetches the current cart state for a session.', tags: ['api-handler', 'cart'], complexity: 'simple' },
  'client/src/api/client.ts::searchCatalog': { summary: 'Searches the product catalog by query, category and result limit.', tags: ['api-handler', 'search'], complexity: 'simple' },
  'client/src/api/client.ts::getProduct': { summary: 'Fetches a single product by id.', tags: ['api-handler', 'product'], complexity: 'simple' },
  'client/src/api/client.ts::postStockOverride': { summary: 'Admin call overriding a product\'s in-stock status.', tags: ['api-handler', 'admin'], complexity: 'simple' },
  'client/src/api/client.ts::searchRecommend': { summary: 'Fetches recommended products for a search query.', tags: ['api-handler', 'search', 'recommendations'], complexity: 'simple' },
  'client/src/api/client.ts::getSubscribedCart': { summary: 'Fetches a cart built from a user\'s active subscriptions.', tags: ['api-handler', 'subscriptions'], complexity: 'simple' },
  'client/src/api/client.ts::getPredictionInsights': { summary: 'Fetches personalized reorder prediction insights for a user.', tags: ['api-handler', 'predictions'], complexity: 'simple' },
  'client/src/api/client.ts::addSubscription': { summary: 'Creates a new recurring product subscription for a user.', tags: ['api-handler', 'subscriptions'], complexity: 'simple' },
  'client/src/api/client.ts::removeSubscription': { summary: 'Cancels a user\'s subscription to a product.', tags: ['api-handler', 'subscriptions'], complexity: 'simple' },
  'client/src/api/client.ts::getUserSubscriptions': { summary: 'Fetches all active subscriptions for a user.', tags: ['api-handler', 'subscriptions'], complexity: 'simple' },
  'client/src/api/client.ts::getDueSubscriptions': { summary: 'Fetches subscriptions currently due for reorder.', tags: ['api-handler', 'subscriptions'], complexity: 'simple' },
  'client/src/api/client.ts::getAllSubscriptionsCart': { summary: 'Fetches a combined cart of all of a user\'s subscribed items.', tags: ['api-handler', 'subscriptions'], complexity: 'simple' },
  'client/src/api/client.ts::getUserPreferences': { summary: 'Fetches stored shopping preferences for a user.', tags: ['api-handler', 'preferences'], complexity: 'simple' },
  'client/src/api/client.ts::getUserPantry': { summary: 'Fetches the inferred pantry/stock state for a user.', tags: ['api-handler', 'pantry'], complexity: 'simple' },
  'client/src/api/client.ts::postReplan': { summary: 'Submits feedback and cart context to replan/adjust an existing cart.', tags: ['api-handler', 'replan'], complexity: 'simple' },
  'client/src/api/client.ts::postOutcomePersonalized': { summary: 'Builds a personalized cart outcome for a specific user from free-text intent.', tags: ['api-handler', 'personalization'], complexity: 'simple' },
  'client/src/api/client.ts::getCounterfactuals': { summary: 'Fetches counterfactual/alternative product candidates for a given cart need.', tags: ['api-handler', 'explainability'], complexity: 'moderate' },
  'client/src/api/client.ts::placeOrder': { summary: 'Places an order for a session, user and payment method.', tags: ['api-handler', 'checkout'], complexity: 'simple' },
  'client/src/api/client.ts::getOrderHistory': { summary: 'Fetches a user\'s past order history.', tags: ['api-handler', 'orders'], complexity: 'simple' },
  'client/src/api/client.ts::registerUser': { summary: 'Registers a new user account with profile details.', tags: ['api-handler', 'auth'], complexity: 'moderate' },
  'client/src/api/client.ts::loginUser': { summary: 'Authenticates a user with email and password.', tags: ['api-handler', 'auth'], complexity: 'simple' },
  'client/src/components/CartDrawer.tsx::CartDrawer': {
    summary: 'Main cart drawer component rendering recommended/economical tabs, item rows with quantity controls, budget summary and checkout button.',
    tags: ['component', 'cart', 'checkout'],
    complexity: 'complex',
  },
  'client/src/components/Composer.tsx::looksLikeSingleItemSearch': {
    summary: 'Heuristic that decides whether typed text looks like a single-item search query rather than a full meal/intent request.',
    tags: ['utility', 'heuristic'],
    complexity: 'simple',
  },
  'client/src/components/Composer.tsx::Composer': {
    summary: 'Multi-mode composer component switching between text, voice and budget input tabs to submit shopping intent.',
    tags: ['component', 'composer', 'input-handling'],
    complexity: 'complex',
  },
  'client/src/components/Footer.tsx::Footer': {
    summary: 'Footer component rendering newsletter signup, PWA install button (with iOS hint), and navigation link groups.',
    tags: ['component', 'footer', 'pwa'],
    complexity: 'moderate',
  },
  'client/src/components/NowCartVerified.tsx::NowCartVerified': {
    summary: 'Renders a small "NowCart Verified" badge with configurable size.',
    tags: ['component', 'badge'],
    complexity: 'simple',
  },
  'client/src/components/ProductCard.tsx::ProductCard': {
    summary: 'Product tile showing rating stars, price, discount and add/remove-from-cart controls.',
    tags: ['component', 'product'],
    complexity: 'moderate',
  },
  'client/src/components/cart/EngineTrail.tsx::humanStep': {
    summary: 'Translates a raw engine reasoning-trail string into a human-readable label and icon by matching known step patterns.',
    tags: ['utility', 'explainability', 'text-parsing'],
    complexity: 'complex',
  },
  'client/src/components/cart/EngineTrail.tsx::EngineTrail': {
    summary: 'Renders the deduplicated, humanized list of engine reasoning steps in an expandable trail UI.',
    tags: ['component', 'explainability'],
    complexity: 'moderate',
  },
  'client/src/components/cart/HitlPrompt.tsx::HitlPrompt': {
    summary: 'Renders a question with "proceed" and "show alternatives" action buttons for human-in-the-loop confirmation.',
    tags: ['component', 'hitl'],
    complexity: 'simple',
  },
  'client/src/components/cart/ReplanBar.tsx::resolveUserId': {
    summary: 'Derives a stable user id string from a stored user object, falling back to deriving one from the email.',
    tags: ['utility', 'auth'],
    complexity: 'simple',
  },
  'client/src/components/cart/ReplanBar.tsx::ReplanBar': {
    summary: 'Chat-style bar for cart replanning, supporting quick-chip direct swaps and free-text feedback submitted to the replan API.',
    tags: ['component', 'replan', 'chat'],
    complexity: 'complex',
  },
  'client/src/components/cart/WhyThisOne.tsx::humaniseReason': {
    summary: 'Converts a raw selection-reason string and confidence score into a human-friendly explanation sentence.',
    tags: ['utility', 'explainability', 'text-parsing'],
    complexity: 'moderate',
  },
  'client/src/components/cart/WhyThisOne.tsx::WhyThisOne': {
    summary: 'Expandable panel showing the humanized reasoning and trail for why a cart item was selected.',
    tags: ['component', 'explainability'],
    complexity: 'moderate',
  },
  'client/src/components/frontdoors/FrontDoorPanel.tsx::FrontDoorPanel': {
    summary: 'Dispatches to the correct panel component (Constrain/Predict/Share/Show/Speak) based on the selected front door id.',
    tags: ['component', 'router', 'modal'],
    complexity: 'simple',
  },
  'client/src/components/frontdoors/PanelResult.tsx::PanelResult': {
    summary: 'Displays a summary of the built cart (items, totals, remaining budget, shortfall) with a caption and view-cart action.',
    tags: ['component', 'cart', 'result'],
    complexity: 'moderate',
  },
  'client/src/components/frontdoors/panels/ConstrainPanel.tsx::ConstrainPanel': {
    summary: 'Two-phase panel collecting budget and servings, submitting them to the constraint API, then showing the resulting cart.',
    tags: ['component', 'constraint', 'form'],
    complexity: 'complex',
  },
  'client/src/components/frontdoors/panels/PredictPanel.tsx::resolveUserId': {
    summary: 'Derives a stable user id from the stored user object for subscription/prediction API calls.',
    tags: ['utility', 'auth'],
    complexity: 'simple',
  },
  'client/src/components/frontdoors/panels/PredictPanel.tsx::BrandPicker': {
    summary: 'Debounced product/brand search picker used to select a product when creating a new subscription.',
    tags: ['component', 'search', 'subscriptions'],
    complexity: 'complex',
  },
  'client/src/components/frontdoors/panels/PredictPanel.tsx::PredictPanel': {
    summary: 'Main predictive-reorder panel managing subscriptions, due-cart, prediction insights and pantry state, and building a subscribed cart.',
    tags: ['component', 'subscriptions', 'predictions'],
    complexity: 'complex',
  },
  'client/src/components/frontdoors/panels/SharePanel.tsx::SharePanel': {
    summary: 'Panel accepting a shared link/text, submitting it to the share-parse API, then showing the resulting cart.',
    tags: ['component', 'share', 'form'],
    complexity: 'complex',
  },
  'client/src/components/frontdoors/panels/ShowPanel.tsx::ShowPanel': {
    summary: 'Panel for capturing an image via camera or gallery upload, submitting it (with optional text) to the vision-analyze API.',
    tags: ['component', 'vision', 'form'],
    complexity: 'complex',
  },
  'client/src/components/frontdoors/panels/SpeakPanel.tsx::getRecognition': {
    summary: 'Lazily constructs and configures a browser SpeechRecognition instance if available.',
    tags: ['utility', 'voice', 'web-speech-api'],
    complexity: 'moderate',
  },
  'client/src/components/frontdoors/panels/SpeakPanel.tsx::parseFollowUp': {
    summary: 'Parses a follow-up voice transcript into an add/remove cart operation using simple regex matching.',
    tags: ['utility', 'voice', 'text-parsing'],
    complexity: 'simple',
  },
  'client/src/components/frontdoors/panels/SpeakPanel.tsx::SpeakPanel': {
    summary: 'Voice intent-capture panel managing microphone permission, live transcription via Web Speech API, and follow-up voice commands against the cart.',
    tags: ['component', 'voice', 'chat'],
    complexity: 'complex',
  },
  'client/src/pages/AboutPage.tsx::AboutPage': {
    summary: 'Renders the static About page with team member cards and mission copy.',
    tags: ['page', 'static-content'],
    complexity: 'moderate',
  },
  'client/src/pages/AdminDashboardPage.tsx::KpiCard': {
    summary: 'Small stat-tile component showing an icon, title, value and sub-label for the admin dashboard KPIs.',
    tags: ['component', 'dashboard', 'stat-tile'],
    complexity: 'simple',
  },
  'client/src/pages/AdminDashboardPage.tsx::MiniBar': {
    summary: 'Small horizontal bar-chart component rendering a labeled value against a max scale.',
    tags: ['component', 'dashboard', 'chart'],
    complexity: 'simple',
  },
  'client/src/pages/AdminDashboardPage.tsx::AdminDashboardPage': {
    summary: 'Admin dashboard page fetching and periodically refreshing usage stats, scaling info and LLM/AWS cost data, rendered across tabbed sections.',
    tags: ['page', 'admin', 'dashboard'],
    complexity: 'complex',
  },
  'client/src/pages/DeliveryInfoPage.tsx::DeliveryInfoPage': {
    summary: 'Renders the static delivery info page describing zones, timing and policies.',
    tags: ['page', 'static-content'],
    complexity: 'moderate',
  },
  'client/src/pages/HomePage.tsx::HomePage': {
    summary: 'Landing page rendering the front-door intent panels grid and a featured products section.',
    tags: ['page', 'landing'],
    complexity: 'complex',
  },
  'client/src/pages/LoginPage.tsx::LoginPage': {
    summary: 'Combined login/registration form page that authenticates against the auth API and stores the session user.',
    tags: ['page', 'auth', 'form'],
    complexity: 'complex',
  },
  'client/src/pages/OrderHistoryPage.tsx::resolveUserId': {
    summary: 'Derives a stable user id from the stored user object for order-history lookups.',
    tags: ['utility', 'auth'],
    complexity: 'simple',
  },
  'client/src/pages/OrderHistoryPage.tsx::OrderHistoryPage': {
    summary: 'Fetches and renders a signed-in user\'s past orders.',
    tags: ['page', 'orders'],
    complexity: 'moderate',
  },
  'client/src/pages/OrderSuccessPage.tsx::OrderSuccessPage': {
    summary: 'Post-checkout confirmation page summarizing the order, payment method and estimated delivery window.',
    tags: ['page', 'checkout', 'confirmation'],
    complexity: 'complex',
  },
  'client/src/pages/PaymentPage.tsx::resolveUserId': {
    summary: 'Derives a stable user id from the stored user object for placing the order.',
    tags: ['utility', 'auth'],
    complexity: 'simple',
  },
  'client/src/pages/PaymentPage.tsx::methodLabel': {
    summary: 'Maps an internal payment method code to its human-readable display label.',
    tags: ['utility', 'payment'],
    complexity: 'simple',
  },
  'client/src/pages/PaymentPage.tsx::Row': {
    summary: 'Small labeled key/value row component used in the order summary section.',
    tags: ['component', 'ui'],
    complexity: 'simple',
  },
  'client/src/pages/PaymentPage.tsx::QrIcon': {
    summary: 'Renders the QR-code payment method icon (inline SVG).',
    tags: ['component', 'icon', 'payment'],
    complexity: 'simple',
  },
  'client/src/pages/PaymentPage.tsx::PaymentPage': {
    summary: 'Checkout page managing delivery address, payment method selection and order placement against the backend.',
    tags: ['page', 'payment', 'checkout'],
    complexity: 'complex',
  },
  'client/src/pages/ProductPage.tsx::ProductPage': {
    summary: 'Product detail page showing full product info with add/remove-from-cart controls.',
    tags: ['page', 'product'],
    complexity: 'moderate',
  },
  'client/src/pages/SearchResultsPage.tsx::ProductResultCard': {
    summary: 'Search-result variant of the product card, showing match relevance alongside standard product details.',
    tags: ['component', 'search', 'product'],
    complexity: 'complex',
  },
  'client/src/pages/SearchResultsPage.tsx::SearchResultsPage': {
    summary: 'Page rendering catalog search results for a query, including empty and loading states.',
    tags: ['page', 'search'],
    complexity: 'moderate',
  },
  'client/src/pages/ShopPage.tsx::ShopPage': {
    summary: 'Category browsing page listing and filtering products by category and search term.',
    tags: ['page', 'shop', 'product-listing'],
    complexity: 'complex',
  },
  'client/src/pages/SubscriptionsPage.tsx::resolveUserId': {
    summary: 'Derives a stable user id from the stored user object for subscription management calls.',
    tags: ['utility', 'auth'],
    complexity: 'simple',
  },
  'client/src/pages/SubscriptionsPage.tsx::BrandPicker': {
    summary: 'Debounced product/brand search picker used to add a new subscription from this page.',
    tags: ['component', 'search', 'subscriptions'],
    complexity: 'complex',
  },
  'client/src/pages/SubscriptionsPage.tsx::SubscriptionsPage': {
    summary: 'Page for viewing and managing all of a user\'s recurring subscriptions, including adding, removing and adjusting frequency.',
    tags: ['page', 'subscriptions'],
    complexity: 'complex',
  },
  'client/src/pages/PrivacyPolicyPage.tsx::PrivacyPolicyPage': {
    summary: 'Renders the static privacy policy legal page.',
    tags: ['page', 'legal', 'static-content'],
    complexity: 'moderate',
  },
  'client/src/pages/TermsPage.tsx::TermsPage': {
    summary: 'Renders the static terms & conditions legal page.',
    tags: ['page', 'legal', 'static-content'],
    complexity: 'moderate',
  },
};

// File type mapping (all these are React/TS 'code' files -> node type 'file')
function nodeTypeFor(f) {
  return 'file';
}

const allNodes = [];
const allEdges = [];

for (const f of extract.results) {
  const path = f.path;
  const meta = fileMeta[path];
  if (!meta) throw new Error('Missing file meta for ' + path);
  const fileId = 'file:' + path;
  allNodes.push({
    id: fileId,
    type: 'file',
    name: path.split('/').pop(),
    filePath: path,
    summary: meta.summary,
    tags: meta.tags,
    complexity: meta.complexity,
    ...(meta.languageNotes ? { languageNotes: meta.languageNotes } : {}),
  });

  const exportedNames = new Set((f.exports || []).map((e) => e.name));
  const sigFns = (f.functions || []).filter(
    (fn) => fn.endLine - fn.startLine + 1 >= 10 || exportedNames.has(fn.name)
  );

  for (const fn of sigFns) {
    const key = path + '::' + fn.name;
    const fm = fnMeta[key];
    if (!fm) throw new Error('Missing function meta for ' + key);
    const fnId = 'function:' + path + ':' + fn.name;
    allNodes.push({
      id: fnId,
      type: 'function',
      name: fn.name,
      filePath: path,
      lineRange: [fn.startLine, fn.endLine],
      summary: fm.summary,
      tags: fm.tags,
      complexity: fm.complexity,
    });
    allEdges.push({ source: fileId, target: fnId, type: 'contains', direction: 'forward', weight: 1.0 });
    if (exportedNames.has(fn.name)) {
      allEdges.push({ source: fileId, target: fnId, type: 'exports', direction: 'forward', weight: 0.8 });
    }
  }

  // imports edges - 1:1 emission from batchImportData
  const imports = importData[path] || [];
  for (const target of imports) {
    allEdges.push({
      source: fileId,
      target: 'file:' + target,
      type: 'imports',
      direction: 'forward',
      weight: 0.7,
    });
  }
}

// Cross-batch depends_on edges informed by neighborMap (component usage, not plain import already captured)
// App.tsx already imports Header.tsx, PwaInstallPrompt.tsx, LocationContext.tsx via batchImportData -> covered by imports loop above (targets file:client/src/components/Header.tsx etc.)
// Footer.tsx imports usePwaInstall.ts -> covered by imports loop.
// PaymentPage.tsx imports LocationContext.tsx -> covered by imports loop.
// No additional edges needed beyond imports since batchImportData already includes these cross-batch paths.

console.log('Total nodes:', allNodes.length);
console.log('Total edges:', allEdges.length);

fs.writeFileSync('C:/Users/bijit/NowCart/.ua/tmp/batch1-all-nodes.json', JSON.stringify(allNodes, null, 2));
fs.writeFileSync('C:/Users/bijit/NowCart/.ua/tmp/batch1-all-edges.json', JSON.stringify(allEdges, null, 2));

// ---- Split into 3 parts by file path (alphabetical), preserving contains/exports with their file, imports by source file ----
const sortedPaths = extract.results.map((f) => f.path).sort();
const numParts = 3;
const size = Math.ceil(sortedPaths.length / numParts);
const partsFiles = [];
for (let i = 0; i < numParts; i++) {
  partsFiles.push(new Set(sortedPaths.slice(i * size, (i + 1) * size)));
}

function partIndexForPath(p) {
  for (let i = 0; i < partsFiles.length; i++) {
    if (partsFiles[i].has(p)) return i;
  }
  return -1;
}

const partNodes = [[], [], []];
const partEdges = [[], [], []];

for (const n of allNodes) {
  const idx = partIndexForPath(n.filePath);
  if (idx === -1) throw new Error('No part for node ' + n.id);
  partNodes[idx].push(n);
}

for (const e of allEdges) {
  // source is always file:<path> or function:<path>:<name> -> derive path
  const srcPath = e.source.startsWith('file:') ? e.source.slice(5) : e.source.split(':').slice(1, -1).join(':');
  const idx = partIndexForPath(srcPath);
  if (idx === -1) throw new Error('No part for edge source ' + e.source);
  partEdges[idx].push(e);
}

for (let i = 0; i < numParts; i++) {
  const out = { nodes: partNodes[i], edges: partEdges[i] };
  const outPath = `C:/Users/bijit/NowCart/.ua/intermediate/batch-1-part-${i + 1}.json`;
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Part ${i + 1}: ${partNodes[i].length} nodes, ${partEdges[i].length} edges -> ${outPath}`);
}
