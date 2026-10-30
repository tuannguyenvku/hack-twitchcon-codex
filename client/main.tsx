import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./styles.css";
import { Dashboard } from "./Dashboard";
import { Arena } from "./Arena";
import { useArena } from "./useArena";
function Overlay() {
  const token =
    new URLSearchParams(location.hash.slice(1)).get("token") ??
    new URLSearchParams(location.search).get("token") ??
    "";
  const { state, status } = useArena(!!token, token);
  return (
    <main className="overlay-page">
      <Arena
        state={state}
        status={token ? status : "Paste an OBS URL from your dashboard"}
      />
    </main>
  );
}
const overlay = location.pathname === "/overlay";
document.documentElement.classList.toggle("overlay-document", overlay);
createRoot(document.getElementById("root")!).render(
  overlay ? <Overlay /> : <Dashboard />,
);
