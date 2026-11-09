import { useCallback, useEffect, useRef, useState } from "react";
import Peer from "peerjs";

const PREFIX = "glassroom-v1-";
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SESSION_KEY = "glassroom-session";
const histKey = (c) => "glassroom-chat-" + c;

const genCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHA[b % ALPHA.length]).join("");
const uid = () =>
  (crypto.randomUUID && crypto.randomUUID()) || Date.now().toString(36) + Math.random().toString(36).slice(2);

// ---- local persistence (per device) ----
const loadSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
};
const loadHistory = (c) => {
  try { return JSON.parse(localStorage.getItem(histKey(c)) || "[]"); } catch { return []; }
};
function saveHistory(c, msgs) {
  let m = msgs.filter((x) => x.kind !== "sys");
  for (;;) {
    try { localStorage.setItem(histKey(c), JSON.stringify(m)); return; }
    catch {
      // storage full: drop the oldest stored image and retry
      const i = m.findIndex((x) => x.img || x.audio);
      if (i < 0) return;
      m = m.map((x, j) => (j === i ? { ...x, img: null, audio: null, mediaDropped: true } : x));
    }
  }
}

// ---- image helper: downscale to keep it light over WebRTC + storage ----
function fileToDataUrl(file, max = 1000, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const s = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * s);
      c.height = Math.round(im.height * s);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    im.src = url;
  });
}

