import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import { ContactPage } from "./pages/ContactPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsPage } from "./pages/TermsPage";
import "./styles/app.css";

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const path = window.location.pathname;

function Root() {
  if (path === "/privacy") return <PrivacyPage />;
  if (path === "/terms") return <TermsPage />;
  if (path === "/contact") return <ContactPage />;
  return <App />;
}

const tree = (
  <StrictMode>
    {clerkKey ? (
      <ClerkProvider publishableKey={clerkKey}>
        <Root />
      </ClerkProvider>
    ) : (
      <Root />
    )}
  </StrictMode>
);

createRoot(document.getElementById("root")!).render(tree);
