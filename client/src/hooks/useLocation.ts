import { useState, useEffect, useCallback } from 'react';

export type LocationState = 'idle' | 'requesting' | 'granted' | 'denied' | 'error';
export type AddressLabel = 'Home' | 'Work' | 'Other';

export interface SavedAddress {
  id: string;
  label: AddressLabel;
  nickname: string;      // user-typed: "Mom's house", "Office", etc.
  block?: string;        // block / street / neighbourhood (e.g. "Block B", "MG Road", "Sector 13")
  area: string;
  city: string;
  pincode?: string;
  fullAddress?: string;  // manually typed full address
  lat?: number;
  lng?: number;
  isManual?: boolean;    // true = typed, false = GPS
}

const ADDRESSES_KEY = 'nc_addresses';
const ACTIVE_KEY    = 'nc_active_address';

function loadAddresses(): SavedAddress[] {
  try {
    const raw = localStorage.getItem(ADDRESSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAddresses(list: SavedAddress[]) {
  localStorage.setItem(ADDRESSES_KEY, JSON.stringify(list));
}

/** Reverse-geocode via free OpenStreetMap Nominatim (no API key needed). */
export async function reverseGeocode(lat: number, lng: number): Promise<Pick<SavedAddress, 'block' | 'area' | 'city' | 'pincode' | 'fullAddress'>> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) throw new Error('Nominatim error');
    const data = await res.json();
    const addr = data.address ?? {};

    // block: most precise sub-locality detail
    // Nominatim uses different tags for Indian addresses — check all relevant ones
    // and combine them (e.g. "Block B, Industrial Area")
    const blockParts = [
      addr.quarter,        // "Block B"
      addr.industrial,     // "Industrial Area"
      addr.residential,    // residential colony name
      addr.allotments,     // plotted colony
      addr.road,           // street name
      addr.pedestrian,
      addr.footway,
      addr.neighbourhood,
    ].filter(Boolean);
    const block = blockParts.length > 0 ? blockParts.join(', ') : '';

    // area: broader locality (sector, suburb, village)
    const area =
      addr.suburb ||
      addr.village ||
      addr.town ||
      addr.county ||
      addr.state_district || '';

    const city =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.state_district ||
      addr.state || '';

    const pincode = addr.postcode;
    const fullAddress = data.display_name ?? '';

    return { block: block || undefined, area: area || city, city, pincode, fullAddress };
  } catch {
    return { area: 'Your location', city: '', fullAddress: '' };
  }
}

export function useDeliveryLocation() {
  const [addresses, setAddresses] = useState<SavedAddress[]>(loadAddresses);
  const [activeId, setActiveIdState] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_KEY)
  );
  const [locState, setLocState] = useState<LocationState>('idle');

  const activeAddress = addresses.find(a => a.id === activeId) ?? addresses[0] ?? null;

  // Sync granted state
  useEffect(() => {
    if (activeAddress) setLocState('granted');
  }, [activeAddress?.id]);

  const persist = (list: SavedAddress[]) => {
    setAddresses(list);
    saveAddresses(list);
  };

  const setActive = (id: string) => {
    setActiveIdState(id);
    setLocState('granted');
    localStorage.setItem(ACTIVE_KEY, id);
  };

  /** Detect GPS → reverse geocode → return data (caller decides whether to save). */
  const detectGPS = useCallback((): Promise<Omit<SavedAddress, 'id' | 'label' | 'nickname'> | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { setLocState('error'); resolve(null); return; }
      setLocState('requesting');

      // Try high-accuracy (GPS chip) first with a generous timeout.
      // Falls back to network-based if GPS isn't available.
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          const geo = await reverseGeocode(coords.latitude, coords.longitude);
          resolve({ ...geo, lat: coords.latitude, lng: coords.longitude, isManual: false });
        },
        (err) => {
          if (err.code === err.TIMEOUT) {
            // GPS timed out — retry once with low-accuracy (faster, uses cell/wifi)
            navigator.geolocation.getCurrentPosition(
              async ({ coords }) => {
                const geo = await reverseGeocode(coords.latitude, coords.longitude);
                resolve({ ...geo, lat: coords.latitude, lng: coords.longitude, isManual: false });
              },
              (fallbackErr) => {
                setLocState(fallbackErr.code === 1 ? 'denied' : 'error');
                resolve(null);
              },
              { enableHighAccuracy: false, timeout: 8000 }
            );
          } else {
            setLocState(err.code === 1 ? 'denied' : 'error');
            resolve(null);
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
  }, []);

  /** Add a new address and make it active. */
  const addAddress = useCallback((addr: Omit<SavedAddress, 'id'>) => {
    const id = `addr_${Date.now()}`;
    const newAddr: SavedAddress = { ...addr, id };
    const updated = [...addresses, newAddr];
    persist(updated);
    setActive(id);
    return id;
  }, [addresses]);

  /** Remove a saved address. */
  const removeAddress = useCallback((id: string) => {
    const updated = addresses.filter(a => a.id !== id);
    persist(updated);
    if (activeId === id) {
      const next = updated[0];
      if (next) { setActive(next.id); }
      else { setActiveIdState(null); setLocState('idle'); localStorage.removeItem(ACTIVE_KEY); }
    }
  }, [addresses, activeId]);

  /** Update label/nickname of an address. */
  const updateAddress = useCallback((id: string, patch: Partial<Pick<SavedAddress, 'label' | 'nickname'>>) => {
    const updated = addresses.map(a => a.id === id ? { ...a, ...patch } : a);
    persist(updated);
  }, [addresses]);

  const requestLocation = useCallback(async () => {
    const geo = await detectGPS();
    if (!geo) return;
    const id = `addr_${Date.now()}`;
    const newAddr: SavedAddress = {
      id, label: 'Home', nickname: 'Current location', isManual: false, ...geo,
    };
    const updated = [...addresses, newAddr];
    persist(updated);
    setActive(id);
  }, [addresses, detectGPS]);

  return {
    addresses,
    activeAddress,
    locState,
    detectGPS,
    addAddress,
    removeAddress,
    updateAddress,
    setActive,
    requestLocation,
  };
}