// PeerJS = free public signalling API; messages travel peer-to-peer over WebRTC.
export default function useRoom() {
  const [phase, setPhase] = useState("lobby"); // lobby | room
  const [code, setCode] = useState("");
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [session, setSession] = useState(loadSession); // {code, role} for "Rejoin"
  const peerRef = useRef(null);
  const connRef = useRef(null);

  const sysMsg = (text) => ({ id: uid(), kind: "sys", text });
  const push = (m) => setMessages((p) => [...p, m]);
  const sys = (text) => push(sysMsg(text));

  // persist chat whenever it changes while in a room
  useEffect(() => {
    if (phase === "room" && code) saveHistory(code, messages);
  }, [messages, phase, code]);

  const teardown = () => {
    try { connRef.current?.close(); } catch {}
    try { peerRef.current?.destroy(); } catch {}
    connRef.current = null;
    peerRef.current = null;
    setConnected(false);
  };

  const reset = useCallback((msg = "") => {
    teardown();
    setMessages([]);
    setPhase("lobby");
    setError(msg);
  }, []);

  useEffect(() => () => {
    try { peerRef.current?.destroy(); } catch {}
  }, []);

  const enter = (c, role, text) => {
    const s = { code: c, role };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSession(s);
    setCode(c);
    setMessages([...loadHistory(c), sysMsg(text)]);
    setPhase("room");
  };

  const attach = (c) => {
    connRef.current = c;
    c.on("open", () => {
      setConnected(true);
      sys("Connected. Messages are private and peer-to-peer.");
    });
    c.on("data", (d) => {
      if (!d) return;
      if (d.del) {
        setMessages((p) =>
          p.map((m) => (m.id === d.del && m.kind === "them" ? { ...m, deleted: true, text: "", img: null, audio: null } : m))
        );
      } else if (typeof d.id === "string" && (typeof d.t === "string" || typeof d.img === "string" || typeof d.audio === "string")) {
        push({
          id: d.id, kind: "them", time: Date.now(),
          text: typeof d.t === "string" ? d.t.slice(0, 2000) : "",
          img: typeof d.img === "string" && d.img.startsWith("data:image/") ? d.img : null,
          audio: typeof d.audio === "string" && d.audio.startsWith("data:audio/") ? d.audio : null,
          dur: Number(d.dur) || 0,
        });
      }
    });
    c.on("close", () => {
      setConnected(false);
      sys("The other participant has left.");
      connRef.current = null;
    });
    c.on("error", () => sys("Connection error."));
  };

  // Host a room. `fixedCode` = rejoin an existing room (same code).
  const host = useCallback((fixedCode, tries = 0) => {
    setError("");
    const c = fixedCode || genCode();
    const peer = new Peer(PREFIX + c);
    peerRef.current = peer;
    peer.on("open", () => {
      enter(c, "host", fixedCode ? "Room reopened. Waiting for the other participant." : "Room created. Send the code to one person.");
    });
    peer.on("connection", (conn) => {
      if (connRef.current?.open) {
        // only 2 people per room
        conn.on("open", () => {
          conn.send({ full: true });
          setTimeout(() => conn.close(), 200);
        });
        return;
      }
      attach(conn);
    });
    peer.on("error", (e) => {
      if (e.type === "unavailable-id" && tries < 6) {
        peer.destroy();
        // fixed code: old registration may linger a few seconds; fresh code: pick another
        setTimeout(() => host(fixedCode, tries + 1), fixedCode ? 2500 : 0);
      } else {
        reset(e.type === "unavailable-id"
          ? "Room code is still in use. Try again in a moment."
          : `Could not open room (${e.type}).`);
      }
    });
  }, [reset]);

  const join = useCallback((raw) => {
    const c = raw.trim().toUpperCase();
    if (c.length !== 6) return setError("Enter the 6-character code.");
    setError("");
    const peer = new Peer();
    peerRef.current = peer;
    peer.on("open", () => {
      const conn = peer.connect(PREFIX + c, { reliable: true });
      let ok = false;
      const timer = setTimeout(() => { if (!ok) reset("Room not found. The host may be offline."); }, 9000);
      conn.on("open", () => { ok = true; clearTimeout(timer); });
      conn.on("data", (d) => {
        if (d?.full) { clearTimeout(timer); reset("Room is full."); }
      });
      enter(c, "guest", "Connecting...");
      attach(conn);
    });
    peer.on("error", (e) =>
      reset(e.type === "peer-unavailable" ? "Room not found. The host may be offline." : `Connection failed (${e.type}).`)
    );
  }, [reset]);

  const create = useCallback(() => host(null), [host]);

  const rejoin = useCallback(() => {
    const s = session;
    if (!s) return;
    if (s.role === "host") host(s.code);
    else join(s.code);
  }, [session, host, join]);

  const forget = useCallback(() => {
    if (session) localStorage.removeItem(histKey(session.code));
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }, [session]);

  // leave but keep chat so you can rejoin
  const leave = useCallback(() => reset(), [reset]);

  // end room and wipe the saved chat on this device
  const end = useCallback(() => {
    localStorage.removeItem(histKey(code));
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    reset();
  }, [code, reset]);

  const send = useCallback((text) => {
    const t = text.trim();
    if (!t || !connRef.current?.open) return false;
    const id = uid();
    connRef.current.send({ id, t });
    push({ id, kind: "me", text: t, time: Date.now() });
    return true;
  }, []);

  const sendImage = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (!connRef.current?.open) return sys("Wait for the other participant to connect before sending images.");
    try {
      const img = await fileToDataUrl(file);
      const id = uid();
      connRef.current?.send({ id, img });
      push({ id, kind: "me", text: "", img, time: Date.now() });
    } catch {
      sys("Could not read that image.");
    }
  }, []);

  const sendVoice = useCallback(async (blob, dur) => {
    if (!blob || !blob.size) return;
    if (!connRef.current?.open) return sys("Wait for the other participant to connect before sending voice messages.");
    const audio = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
    const id = uid();
    connRef.current?.send({ id, audio, dur });
    push({ id, kind: "me", text: "", audio, dur, time: Date.now() });
  }, []);

  // delete locally; if `everyone` and it's yours, also tell the other participant
  const remove = useCallback((id, everyone) => {
    if (everyone && connRef.current?.open) {
      connRef.current.send({ del: id });
      setMessages((p) => p.map((m) => (m.id === id ? { ...m, deleted: true, text: "", img: null, audio: null } : m)));
    } else {
      setMessages((p) => p.filter((m) => m.id !== id));
    }
  }, []);

  return {
    phase, code, connected, messages, error, session,
    create, join, rejoin, forget, send, sendImage, sendVoice, remove, leave, end,
  };
}
