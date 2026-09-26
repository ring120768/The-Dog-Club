import Link from "next/link";
import { BrandForm } from "@/components/brand-form";
import { isDemoMode } from "@/lib/runtime";
export default function NewClub() {
  return (
    <main className="platform-main">
      <Link href="/platform" className="inline-link">
        ← All clubs
      </Link>
      <div className="platform-heading">
        <div>
          <span className="eyebrow">WELCOME A NEW OPERATOR</span>
          <h1>Make it their club.</h1>
          <p>
            Set the identity and assign a registered manager. They’ll see the
            new club the next time they sign in.
          </p>
        </div>
      </div>
      <BrandForm
        platform
        demoManagerEmail={isDemoMode() ? "manager@demo.invalid" : ""}
      />
    </main>
  );
}
