"use client";

import { useEffect } from "react";

export default function ThemeInitializer() {
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("theme");
      const shouldUseDark = saved
        ? saved === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", shouldUseDark);
    } catch {
      // Theme preference is optional; leave the default light theme intact.
    }
  }, []);

  return null;
}
