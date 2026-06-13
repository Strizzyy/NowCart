import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, ShoppingCart, ArrowRight, Sparkles, DoorOpen } from 'lucide-react';
import type { AppContext } from '../App';
import { searchCatalog, postCartOp, postOutcome } from '../api/client';
import type { Product } from '../api/client';
import ProductCard from '../components/ProductCard';
import { FRONT_DOORS, type FrontDoor } from '../components/frontdoors/doors';
import FrontDoorPanel from '../components/frontdoors/FrontDoorPanel';
import { Card, Chip, FadeIn } from '../ui';

interface Props {
  ctx: AppContext;
}

const DOOR_ACCENT: Record<FrontDoor['tone'], string> = {
  primary: 'bg-primary-light text-primary-ink',
  secondary: 'bg-secondary/15 text-secondary-dark',
  accent: 'bg-accent/10 text-accent-dark',
  info: 'bg-blue-100 text-blue-800',
};

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
  };

  const handleAddToCart = async (product: Product) => {
    try {
      if (ctx.cart) {
        const updated = await postCartOp(ctx.cart.session_id, 'add', product.name, 1);
        ctx.setCart(updated);
      } else {
        const cart = await postOutcome(product.name);
        ctx.setCart(cart);
      }
      ctx.setCartOpen(true);
    } catch {
      /* ignore — cart errors surface in the cart drawer */
    }
  };

  return (
    <div>
      {/* ============ Hero: thesis + narrative ============ */}
      <section className="bg-gradient-to-b from-primary-light to-light-bg">
        <div className="max-w-5xl mx-auto px-4 pt-12 pb-10 md:pt-16 md:pb-12 text-center">
          <FadeIn>
            <Chip tone="primary" icon={<Sparkles size={12} />} className="mb-5">
              The intent-capture layer for quick commerce
            </Chip>
          </FadeIn>

          <FadeIn delay={60}>
            <h1 className="text-3xl md:text-5xl font-heading font-bold text-dark leading-tight mb-4">
              Quick commerce solved delivery.
              <br />
              <span className="text-primary-ink">We solve the deciding.</span>
            </h1>
          </FadeIn>

          <FadeIn delay={120}>
            <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto">
              Four ways in, one brain, one confident cart out.
            </p>
          </FadeIn>

          {/* the spine of the product, visualized */}
          <FadeIn delay={180}>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              <Chip tone="primary" icon={<DoorOpen size={12} />}>Four doors</Chip>
              <ArrowRight size={16} className="text-faint" aria-hidden="true" />
              <Chip tone="secondary" icon={<Brain size={12} />}>One brain</Chip>
              <ArrowRight size={16} className="text-faint" aria-hidden="true" />
              <Chip tone="success" icon={<ShoppingCart size={12} />}>One confident cart</Chip>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============ The four front doors ============ */}
      <section className="max-w-6xl mx-auto px-4 -mt-4 md:-mt-6 pb-4">
        <h2 className="sr-only">Choose a front door</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FRONT_DOORS.map((door, i) => (
            <FadeIn key={door.id} delay={i * 70}>
              <button
                type="button"
                onClick={() => openDoor(door)}
                aria-haspopup="dialog"
                className="group h-full w-full text-left bg-surface border border-border rounded-2xl p-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:shadow-[var(--shadow-pop)] hover:border-primary/40 hover:-translate-y-0.5"
              >
                <span
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${DOOR_ACCENT[door.tone]}`}
                >
                  {door.icon}
                </span>
                <h3 className="font-heading font-bold text-lg text-dark mb-1">{door.label}</h3>
                <p className="text-sm text-muted mb-4">{door.tagline}</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary-ink">
                  Open this door
                  <ArrowRight
                    size={15}
                    className="transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </span>
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
              However you start — speaking a meal, setting a budget, showing a photo, or sharing a
              recipe — it all flows into the <strong className="text-dark">same brain</strong>. That
              engine decides for you and hands back <strong className="text-dark">one confident
              cart</strong>, ready to check out. Four doors in, one cart out.
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
            Browse the catalog →
          </Link>
        </div>
        {loadingPicks ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-light-bg rounded-2xl h-64 animate-pulse" />
            ))}
          </div>
        ) : picks.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {picks.map((p) => (
              <ProductCard key={p.product_id} product={p} onAddToCart={handleAddToCart} />
            ))}
          </div>
        ) : null}
      </section>

      {/* The selected door opens here — client-side, no reload */}
      <FrontDoorPanel door={activeDoor} onClose={() => setActiveDoor(null)} ctx={ctx} />
    </div>
  );
}
