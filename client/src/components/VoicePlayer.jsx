import { useRef, useState } from "react";

const mmss = (s) => {
  s = Math.max(0, Math.round(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function VoicePlayer({ src, dur }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const total = dur || 0;

  const toggle = (e) => {
    e.stopPropagation();
    const a = ref.current;
    if (!a) return;
    if (a.paused) a.play(); else a.pause();
  };

  return (
    <div className="voice" onClick={(e) => e.stopPropagation()}>
      <button type="button" className="vplay" onClick={toggle}>{playing ? "II" : ">"}</button>
      <div className="vbar"><i style={{ width: total ? `${Math.min(100, (pos / total) * 100)}%` : 0 }} /></div>
      <span className="vtime">{mmss(playing || pos ? pos : total)}</span>
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setPos(0); }}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
      />
    </div>
  );
}
