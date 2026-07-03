"use client";

import { useEffect, useRef, useState } from "react";
import { useUser, UserProfile } from "@clerk/nextjs";
import { PageHeader } from "@/components/PageHeader";
import { Panel, SectionTitle } from "@/components/ui";
import { cn } from "@/lib/cn";
import { getChatSettings, setChatSettings, type ChatProvider } from "@/lib/chatSettings";
import { User, Camera, Check, Loader2, IdCard, Building2, UserCog, Sparkles, KeyRound, Eye, EyeOff } from "lucide-react";

const ROLES = [
  "Radiologist",
  "Cardiologist",
  "Ophthalmologist",
  "Pathologist",
  "Clinician",
  "Resident",
  "Technologist",
  "Administrator",
];

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("");
  const [organization, setOrganization] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Aura Assistant (chatbot) model settings — stored locally in the browser.
  const [chatProvider, setChatProvider] = useState<ChatProvider>("medgemma");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");
  const [showKey, setShowKey] = useState(false);
  const [chatSaved, setChatSaved] = useState(false);

  useEffect(() => {
    const s = getChatSettings();
    setChatProvider(s.provider); setGeminiKey(s.geminiKey); setGeminiModel(s.geminiModel);
  }, []);
  function saveChat() {
    setChatSettings({ provider: chatProvider, geminiKey: geminiKey.trim(), geminiModel: geminiModel.trim() || "gemini-2.5-flash" });
    setChatSaved(true); setTimeout(() => setChatSaved(false), 2000);
  }

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setRole((user.unsafeMetadata?.role as string) || "");
    setOrganization((user.unsafeMetadata?.organization as string) || "");
  }, [user]);

  if (!isLoaded || !user) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading account…
      </div>
    );
  }

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    setErr(null);
    try {
      await user.update({
        firstName,
        lastName,
        unsafeMetadata: { ...user.unsafeMetadata, role, organization },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setErr(e?.errors?.[0]?.message || e?.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setErr(null);
    try {
      await user.setProfileImage({ file });
      await user.reload();
    } catch (e: any) {
      setErr(e?.errors?.[0]?.message || e?.message || "Could not update photo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" subtitle="Your profile, role & account" />

      {/* Profile */}
      <Panel className="mb-5">
        <SectionTitle title="Profile" subtitle="Name, role and profile photo" icon={User} />

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          {/* avatar */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <div className="h-24 w-24 overflow-hidden rounded-2xl ring-1 ring-white/10">
                {user.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.imageUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-medical-600 text-2xl font-bold text-white">
                    {(firstName?.[0] || user.primaryEmailAddress?.emailAddress?.[0] || "U").toUpperCase()}
                  </div>
                )}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-xl bg-medical-600 text-white shadow-lg transition hover:bg-medical-500"
                title="Change photo"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
            </div>
            <span className="text-[11px] text-slate-500">Change photo</span>
          </div>

          {/* fields */}
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name" icon={User}>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Last name" icon={User}>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Role" icon={UserCog}>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
                <option value="">Select a role…</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Organization" icon={Building2}>
              <input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Hospital / clinic" className={inputCls} />
            </Field>
            <Field label="Email" icon={IdCard}>
              <input value={user.primaryEmailAddress?.emailAddress || ""} disabled className={cn(inputCls, "opacity-60")} />
            </Field>
          </div>
        </div>

        {err && <p className="mt-4 text-sm text-critical">{err}</p>}
        <div className="mt-5 flex items-center gap-3">
          <button onClick={saveProfile} disabled={saving} className="btn-primary disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
            {saved ? "Saved" : saving ? "Saving…" : "Save changes"}
          </button>
          <span className="text-xs text-slate-500">Stored securely with your account — no separate database.</span>
        </div>
      </Panel>

      {/* Aura Assistant (chatbot) model */}
      <Panel className="mb-5">
        <SectionTitle title="AI Assistant" subtitle="Choose the chatbot model — and set your Gemini key" icon={Sparkles} />
        <div className="space-y-4">
          <div>
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400"><Sparkles className="h-3.5 w-3.5" /> Chat model</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([
                { id: "medgemma", name: "MedGemma (Colab)", desc: "Free medical vision model. Best for reading images." },
                { id: "gemini", name: "Gemini", desc: "Great for text chat & every language. Needs a free key." },
              ] as const).map((o) => (
                <button key={o.id} onClick={() => setChatProvider(o.id)}
                  className={cn("rounded-xl border p-3 text-left transition", chatProvider === o.id ? "border-teal-500/50 bg-teal-500/10" : "border-white/10 bg-navy-850 hover:bg-white/5")}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">{o.name}{chatProvider === o.id && <Check className="h-4 w-4 text-teal-300" />}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">{o.desc}</div>
                </button>
              ))}
            </div>
          </div>
          {chatProvider === "gemini" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Gemini API key" icon={KeyRound}>
                <div className="relative">
                  <input type={showKey ? "text" : "password"} value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIza…" className={cn(inputCls, "pr-10 font-mono")} />
                  <button onClick={() => setShowKey((v) => !v)} type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-teal-300 hover:underline">Get a free key →</a>
              </Field>
              <Field label="Gemini model" icon={Sparkles}>
                <input value={geminiModel} onChange={(e) => setGeminiModel(e.target.value)} placeholder="gemini-2.5-flash" className={inputCls} />
              </Field>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button onClick={saveChat} className="btn-primary">{chatSaved ? <Check className="h-4 w-4" /> : null}{chatSaved ? "Saved" : "Save assistant settings"}</button>
            <span className="text-xs text-slate-500">Stored only in this browser. You can also change this by chatting: “use gemini”, “my key is AIza…”.</span>
          </div>
        </div>
      </Panel>

      {/* Full account management via Clerk */}
      <Panel>
        <SectionTitle title="Account & Security" subtitle="Email, password, connected accounts, sessions & devices" />
        <div className="overflow-hidden rounded-xl">
          <UserProfile routing="hash" appearance={{ elements: { rootBox: "w-full", card: "shadow-none bg-transparent" } }} />
        </div>
      </Panel>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-xl border border-white/10 bg-navy-850 px-3 text-sm text-slate-200 outline-none focus:border-medical-500/50 focus:ring-2 focus:ring-medical-500/20";

function Field({ label, icon: Icon, children }: { label: string; icon: any; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      {children}
    </label>
  );
}
