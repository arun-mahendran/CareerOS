import { useEffect, useState } from "react";

export const CANDIDATE_SIDEBAR_KEY = "careeros-candidate-sidebar-collapsed";

export function useCandidateSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(CANDIDATE_SIDEBAR_KEY) === "true");
    } catch { /* Navigation remains usable with restricted storage. */ }
    setReady(true);
  }, []);

  function toggle() {
    setCollapsed((previous) => {
      const next = !previous;
      try { localStorage.setItem(CANDIDATE_SIDEBAR_KEY, String(next)); }
      catch { /* Persistence is optional. */ }
      return next;
    });
  }

  return { collapsed, ready, toggle };
}