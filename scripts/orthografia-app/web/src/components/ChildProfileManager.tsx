import { useEffect, useRef, useState } from "react";
import { MAX_CHILD_NAME_LENGTH, sanitizeChildName, validateChildName } from "../lib/childName";
import type { ChildProfile } from "../lib/subscription";
import { deleteChildProfile, upsertChildProfile } from "../lib/subscription";

const GRADE_LABELS: Record<number, string> = {
  1: "Α΄",
  2: "Β΄",
  3: "Γ΄",
  4: "Δ΄",
  5: "Ε΄",
  6: "Στ΄",
};

interface ChildProfileManagerProps {
  profiles: ChildProfile[];
  maxProfiles: number;
  activeProfileId: string | null;
  getToken: () => Promise<string | null>;
  onSelectProfile: (id: string) => void;
  onRefresh: () => Promise<void>;
  autoOpenAdd?: boolean;
}

interface FormState {
  id?: string;
  name: string;
  grade: number;
}

export function ChildProfileManager({
  profiles,
  maxProfiles,
  activeProfileId,
  getToken,
  onSelectProfile,
  onRefresh,
  autoOpenAdd = false,
}: ChildProfileManagerProps) {
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoOpenedRef = useRef(false);

  const openAdd = () => {
    setError(null);
    setEditing({ name: "", grade: 3 });
  };

  const openEdit = (profile: ChildProfile) => {
    setError(null);
    setEditing({ id: profile.id, name: profile.name, grade: profile.grade });
  };

  const closeForm = () => {
    setEditing(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!editing) return;
    const name = sanitizeChildName(editing.name);
    const validationError = validateChildName(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (editing.grade < 1 || editing.grade > 6) {
      setError("Επίλεξε τάξη από Α΄ έως Στ΄.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const profile = await upsertChildProfile(getToken, {
        id: editing.id,
        name,
        grade: editing.grade,
        sortOrder: editing.id
          ? profiles.find((p) => p.id === editing.id)?.sortOrder ?? 0
          : profiles.length,
      });
      await onRefresh();
      onSelectProfile(profile.id);
      closeForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Σφάλμα αποθήκευσης";
      setError(message.includes("foreign key") ? "Δεν ήταν δυνατή η αποθήκευση. Δοκίμασε ξανά." : message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Να διαγραφεί αυτό το προφίλ;")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteChildProfile(getToken, id);
      await onRefresh();
      if (activeProfileId === id) {
        const remaining = profiles.filter((p) => p.id !== id);
        onSelectProfile(remaining[0]?.id ?? "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Σφάλμα διαγραφής");
    } finally {
      setSaving(false);
    }
  };

  const canAdd = profiles.length < maxProfiles;

  useEffect(() => {
    if (!autoOpenAdd || autoOpenedRef.current || !canAdd) return;
    autoOpenedRef.current = true;
    setError(null);
    setEditing({ name: "", grade: 3 });
  }, [autoOpenAdd, canAdd]);

  return (
    <div className="profile-manager">
      <p className="section-label">Προφίλ παιδιών</p>

      {profiles.length === 0 ? (
        <p className="hint-text profile-empty-hint">
          Δημιούργησε προφίλ για κάθε παιδί (έως {maxProfiles}).
        </p>
      ) : (
        <div className="profile-chips">
          {profiles.map((profile) => {
            const active = activeProfileId === profile.id;
            return (
              <div key={profile.id} className={`profile-chip${active ? " profile-chip--active" : ""}`}>
                <button
                  type="button"
                  className="profile-chip-main"
                  onClick={() => onSelectProfile(profile.id)}
                >
                  <span className="profile-chip-name">{profile.name}</span>
                  <span className="profile-chip-grade">{GRADE_LABELS[profile.grade]}</span>
                </button>
                <button
                  type="button"
                  className="profile-chip-edit"
                  onClick={() => openEdit(profile)}
                  aria-label={`Επεξεργασία ${profile.name}`}
                >
                  ✎
                </button>
              </div>
            );
          })}
        </div>
      )}

      {error && !editing && <p className="error-msg profile-error">{error}</p>}

      {canAdd && (
        <button
          type="button"
          className={`btn profile-add-btn${profiles.length === 0 ? " btn-primary btn-xl" : " btn-secondary"}`}
          onClick={openAdd}
        >
          {profiles.length === 0 ? "Πρόσθεσε παιδί" : "Πρόσθεσε ακόμα ένα παιδί"}
        </button>
      )}

      {editing && (
        <div className="modal-overlay" onClick={closeForm}>
          <div
            className="modal-card"
            role="dialog"
            aria-labelledby="profile-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="profile-form-title" className="modal-title">
              {editing.id ? editing.name : "Νέο παιδί"}
            </h2>

            <label className="form-label">
              Όνομα
              <input
                type="text"
                className="form-input"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Μαρία, Maria, Marια"
                maxLength={MAX_CHILD_NAME_LENGTH}
                inputMode="text"
                lang="el"
                autoComplete="name"
                autoFocus
              />
            </label>

            <div className="grade-options">
              {[1, 2, 3, 4, 5, 6].map((grade) => (
                <button
                  key={grade}
                  type="button"
                  className={`grade-chip${editing.grade === grade ? " grade-chip--active" : ""}`}
                  onClick={() => setEditing({ ...editing, grade })}
                >
                  {GRADE_LABELS[grade]}
                </button>
              ))}
            </div>

            {error && <p className="error-msg">{error}</p>}

            <div className="modal-actions">
              {editing.id && (
                <button
                  type="button"
                  className="btn-text btn-text--danger"
                  disabled={saving}
                  onClick={() => handleDelete(editing.id!)}
                >
                  Διαγραφή
                </button>
              )}
              <div className="modal-actions-right">
                <button type="button" className="btn-text" onClick={closeForm} disabled={saving}>
                  Ακύρωση
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? "…" : "Αποθήκευση"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
