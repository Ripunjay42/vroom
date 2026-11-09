import { useState } from "react";

export default function Lobby({ onCreate, onJoin, onRejoin, onForget, session, error }) {
  const [code, setCode] = useState("");
  return (
    <section className="screen">
      <div className="glass card">
        <h1>Glass Room</h1>
        <p className="sub">Private chat for two. One code, no accounts.</p>

        {session && (
          <>
            <button className="btn rejoin" onClick={onRejoin}>
              Rejoin room <span className="mono">{session.code}</span>
            </button>
            <button className="link" onClick={onForget}>Forget this room and delete its chat</button>
            <div className="or">OR START NEW</div>
          </>
        )}

        <button className="btn" onClick={onCreate}>Create a room</button>
        <div className="or">OR JOIN</div>
        <input
          className="field code-in"
          value={code}
          maxLength={6}
          placeholder="CODE"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && onJoin(code)}
        />
        <button className="btn" onClick={() => onJoin(code)}>Join room</button>
        <div className="err">{error}</div>
      </div>
    </section>
  );
}
