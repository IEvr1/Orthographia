import { useClerk } from "@clerk/clerk-react";
import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { hasLocalConsent } from "../lib/consent";
import { ConsentScreen } from "./ConsentScreen";

interface SignInWithConsentProps {
  children: ReactNode;
  onConsentAccepted?: () => void;
}

export function SignInWithConsent({ children, onConsentAccepted }: SignInWithConsentProps) {
  const clerk = useClerk();
  const [showConsent, setShowConsent] = useState(false);

  const openClerkSignIn = () => {
    clerk.openSignIn({});
  };

  const handleTrigger = () => {
    if (hasLocalConsent()) {
      openClerkSignIn();
      return;
    }
    setShowConsent(true);
  };

  const handleConsentAccepted = () => {
    setShowConsent(false);
    onConsentAccepted?.();
    openClerkSignIn();
  };

  const trigger =
    isValidElement(children) && children.type !== "string"
      ? cloneElement(children as ReactElement<{ onClick?: () => void }>, {
          onClick: handleTrigger,
        })
      : (
          <button type="button" onClick={handleTrigger}>
            {children}
          </button>
        );

  return (
    <>
      {trigger}
      {showConsent && (
        <div className="consent-overlay" role="dialog" aria-modal="true" aria-label="Συγκατάθεση γονέα">
          <ConsentScreen
            onAccepted={handleConsentAccepted}
            continueLabel="Συνέχεια στη σύνδεση"
          />
        </div>
      )}
    </>
  );
}
