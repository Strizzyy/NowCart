import { createContext, useContext, type ReactNode } from 'react';
import { useDeliveryLocation } from '../hooks/useLocation';

type LocationCtx = ReturnType<typeof useDeliveryLocation>;

const LocationContext = createContext<LocationCtx | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const value = useDeliveryLocation();
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

/** Use this instead of calling useDeliveryLocation() directly in components. */
export function useLocation(): LocationCtx {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used inside <LocationProvider>');
  return ctx;
}
