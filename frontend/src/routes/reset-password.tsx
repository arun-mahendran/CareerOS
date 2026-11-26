import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { auth } from "@/services/backend";
import { Logo } from "@/components/brand";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — CareerOS" },
      { name: "description", content: "Choose a new password for your CareerOS account." },
      { property: "og:title", content: "Set a new password — CareerOS" },
      { property: "og:description", content: "Choose a new password for your CareerOS account." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }],
  }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await auth.updatePassword(pw, new URLSearchParams(window.location.search).get("token"));
    } catch (error) {
      toast.error((error as Error).message);
      return;
    }
    toast.success("Password updated");
    if (await auth.hasSession()) { navigate({ to: "/dashboard" }); return; }
    navigate({ to: "/auth" });
  }
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border bg-card p-7 shadow-float">
        <Logo />
        <h1 className="mt-6 text-xl font-bold">Set a new password</h1>
        <input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="mt-5 w-full rounded-lg border px-3 py-2.5 text-sm" />
        <button className="mt-3 w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground">Update password</button>
      </form>
    </div>
  );
}
