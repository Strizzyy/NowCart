import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, ShoppingCart, ArrowRight, DoorOpen } from 'lucide-react';
import type { AppContext } from '../App';
import { searchCatalog, postCartOp } from '../api/client';
import type { Product } from '../api/client';
import ProductCard from '../components/ProductCard';
import { FRONT_DOORS, type FrontDoor } from '../components/frontdoors/doors';
import FrontDoorPanel from '../components/frontdoors/FrontDoorPanel';
import { Card, Chip, FadeIn } from '../ui';

interface Props {
  ctx: AppContext;
}

const DOOR_ACCENT: Record<FrontDoor['tone'], string> = {
  primary: 'bg-primary-light/60 text-primary-ink',
  secondary: 'bg-primary-light/60 text-primary-ink',
  accent: 'bg-primary-light/60 text-primary-ink',
  info: 'bg-primary-light/60 text-primary-ink',
};

const DOOR_FEATURED_RING: Record<FrontDoor['tone'], string> = {
  primary: 'border-border',
  secondary: 'border-border',
  accent: 'border-border',
  info: 'border-border',
};

const featuredDoors = FRONT_DOORS.filter((d) => d.featured);
const secondaryDoors = FRONT_DOORS.filter((d) => !d.featured);

export default function HomePage({ ctx }: Props) {
  const [activeDoor, setActiveDoor] = useState<FrontDoor | null>(null);
  const [hasActivated, setHasActivated] = useState(false);
  const [picks, setPicks] = useState<Product[]>([]);
  const [loadingPicks, setLoadingPicks] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const results = await searchCatalog(undefined, undefined, 4);
        if (!cancelled) setPicks(results);
      } catch {
        /* non-blocking: hub works without the picks rail */
      } finally {
        if (!cancelled) setLoadingPicks(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const openDoor = (door: FrontDoor) => {
    setActiveDoor(door);
    setHasActivated(true);
  };  const handleAddToCart = async (product: Product) => {
    try {
      const sessionId = ctx.cart?.session_id || '';
      const updated = await postCartOp(sessionId, 'add', product.name, 1);
      ctx.setCart(updated);
      ctx.setCartOpen(true);
    } catch {
      /* ignore — cart errors surface in the cart drawer */
    }
  };

  const handleRemoveFromCart = async (product: Product) => {
    try {
      const sessionId = ctx.cart?.session_id || '';
      const currentItem = ctx.cart?.items.find(i => i.name === product.name);
      if (!currentItem) return;
      const newQty = currentItem.quantity - 1;
      const updated = newQty <= 0
        ? await postCartOp(sessionId, 'remove', product.name)
        : await postCartOp(sessionId, 'update', product.name, newQty);
      ctx.setCart(updated);
    } catch { /* ignore */ }
  };

  const getCartQty = (product: Product): number => {
    if (!ctx.cart) return 0;
    const item = ctx.cart.items.find(i => i.name === product.name);
    return item ? item.quantity : 0;
  };

  return (
    <div>
      {/* ============ Hero: thesis + narrative ============ */}
      <section className="bg-gradient-to-b from-primary-light to-light-bg">
        <div className="max-w-5xl mx-auto px-4 pt-12 pb-10 md:pt-16 md:pb-12 text-center">
          <FadeIn>
            <Chip tone="primary" className="mb-5">
              The intent-capture layer for quick commerce
            </Chip>
          </FadeIn>

          <FadeIn delay={60}>
            <h1 className="leading-tight mb-4">
              {/* NowCart wordmark */}
              <span className="inline-flex items-center justify-center gap-0 font-heading font-bold text-4xl md:text-6xl tracking-tight select-none">
                <span
                  className="text-primary-ink"
                  style={{
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    background: 'linear-gradient(135deg, #3bb77e 0%, #157347 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Now
                </span>
                <span
                  className="text-dark"
                  style={{
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Cart
                </span>
                {/* Small cart dot accent */}
                <span
                  className="ml-1 text-primary self-start mt-1 md:mt-2 text-xl md:text-2xl"
                  aria-hidden="true"
                  style={{ lineHeight: 1 }}
                >
                  🛒
                </span>
              </span>
              {/* Tagline on next line */}
              <br />
              <span className="text-2xl md:text-4xl font-heading font-semibold text-primary-ink">
                We solve the deciding.
              </span>
            </h1>
          </FadeIn>

          {/* <FadeIn delay={120}>
            <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto">
              Five ways in, one brain, one confident cart out.
            </p>
          </FadeIn> */}

          {/* the spine of the product, visualized */}
          
        </div>
      </section>

      {/* ============ The five front doors ============ */}
      <section className="max-w-6xl mx-auto px-4 -mt-4 md:-mt-6 pb-4">
        <h2 className="sr-only">Choose a front door</h2>

        {/* Section label */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-muted uppercase tracking-widest">Key features</span>
        </div>

        {/* ── FEATURED: Show + Share + Subscribe ── */}

        {/* Mobile: Show | Share side-by-side, Subscribe full-width below */}
        <div className="md:hidden mb-3">
          <div className="grid grid-cols-2 gap-3 mb-3" style={{ gridAutoRows: '1fr' }}>
            {featuredDoors.slice(0, 2).map((door, i) => (
              <FadeIn key={door.id} delay={i * 60} style={{ display: 'flex' }}>
                <button
                  type="button"
                  onClick={() => openDoor(door)}
                  aria-haspopup="dialog"
                  className={`group flex flex-col flex-1 w-full text-left rounded-2xl p-4 border-2 shadow-md bg-surface transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] ${DOOR_FEATURED_RING[door.tone]}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={`w-12 h-9 rounded-lg flex items-center justify-center ${DOOR_ACCENT[door.tone]}`}>{door.icon}</span>
                  </div>
                  <h3 className="font-heading font-bold text-base text-dark mb-1">{door.label}</h3>
                  <p className="text-xs text-muted line-clamp-2 mb-auto">{door.tagline}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-ink mt-3">
                    Open <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </button>
              </FadeIn>
            ))}
          </div>
          {featuredDoors[2] && (
            <FadeIn delay={120}>
              <button
                type="button"
                onClick={() => openDoor(featuredDoors[2])}
                aria-haspopup="dialog"
                className={`group w-full text-left rounded-2xl p-4 border-2 shadow-md bg-surface transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] ${DOOR_FEATURED_RING[featuredDoors[2].tone]}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${DOOR_ACCENT[featuredDoors[2].tone]}`}>{featuredDoors[2].icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-heading font-bold text-base text-dark">{featuredDoors[2].label}</h3>
                    </div>
                    <p className="text-xs text-muted line-clamp-1">{featuredDoors[2].tagline}</p>
                  </div>
                  <ArrowRight size={16} className="text-primary-ink shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </div>
              </button>
            </FadeIn>
          )}
        </div>

        {/* Desktop featured: 3 equal columns */}
        <div className="hidden md:grid md:grid-cols-3 gap-4 mb-4">
          {featuredDoors.map((door, i) => (
            <FadeIn key={door.id} delay={i * 70}>
              <button
                type="button"
                onClick={() => openDoor(door)}
                aria-haspopup="dialog"
                className={`group h-full w-full text-left rounded-2xl p-6 border-2 shadow-lg bg-surface transition-all duration-200 hover:shadow-xl hover:-translate-y-1 ${DOOR_FEATURED_RING[door.tone]}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <span className={`w-12 h-12 rounded-xl flex items-center justify-center ${DOOR_ACCENT[door.tone]}`}>{door.icon}</span>
                  {/* <span className="text-[11px] font-bold bg-secondary/15 text-secondary-dark px-2 py-1 rounded-full">✦ Core feature</span> */}
                </div>
                <h3 className="font-heading font-bold text-xl text-dark mb-1">{door.label}</h3>
                <p className="text-sm text-muted mb-2">{door.tagline}</p>
                <p className="text-xs text-muted/80 line-clamp-2 mb-4">{door.description}</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary-ink">
                  Open this door <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </button>
            </FadeIn>
          ))}
        </div>

        {/* ── SECONDARY: Speak + Budget ── */}
        <div className="flex items-center gap-2 mb-3 mt-2 md:mt-1">
          <span className="text-xs font-semibold text-muted uppercase tracking-widest">More ways in</span>
        </div>

        {/* Mobile secondary: compact 2-col */}
        <div className="md:hidden grid grid-cols-2 gap-3" style={{ gridAutoRows: '1fr' }}>
          {secondaryDoors.map((door, i) => (
            <FadeIn key={door.id} delay={i * 60} style={{ display: 'flex' }}>
              <button
                type="button"
                onClick={() => openDoor(door)}
                aria-haspopup="dialog"
                className="group flex flex-col flex-1 w-full text-left bg-surface border border-border rounded-xl p-3.5 shadow-[var(--shadow-card)] transition-all duration-200 hover:border-primary/30 active:scale-[0.98]"
              >
                <span className={`w-12 h-9 rounded-lg flex items-center justify-center mb-2.5 ${DOOR_ACCENT[door.tone]}`}>{door.icon}</span>
                <h3 className="font-heading font-semibold text-sm text-dark mb-1">{door.label}</h3>
                <p className="text-[11px] text-muted line-clamp-2">{door.tagline}</p>
              </button>
            </FadeIn>
          ))}
        </div>

        {/* Desktop secondary: 2-col horizontal strip */}
        <div className="hidden md:grid md:grid-cols-2 gap-4">
          {secondaryDoors.map((door, i) => (
            <FadeIn key={door.id} delay={i * 70}>
              <button
                type="button"
                onClick={() => openDoor(door)}
                aria-haspopup="dialog"
                className="group w-full text-left bg-surface border border-border rounded-xl p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:border-primary/30 flex items-center gap-4"
              >
                <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${DOOR_ACCENT[door.tone]}`}>{door.icon}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-heading font-semibold text-base text-dark mb-0.5">{door.label}</h3>
                  <p className="text-sm text-muted truncate">{door.tagline}</p>
                </div>
                <ArrowRight size={16} className="text-muted shrink-0 transition-transform group-hover:translate-x-1 group-hover:text-primary-ink" aria-hidden="true" />
              </button>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ============ Empty state: the flow, before any door is used ============ */}
      {!hasActivated && (
        <section className="max-w-4xl mx-auto px-4 py-8">
          <Card padding="lg" className="text-center">
            <div className="flex items-center justify-center gap-3 mb-5 flex-wrap">
              <span className="w-11 h-11 rounded-xl bg-primary-light text-primary-ink flex items-center justify-center">
                <DoorOpen size={22} />
              </span>
              <ArrowRight size={18} className="text-faint" aria-hidden="true" />
              <span className="w-11 h-11 rounded-xl bg-secondary/15 text-secondary-dark flex items-center justify-center">
                <Brain size={22} />
              </span>
              <ArrowRight size={18} className="text-faint" aria-hidden="true" />
              <span className="w-11 h-11 rounded-xl bg-green-100 text-green-800 flex items-center justify-center">
                <ShoppingCart size={22} />
              </span>
            </div>
            <h3 className="font-heading font-bold text-xl text-dark mb-2">
              Pick a door to begin
            </h3>
            <p className="text-muted text-sm max-w-xl mx-auto">
              However you start — showing a photo, sharing a recipe, subscribing for restocks,
              speaking a meal, or setting a budget — it all flows into the{' '}
              <strong className="text-dark">same brain</strong>. That engine decides for you and hands back{' '}
              <strong className="text-dark">one confident cart</strong>, ready to check out.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {FRONT_DOORS.map((d) => (
                <Chip key={d.id} tone={d.chipTone} icon={d.icon}>
                  {d.label}
                </Chip>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* ============ Fresh picks rail (secondary, design-system showcase) ============ */}
      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl md:text-2xl font-heading font-bold text-dark">Fresh picks</h2>
          <Link to="/shop" className="text-sm font-semibold text-primary-ink hover:underline">
            Browse →
          </Link>
        </div>
        {loadingPicks ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-light-bg rounded-2xl h-52 sm:h-64 animate-pulse" />
            ))}
          </div>
        ) : picks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {picks.map((p) => (
              <ProductCard
                key={p.product_id}
                product={p}
                onAddToCart={handleAddToCart}
                onRemoveFromCart={handleRemoveFromCart}
                cartQty={getCartQty(p)}
              />
            ))}
          </div>
        ) : null}
      </section>

      {/* The selected door opens here — client-side, no reload */}
      <FrontDoorPanel door={activeDoor} onClose={() => setActiveDoor(null)} ctx={ctx} />
    </div>
  );
}
