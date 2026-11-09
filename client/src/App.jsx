import useRoom from "./hooks/useRoom.js";
import usePrivacy from "./hooks/usePrivacy.js";
import Lobby from "./components/Lobby.jsx";
import Chat from "./components/Chat.jsx";

export default function App() {
  const room = useRoom();
  const hidden = usePrivacy();
  return (
    <div className={hidden ? "app hidden" : "app"}>
      {room.phase === "lobby" ? (
        <Lobby
          onCreate={room.create}
          onJoin={room.join}
          onRejoin={room.rejoin}
          onForget={room.forget}
          session={room.session}
          error={room.error}
        />
      ) : (
        <Chat
          code={room.code}
          connected={room.connected}
          messages={room.messages}
          onSend={room.send}
          onSendImage={room.sendImage}
          onSendVoice={room.sendVoice}
          onRemove={room.remove}
          onLeave={room.leave}
          onEnd={room.end}
        />
      )}
      {hidden && <div className="cover">Hidden for privacy</div>}
    </div>
  );
}
