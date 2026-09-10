"use client";

import { useEffect, useRef, useState } from 'react';

/**
 * Marks elements with the `reveal` class as revealed once they enter the
 * viewport. Returns a ref to attach to a container; all descendants with
 * `.reveal` (and optional `.reveal-delay-*`) get animated in.
 *
 * The mark is a `data-revealed` attribute rather than a class, and that is
 * deliberate. React owns the `className` prop: the moment a revealed element
 * re-renders with a different className string — an accordion row that gains a
 * border when it opens, say — React writes the JSX string straight onto the
 * node and any class added imperatively here is gone. Since the observer has
 * already unobserved that element, nothing ever puts it back and the row is
 * stuck at `opacity: 0`. React never touches attributes it does not set, so
 * `data-revealed` survives every re-render.
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>('.reveal'));
    if (!('IntersectionObserver' in window) || els.length === 0) {
      els.forEach((el) => el.setAttribute('data-revealed', ''));
      setReady(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-revealed', '');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => io.observe(el));
    setReady(true);
    return () => io.disconnect();
  }, []);

  return { ref, ready };
}
