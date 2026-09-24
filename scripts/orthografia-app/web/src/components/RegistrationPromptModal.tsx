import { SignInButton } from "@clerk/clerk-react";

interface RegistrationPromptModalProps {
  onDismiss: () => void;
}

export function RegistrationPromptModal({ onDismiss }: RegistrationPromptModalProps) {
  return (
    <div className="modal-overlay registration-modal" role="dialog" aria-modal="true" aria-labelledby="registration-title">
      <div className="modal-card registration-modal__card">
        <h2 id="registration-title" className="modal-title">Εγγραφή</h2>
        <p className="registration-modal__text">
          Δημιούργησε δωρεάν λογαριασμό για να ξεκινήσεις την εξάσκηση. Οι πρώτες 5 ημέρες είναι
          δωρεάν!
        </p>
        <SignInButton mode="modal">
          <button type="button" className="btn btn-primary btn-xl registration-modal__cta">
            Εγγραφή / Σύνδεση
          </button>
        </SignInButton>
        <button type="button" className="btn-text registration-modal__later" onClick={onDismiss}>
          Αργότερα
        </button>
      </div>
    </div>
  );
}
