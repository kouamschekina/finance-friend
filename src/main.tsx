import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

registerSW({ immediate: true });

// Handle notification clicks — open /transactions when user taps a reminder
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NOTIFICATION_CLICK') {
      window.location.href = '/transactions';
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
