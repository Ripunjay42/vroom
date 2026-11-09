import { useEffect, useState } from "react";

// Best-effort browser privacy: no copy, no select, hide on blur / screenshot keys.
export default function usePrivacy() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const isInput = (t) => t && t.tagName === "INPUT";
    const wipe = () => {
      try { navigator.clipboard.writeText(" "); } catch {}
    };
    let timer;
    const flash = () => {
      setHidden(true);
      clearTimeout(timer);
      timer = setTimeout(() => setHidden(!document.hasFocus() || document.hidden), 1500);
    };
    const sync = () => setHidden(document.hidden || !document.hasFocus());

    const block = (e) => {
      if (e.type === "selectstart" && isInput(e.target)) return;
      e.preventDefault();
    };
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === "PrintScreen") { wipe(); flash(); }
      if (mod && ["c", "x", "s", "p", "u"].includes(k)) e.preventDefault();
      if (mod && k === "a" && !isInput(e.target)) e.preventDefault();
      if (e.key === "F12" || (mod && e.shiftKey && ["i", "j", "c"].includes(k))) e.preventDefault();
      if (mod && e.shiftKey && ["s", "3", "4", "5"].includes(k)) flash();
    };
    const onKeyUp = (e) => {
      if (e.key === "PrintScreen") wipe();
    };

    const evs = ["copy", "cut", "dragstart", "contextmenu", "selectstart"];
    evs.forEach((ev) => document.addEventListener(ev, block, true));
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("beforeprint", flash);
    sync();

    return () => {
      evs.forEach((ev) => document.removeEventListener(ev, block, true));
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("beforeprint", flash);
      clearTimeout(timer);
    };
  }, []);

  return hidden;
}
