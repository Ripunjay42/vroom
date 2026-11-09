import { useEffect, useRef, useState } from "react";

const MAX_SECONDS = 120;

// Records microphone audio. stop(true) = send result, stop(false) = discard.
export default function useRecorder(onDone) {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState("");
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const startedRef = useRef(0);
  const keepRef = useRef(true);
  const cbRef = useRef(onDone);
  cbRef.current = onDone;

  const cleanup = () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    setRecording(false);
    setSecs(0);
  };

  const stop = (keep = true) => {
    keepRef.current = keep;
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    else cleanup();
  };

  const start = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return setError("Voice recording is not supported in this browser.");
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) =>
        MediaRecorder.isTypeSupported(m)
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        const dur = (Date.now() - startedRef.current) / 1000;
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        const keep = keepRef.current;
        cleanup();
        if (keep && dur >= 0.5) cbRef.current(blob, Math.round(dur));
      };
      recRef.current = rec;
      keepRef.current = true;
      startedRef.current = Date.now();
      rec.start();
      setRecording(true);
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedRef.current) / 1000);
        setSecs(s);
        if (s >= MAX_SECONDS) stop(true);
      }, 250);
    } catch {
      cleanup();
      setError("Microphone access was denied.");
    }
  };

  useEffect(() => () => {
    keepRef.current = false;
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return { recording, secs, error, start, stop };
}
