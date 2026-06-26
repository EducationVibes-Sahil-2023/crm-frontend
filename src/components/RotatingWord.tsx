"use client";

import { useEffect, useState } from "react";

/** Cycles through words with a soft cross-fade. Used in the hero headline. */
export default function RotatingWord({
  words,
  interval = 2200,
  className = "",
}: {
  words: string[];
  interval?: number;
  className?: string;
}) {
  const [i, setI] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (words.length < 2) return;
    const id = window.setInterval(() => {
      setShow(false);
      window.setTimeout(() => {
        setI((p) => (p + 1) % words.length);
        setShow(true);
      }, 300);
    }, interval);
    return () => window.clearInterval(id);
  }, [words.length, interval]);

  return (
    <span
      className={`inline-block transition-all duration-300 ${show ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"} ${className}`}
    >
      {words[i]}
    </span>
  );
}
