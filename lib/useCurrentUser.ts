"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "entegro-comment-author";

// There's no login system — this just remembers which person is using this
// particular browser, so comments get attributed automatically instead of
// having to reselect a name every time. It's per-device, not secure or
// enforced; anyone can change it.
export function useCurrentUser() {
  const [currentUser, setCurrentUserState] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(KEY);
    if (saved) setCurrentUserState(saved);
    setLoaded(true);
  }, []);

  const setCurrentUser = useCallback((name: string) => {
    setCurrentUserState(name);
    if (name) window.localStorage.setItem(KEY, name);
    else window.localStorage.removeItem(KEY);
  }, []);

  return { currentUser, setCurrentUser, loaded };
}
