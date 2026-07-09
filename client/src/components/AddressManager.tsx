/**
 * AddressManager — Zepto/Blinkit-style saved address sheet.
 * Shows saved addresses, lets user pick one, add new (GPS or manual), delete.
 */
import { useState } from 'react';
import { MapPin, Navigation, Plus, Trash2, Check, ChevronRight, X, Loader2, Home, Briefcase, MoreHorizontal } from 'lucide-react';
import type { SavedAddress, AddressLabel } from '../hooks/useLocation';
import { useLocation } from '../context/LocationContext';

interface Props {
  onClose: () => void;
}

type Sheet = 'list' | 'add-choose' | 'add-gps' | 'add-manual';

const LABEL_META: Record<AddressLabel, { icon: React.ReactNode; color: string }> = {
  Home:  { icon: <Home size={14} />,          color: 'bg-primary-light text-primary-ink' },
  Work:  { icon: <Briefcase size={14} />,      color: 'bg-purple-100 text-purple-700' },
  Other: { icon: <MoreHorizontal size={14} />, color: 'bg-amber-100 text-amber-700' },
};

export default function AddressManager({ onClose }: Props) {
  const {
    addresses, activeAddress, locState,
    detectGPS, addAddress, removeAddress, setActive,
  } = useLocation();

  const [sheet, setSheet] = useState<Sheet>('list');

  // "Add new" form state
  const [newLabel, setNewLabel]     = useState<AddressLabel>('Home');
  const [newNickname, setNewNickname] = useState('');
  const [newFlat, setNewFlat]       = useState('');
  const [newBlock, setNewBlock]     = useState('');
  const [newArea, setNewArea]       = useState('');
  const [newCity, setNewCity]       = useState('');
  const [newPin, setNewPin]         = useState('');
  const [detecting, setDetecting]   = useState(false);
  const [detectedData, setDetectedData] = useState<Omit<SavedAddress, 'id' | 'label' | 'nickname'> | null>(null);
  const [gpsError, setGpsError]     = useState('');

  const handleDetectGPS = async () => {
    setDetecting(true);
    setGpsError('');
    const geo = await detectGPS();
    setDetecting(false);
    if (!geo) {
      setGpsError('Could not detect location. Please allow location access or add manually.');
      return;
    }
    setDetectedData(geo);
    setNewBlock(geo.block ?? '');
    setNewArea(geo.area);
    setNewCity(geo.city);
    setNewPin(geo.pincode ?? '');
    setSheet('add-gps');
  };

  const handleSaveGPS = () => {
    if (!detectedData) return;
    addAddress({
      label: newLabel,
      nickname: newNickname || newLabel,
      ...detectedData,
      block: newBlock || detectedData.block,
      area: newArea || detectedData.area,
      city: newCity || detectedData.city,
      pincode: newPin || detectedData.pincode,
    });
    onClose();
  };

  const handleSaveManual = () => {
    if (!newArea.trim() || !newCity.trim()) return;
    addAddress({
      label: newLabel,
      nickname: newNickname || newLabel,
      block: newBlock || undefined,
      area: [newFlat, newArea].filter(Boolean).join(', '),
      city: newCity,
      pincode: newPin || undefined,
      fullAddress: [newFlat, newBlock, newArea, newCity, newPin].filter(Boolean).join(', '),
      isManual: true,
    });
    onClose();
  };

  const resetAddForm = () => {
    setNewLabel('Home'); setNewNickname(''); setNewFlat('');
    setNewBlock(''); setNewArea(''); setNewCity(''); setNewPin('');
    setDetectedData(null); setGpsError('');
  };

  /* ── Shared wrapper ── */
  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-dark/50" aria-hidden="true" />

      <div
        className="relative bg-surface rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md mx-auto shadow-[var(--shadow-pop)] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />

        {/* ══════════ LIST SHEET ══════════ */}
        {sheet === 'list' && (
          <>
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
              <h2 className="font-heading font-bold text-dark text-base">Delivery address</h2>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-light-bg transition" aria-label="Close">
                <X size={18} className="text-muted" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {addresses.length === 0 ? (
                <p className="text-sm text-muted text-center py-6">No saved addresses yet.</p>
              ) : (
                addresses.map((addr) => {
                  const isActive = activeAddress?.id === addr.id;
                  const meta = LABEL_META[addr.label];
                  return (
                    <div
                      key={addr.id}
                      className={[
                        'flex items-start gap-3 p-3.5 rounded-xl border-2 transition cursor-pointer',
                        isActive ? 'border-primary bg-primary-light/40' : 'border-border hover:border-primary/30',
                      ].join(' ')}
                      onClick={() => { setActive(addr.id); onClose(); }}
                    >
                      {/* Label icon */}
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${meta.color}`}>
                        {meta.icon}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-bold text-dark">{addr.nickname || addr.label}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.color}`}>
                            {addr.label}
                          </span>
                          {addr.isManual === false && (
                            <span className="text-[10px] text-muted bg-light-bg px-1.5 py-0.5 rounded-full">GPS</span>
                          )}
                        </div>
                        <p className="text-xs text-muted truncate">
                          {[addr.block, addr.area].filter(Boolean).join(', ')}
                          {addr.city && addr.city !== addr.area ? `, ${addr.city}` : ''}
                          {addr.pincode ? ` — ${addr.pincode}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isActive && <Check size={16} className="text-primary-ink" />}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeAddress(addr.id); }}
                          className="p-1.5 rounded-lg text-muted hover:text-accent-dark hover:bg-red-50 transition"
                          aria-label={`Delete ${addr.nickname || addr.label}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add new */}
            <div className="px-4 pb-5 pt-3 border-t border-border shrink-0">
              <button
                onClick={() => { resetAddForm(); setSheet('add-choose'); }}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 border-dashed border-primary/40 text-primary-ink hover:bg-primary-light/30 transition"
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Plus size={16} /> Add new address
                </span>
                <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}

        {/* ══════════ CHOOSE METHOD ══════════ */}
        {sheet === 'add-choose' && (
          <>
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border shrink-0">
              <button onClick={() => setSheet('list')} className="p-1.5 rounded-lg hover:bg-light-bg transition" aria-label="Back">
                <X size={18} className="text-muted rotate-180" />
              </button>
              <h2 className="font-heading font-bold text-dark text-base">Add address</h2>
            </div>

            <div className="px-4 py-5 space-y-3">
              {/* Label picker */}
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Save as</p>
                <div className="flex gap-2">
                  {(['Home', 'Work', 'Other'] as AddressLabel[]).map((lbl) => (
                    <button
                      key={lbl}
                      onClick={() => setNewLabel(lbl)}
                      className={[
                        'flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-sm font-semibold transition',
                        newLabel === lbl
                          ? `border-primary ${LABEL_META[lbl].color}`
                          : 'border-border text-muted hover:border-primary/40',
                      ].join(' ')}
                    >
                      {LABEL_META[lbl].icon} {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nickname */}
              <div>
                <label className="text-xs font-semibold text-dark block mb-1.5">
                  Nickname <span className="text-muted font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  placeholder={`e.g. Mom's house`}
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary min-h-[44px]"
                />
              </div>

              {gpsError && (
                <p className="text-xs text-accent-dark bg-red-50 rounded-xl px-3 py-2">{gpsError}</p>
              )}

              {/* GPS button */}
              <button
                onClick={handleDetectGPS}
                disabled={detecting || locState === 'requesting'}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-primary/40 bg-primary-light/30 hover:bg-primary-light/60 transition disabled:opacity-60"
              >
                {detecting ? (
                  <Loader2 size={18} className="text-primary-ink animate-spin shrink-0" />
                ) : (
                  <Navigation size={18} className="text-primary-ink shrink-0" />
                )}
                <div className="text-left">
                  <p className="text-sm font-semibold text-dark">Use current location</p>
                  <p className="text-xs text-muted">Detect via GPS</p>
                </div>
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Manual button */}
              <button
                onClick={() => setSheet('add-manual')}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-border hover:border-primary/40 transition"
              >
                <MapPin size={18} className="text-muted shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-dark">Enter address manually</p>
                  <p className="text-xs text-muted">Type flat, area, city, pincode</p>
                </div>
                <ChevronRight size={16} className="text-muted ml-auto" />
              </button>
            </div>
          </>
        )}

        {/* ══════════ CONFIRM GPS ADDRESS ══════════ */}
        {sheet === 'add-gps' && detectedData && (
          <>
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border shrink-0">
              <button onClick={() => setSheet('add-choose')} className="p-1.5 rounded-lg hover:bg-light-bg transition" aria-label="Back">
                <ChevronRight size={18} className="text-muted rotate-180" />
              </button>
              <h2 className="font-heading font-bold text-dark text-base">Confirm location</h2>
            </div>

            <div className="px-4 py-5 space-y-4 overflow-y-auto flex-1">
              {/* Detected address preview */}
              <div className="flex items-start gap-3 bg-primary-light/40 rounded-xl p-3.5">
                <Navigation size={16} className="text-primary-ink mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-dark">{detectedData.area}</p>
                  <p className="text-xs text-muted">{detectedData.fullAddress}</p>
                </div>
              </div>

              {/* Editable fields */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-dark block mb-1.5">Block / Street / Neighbourhood</label>
                  <input value={newBlock} onChange={(e) => setNewBlock(e.target.value)}
                    placeholder="e.g. Block B, MG Road, Sector 13"
                    className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary min-h-[44px]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-dark block mb-1.5">Area / Locality</label>
                  <input value={newArea} onChange={(e) => setNewArea(e.target.value)}
                    className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary min-h-[44px]" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-dark block mb-1.5">City</label>
                    <input value={newCity} onChange={(e) => setNewCity(e.target.value)}
                      className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary min-h-[44px]" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-dark block mb-1.5">Pincode</label>
                    <input value={newPin} onChange={(e) => setNewPin(e.target.value)} inputMode="numeric"
                      className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary min-h-[44px]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 pb-5 pt-3 border-t border-border shrink-0">
              <button onClick={handleSaveGPS}
                className="w-full py-3.5 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2">
                <Check size={16} /> Save this address
              </button>
            </div>
          </>
        )}

        {/* ══════════ MANUAL ADDRESS ══════════ */}
        {sheet === 'add-manual' && (
          <>
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border shrink-0">
              <button onClick={() => setSheet('add-choose')} className="p-1.5 rounded-lg hover:bg-light-bg transition" aria-label="Back">
                <ChevronRight size={18} className="text-muted rotate-180" />
              </button>
              <h2 className="font-heading font-bold text-dark text-base">Enter address</h2>
            </div>

            <div className="px-4 py-5 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-semibold text-dark block mb-1.5">Flat / House no. / Building</label>
                <input value={newFlat} onChange={(e) => setNewFlat(e.target.value)}
                  placeholder="e.g. B-204, Green Park Apartments"
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary min-h-[44px]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-dark block mb-1.5">Block / Street / Neighbourhood</label>
                <input value={newBlock} onChange={(e) => setNewBlock(e.target.value)}
                  placeholder="e.g. Block B, MG Road, Sector 13"
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary min-h-[44px]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-dark block mb-1.5">Area / Locality <span className="text-accent-dark">*</span></label>
                <input value={newArea} onChange={(e) => setNewArea(e.target.value)}
                  placeholder="e.g. Dwarka Sector 10"
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary min-h-[44px]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-dark block mb-1.5">City <span className="text-accent-dark">*</span></label>
                  <input value={newCity} onChange={(e) => setNewCity(e.target.value)}
                    placeholder="New Delhi"
                    className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary min-h-[44px]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-dark block mb-1.5">Pincode</label>
                  <input value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric" placeholder="110075"
                    className="w-full border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary min-h-[44px]" />
                </div>
              </div>
            </div>

            <div className="px-4 pb-5 pt-3 border-t border-border shrink-0">
              <button
                onClick={handleSaveManual}
                disabled={!newArea.trim() || !newCity.trim()}
                className="w-full py-3.5 rounded-xl bg-primary disabled:bg-border disabled:text-muted text-white font-bold text-sm flex items-center justify-center gap-2 transition"
              >
                <Check size={16} /> Save address
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
