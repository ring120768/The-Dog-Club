"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { saveDogAction, type FormState } from "@/app/actions";
import { MAX_PHOTO_BYTES, PHOTO_ACCEPT, photoUrl } from "@/lib/photo-contract";
import { DogAvatar } from "./dog-avatar";
import type { Dog } from "@/lib/dogs";
export function DogForm({ club, dog }: { club: string; dog?: Dog }) {
  const [name, setName] = useState(dog?.name ?? "");
  const [breed, setBreed] = useState(dog?.breed ?? "");
  const [bio, setBio] = useState(dog?.bio ?? "");
  const [avatar, setAvatar] = useState(dog?.avatar ?? "sand");
  const [audience, setAudience] = useState(dog?.audience ?? "private");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [removePhoto, setRemovePhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!selectedPhoto) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(selectedPhoto);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedPhoto]);
  const [state, action, pending] = useActionState(
    async (previous: FormState, form: FormData) => {
      // Keep the selected File across validation errors; React may reset the native file input after an action.
      if (selectedPhoto) form.set("photo", selectedPhoto);
      else form.delete("photo");
      if (removePhoto) form.set("removePhoto", "on");
      else form.delete("removePhoto");
      return saveDogAction(club, dog?.id, previous, form);
    },
    {},
  );
  const storedPhoto = dog?.photo_id
    ? photoUrl("members", dog.club_id, dog.id, dog.photo_id)
    : undefined;
  function clearSelection() {
    setSelectedPhoto(null);
    setPhotoError(undefined);
    if (fileInput.current) fileInput.current.value = "";
  }
  return (
    <form action={action} className="profile-form">
      <fieldset className="editor-fields" disabled={pending}>
        <section className="photo-editor" aria-labelledby="photo-heading">
          <DogAvatar
            large
            colour={avatar}
            name={name || "Your dog"}
            photoSrc={removePhoto ? undefined : (preview ?? storedPhoto)}
          />
          <div className="photo-editor-controls">
            <h2 id="photo-heading">Their best side.</h2>
            <p>A photo makes the introduction.</p>
            <label className="photo-picker">
              <Camera size={18} />
              <span>
                {storedPhoto || selectedPhoto
                  ? "Choose a different photo"
                  : "Choose a photo"}
              </span>
              <input
                ref={fileInput}
                type="file"
                name="photo"
                accept={PHOTO_ACCEPT}
                aria-describedby="photo-help"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > MAX_PHOTO_BYTES) {
                    setPhotoError("Choose a photo no larger than 5 MB.");
                    event.target.value = "";
                    return;
                  }
                  setPhotoError(undefined);
                  setRemovePhoto(false);
                  setSelectedPhoto(file);
                }}
              />
            </label>
            <small id="photo-help">
              JPEG, PNG or WebP · up to 5 MB and 20 megapixels. On iPhone,
              choose a JPEG rather than HEIC.
            </small>
            {selectedPhoto && (
              <div className="photo-selection">
                <span role="status">New photo ready to save</span>
                <button
                  type="button"
                  className="text-button"
                  onClick={clearSelection}
                >
                  <X size={15} />
                  Cancel selection
                </button>
              </div>
            )}
            {storedPhoto && (
              <label className="remove-photo">
                <input
                  type="checkbox"
                  checked={removePhoto}
                  name="removePhoto"
                  onChange={(event) => {
                    setRemovePhoto(event.target.checked);
                    clearSelection();
                  }}
                />
                Remove current photo when saving
              </label>
            )}
            {removePhoto && (
              <small role="status">
                The illustration will be used after you save.
              </small>
            )}
            {photoError && (
              <p className="error" role="alert">
                {photoError}
              </p>
            )}
          </div>
        </section>
        <label>
          Dog’s name
          <input
            name="name"
            required
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Bertie"
          />
        </label>
        <label>
          Breed or mix
          <input
            name="breed"
            maxLength={80}
            value={breed}
            onChange={(event) => setBreed(event.target.value)}
            placeholder="A very good mix is fine"
          />
        </label>
        <label>
          A little personality
          <textarea
            name="bio"
            maxLength={400}
            rows={4}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Favourite things, special talents, biscuit preferences…"
          />
          <small>
            Up to 400 characters. Keep owner details and care information
            private.
          </small>
        </label>
        <label>
          Fallback illustration
          <select
            name="avatar"
            value={avatar}
            onChange={(event) => setAvatar(event.target.value as Dog["avatar"])}
          >
            <option value="sand">Biscuit</option>
            <option value="sage">Sage</option>
            <option value="rose">Rose</option>
          </select>
          <small>Shown when no photo is available.</small>
        </label>
        <fieldset>
          <legend>Who can see this profile and photo?</legend>
          {[
            ["private", "Just us", "You and authorised club managers."],
            [
              "members",
              "Our club",
              "Other members of this club. Your name stays private.",
            ],
            [
              "public",
              "Everyone with the link",
              "A public page anyone can share. No owner or care details.",
            ],
          ].map(([value, title, description]) => (
            <label className="radio-option" key={value}>
              <input
                type="radio"
                name="audience"
                value={value}
                checked={audience === value}
                onChange={() => setAudience(value as Dog["audience"])}
              />
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
            </label>
          ))}
          {audience === "public" && (
            <p className="photo-privacy-note">
              Only share a photo you have permission to use. Anyone who sees a
              public photo can save a copy; making it private later won’t remove
              those copies.
            </p>
          )}
        </fieldset>
      </fieldset>
      {state.error && (
        <p role="alert" className="error">
          {state.error} Your entries are still here.
        </p>
      )}
      <button className="button" disabled={pending || !!photoError}>
        {pending
          ? selectedPhoto
            ? "Saving profile and photo…"
            : "Saving…"
          : "Save profile"}
      </button>
    </form>
  );
}
