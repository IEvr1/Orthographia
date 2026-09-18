import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/clerk-react";
import { isClerkConfigured } from "../lib/progressOwner";

export function AuthBar() {
  if (!isClerkConfigured()) return null;

  return (
    <div className="auth-bar">
      <SignedOut>
        <SignInButton mode="modal">
          <button type="button" className="btn-text">Σύνδεση</button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button type="button" className="btn-text">Εγγραφή</button>
        </SignUpButton>
      </SignedOut>
      <SignedIn>
        <span className="auth-bar-label">Συνδεδεμένος</span>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
    </div>
  );
}
