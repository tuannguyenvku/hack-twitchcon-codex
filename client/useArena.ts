import { useEffect, useRef, useState } from "react";
import { acceptFrame, type PublicState } from "./state";
import type { Frame } from "../shared/protocol";
export function useArena(enabled: boolean, overlayToken?: string) {
  const [state, setState] = useState<PublicState | null>(null),
    [status, setStatus] = useState("Disconnected");
  const current = useRef<PublicState | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let closed = false,
      ws: WebSocket | undefined,
      timer: ReturnType<typeof setTimeout>,
      watchdog: ReturnType<typeof setInterval>,
      attempt = 0,
      lastMessage = Date.now();
    const connect = () => {
      if (closed) return;
      setStatus(current.current ? "Reconnecting" : "Connecting");
      ws = new WebSocket(
        `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}${overlayToken ? `/ws/overlay?token=${encodeURIComponent(overlayToken)}` : "/ws/dashboard"}`,
      );
      ws.onopen = () => {
        lastMessage = Date.now();
      };
      ws.onmessage = (event) => {
        lastMessage = Date.now();
        try {
          const frame = JSON.parse(event.data) as Frame;
          const next = acceptFrame(current.current, frame);
          if (next.resync) {
            ws?.send(JSON.stringify({ type: "snapshot" }));
            return;
          }
          if (next.state) {
            current.current = next.state;
            setState(next.state);
            attempt = 0;
            setStatus("Connected");
          }
        } catch {
          setStatus("Invalid update");
          ws?.close();
        }
      };
      ws.onclose = () => {
        if (closed) return;
        setStatus("Reconnecting");
        timer = setTimeout(
          connect,
          Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5)) +
            Math.random() * 250,
        );
      };
      ws.onerror = () => {
        if (!closed) setStatus("Connection unavailable");
      };
    };
    connect();
    watchdog = setInterval(() => {
      if (Date.now() - lastMessage > 15000) {
        setStatus("Reconnecting");
        ws?.close();
      }
    }, 5000);
    return () => {
      closed = true;
      clearTimeout(timer);
      clearInterval(watchdog);
      ws?.close();
    };
  }, [enabled, overlayToken]);
  return { state, status };
}
