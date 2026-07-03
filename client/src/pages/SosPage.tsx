// SOS mode has been removed. This component is kept as a stub to avoid
// import errors. The /sos route in App.tsx redirects to / anyway.
import { Navigate } from 'react-router-dom';
export default function SosPage() {
  return <Navigate to="/" replace />;
}
