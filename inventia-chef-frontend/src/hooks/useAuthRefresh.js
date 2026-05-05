import { useEffect, useState } from 'react';

export function useAuthRefresh() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const refresh = () => setTick((prev) => prev + 1);
    window.addEventListener('auth-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('auth-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
}
