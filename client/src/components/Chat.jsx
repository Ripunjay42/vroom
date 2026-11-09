import { useEffect, useRef, useState } from "react";
import VoicePlayer from "./VoicePlayer.jsx";
import useRecorder from "../hooks/useRecorder.js";

const fmt = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function Chat({ code, connected, messages, onSend, onSendImage, onSendVoice, onRemove, onLeave, onEnd }) {
  const [text, setText] = useState("");
  const [sel, setSel] = useState(null); // message whose actions are open
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const rec = useRecorder((blob, dur) => onSendVoice(blob, dur));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = (e) => {
    e.preventDefault();
    if (onSend(text)) setText("");
  };

  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onSendImage(f);
  };

  const end = () => {
    if (window.confirm("End this room and delete the saved chat on this device?")) onEnd();
  };

  return (
    <section className="screen">
      <div className="glass chat">
        <div className="top">
          <span className={"dot" + (connected ? " ok" : "")} />
          <div className="title">
            <b>{connected ? "Connected - 2 of 2" : "Waiting for participant..."}</b>
            <small>Chat is saved on this device. Leave and rejoin anytime.</small>
          </div>
          <span className="code-pill">{code}</span>
          <button className="btn leave" onClick={onLeave}>Leave</button>
          <button className="btn leave danger" onClick={end}>End</button>
        </div>

        <div className="msgs" onClick={() => setSel(null)}>
          {messages.map((m) => {
            if (m.kind === "sys") return <div key={m.id} className="sys">{m.text}</div>;
            if (m.deleted)
              return <div key={m.id} className={"m gone " + m.kind}>This message was deleted</div>;
            const open = sel === m.id;
            return (
              <div
                key={m.id}
                className={"m " + m.kind + (open ? " open" : "")}
                onClick={(e) => { e.stopPropagation(); setSel(open ? null : m.id); }}
              >
                {m.img && <img src={m.img} alt="" draggable={false} />}
                {m.audio && <VoicePlayer src={m.audio} dur={m.dur} />}
                {m.mediaDropped && <em>Media removed (storage full)</em>}
                {m.text}
                <time>{fmt(m.time)}</time>
                {open && (
                  <div className="acts">
                    <button onClick={() => onRemove(m.id, false)}>Delete for me</button>
                    {m.kind === "me" && connected && (
                      <button onClick={() => onRemove(m.id, true)}>Delete for everyone</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {rec.error && <div className="err rec-err">{rec.error}</div>}
        {rec.recording ? (
          <div className="bar recbar">
            <span className="recdot" />
            <span className="rectime">Recording {Math.floor(rec.secs / 60)}:{String(rec.secs % 60).padStart(2, "0")}</span>
            <button type="button" className="btn leave" onClick={() => rec.stop(false)}>Cancel</button>
            <button type="button" className="btn send" onClick={() => rec.stop(true)}>Send</button>
          </div>
        ) : (
          <form className="bar" onSubmit={submit} autoComplete="off">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
            <button type="button" className="btn attach" title="Send image" onClick={() => fileRef.current?.click()}>
              Photo
            </button>
            <button type="button" className="btn attach" title="Record voice message" onClick={rec.start}>
              Voice
            </button>
            <input
              className="field"
              value={text}
              maxLength={2000}
              placeholder="Type a message..."
              autoComplete="off"
              autoFocus
              onChange={(e) => setText(e.target.value)}
            />
            <button className="btn send" type="submit">Send</button>
          </form>
        )}
      </div>
    </section>
  );
}
