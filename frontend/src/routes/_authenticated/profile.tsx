import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { updateProfile } from "@/lib/user-data";
import { profileQuery } from "@/lib/user-data";
import { PageHeader } from "@/components/app-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — CareerOS" },
      { name: "description", content: "Your CareerOS profile: photo, name, email and target role." },
      { property: "og:title", content: "Your profile — CareerOS" },
      { property: "og:description", content: "Your CareerOS profile: photo, name, email and target role." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  return (
    <Suspense>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const { data: profile } = useSuspenseQuery(profileQuery);
  const qc = useQueryClient();
  const name = profile?.full_name || profile?.email?.split("@")[0] || "";
  const initials = name.slice(0, 1).toUpperCase() || "?";

  const [fullName, setFullName] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setTargetRole(profile.target_role);
    }
  }, [profile]);

  async function save() {
    setSaving(true);
    try {
      await updateProfile({ full_name: fullName.trim() || null, target_role: targetRole.trim() || "Frontend Engineer" });
    } catch {
      setSaving(false);
      toast.error("Could not save your profile. Try again.");
      return;
    }
    setSaving(false);
    await qc.invalidateQueries({ queryKey: ["profile"] });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast.success("Profile updated");
  }

  return (
    <div>
      <PageHeader eyebrow="Account" title="Your profile" sub="Your details and the role you're aiming for." />
      <Link to="/dashboard" className="mb-6 -mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to overview
      </Link>

      <div className="rounded-2xl border bg-card p-6 shadow-soft md:p-8">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 border border-border">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={name || "Profile"} />}
            <AvatarFallback className="bg-accent text-lg font-semibold text-accent-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{name}</p>
            <p className="truncate text-sm text-muted-foreground">{profile?.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {profile?.avatar_url ? "Photo from your Google account" : "No Google photo — using your initial"}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="full-name">Full name</Label>
            <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="target-role">Target role</Label>
            <Input id="target-role" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="Frontend Engineer" />
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <Button onClick={save} disabled={saving} className="min-w-28">
            {saved ? (
              <>
                <Check className="size-4" /> Saved
              </>
            ) : (
              "Save changes"
            )}
          </Button>
          <p className="text-xs text-muted-foreground">Email and photo come from your Google account.</p>
        </div>
      </div>
    </div>
  );
}
