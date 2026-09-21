"use client";

import { useEffect, useRef, useState } from "react";
import { UserProfile } from "@clerk/nextjs";
import { AUTH_ENABLED } from "@/lib/auth-mode";
import { useOptionalUser } from "@/lib/use-optional-user";
import { DEFAULT_GROQ_MODEL, resolveGroqModel } from "@/lib/groqModels";
import { PageHeader } from "@/components/PageHeader";
import { Panel, SectionTitle } from "@/components/ui";
import { cn } from "@/lib/cn";
import { getChatSettings, setChatSettings, type ChatProvider } from "@/lib/chatSettings";
import { User, Camera, Check, Loader2, IdCard, Building2, UserCog, Sparkles, KeyRound, Eye, EyeOff, RefreshCw } from "lucide-react";

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
  const { user, isLoaded } = useOptionalUser();
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
  const [groqKey, setGroqKey] = useState("");
  const [groqModel, setGroqModel] = useState(DEFAULT_GROQ_MODEL);
  const [showKey, setShowKey] = useState(false);
  const [chatSaved, setChatSaved] = useState(false);
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [groqModels, setGroqModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState<"" | "gemini" | "groq">("");
  const [modelErr, setModelErr] = useState("");
  const [serverKeys, setServerKeys] = useState<{ gemini: boolean; groq: boolean }>({ gemini: false, groq: false });

  useEffect(() => {
    const s = getChatSettings();
    setChatProvider(s.provider); setGeminiKey(s.geminiKey); setGeminiModel(s.geminiModel);
    setGroqKey(s.groqKey); setGroqModel(s.groqModel);
    fetch("/api/settings-keys").then((r) => r.json()).then((d) => {
      setServerKeys({ gemini: !!d?.gemini, groq: !!d?.groq });
      if (d?.geminiModel && !s.geminiModel) setGeminiModel(d.geminiModel);
      if (d?.groqModel && !s.groqModel) setGroqModel(d.groqModel);
    }).catch(() => {});
    // Load models (uses the entered key, or the server's .env key as a fallback).
    loadModels("gemini", s.geminiKey);
    loadModels("groq", s.groqKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadModels(provider: "gemini" | "groq", key: string) {
    setLoadingModels(provider); setModelErr("");
    try {
      const r = await fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, key: key.trim() }) });
      const d = await r.json();
      if (provider === "gemini") setGeminiModels(d.models || []); else setGroqModels(d.models || []);
      if (d.error) setModelErr(d.error);
      else if (!(d.models || []).length) setModelErr("No models returned — check the key.");
    } catch (e: any) { setModelErr(String(e?.message || e)); } finally { setLoadingModels(""); }
  }

  async function saveChat() {
    // Keys go to the SERVER (.env.local); only the non-secret provider + model choice stays local.
    try {
      const r = await fetch("/api/settings-keys", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geminiKey: geminiKey.trim(), groqKey: groqKey.trim(), geminiModel: geminiModel.trim(), groqModel: groqModel.trim() }) });
      const d = await r.json();
      setServerKeys({ gemini: !!d?.gemini, groq: !!d?.groq });
      if (d?.note) setModelErr(d.note);
    } catch { setModelErr("Couldn't reach the server to save keys."); }
    // Never keep the key values in the browser.
    setChatSettings({
      provider: chatProvider, geminiKey: "", groqKey: "",
      geminiModel: geminiModel.trim() || "gemini-2.5-flash",
      groqModel: resolveGroqModel(groqModel),
    });
    setGeminiKey(""); setGroqKey("");
    setChatSaved(true); setTimeout(() => setChatSaved(false), 2500);
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {([
                { id: "medgemma", name: "MedGemma", desc: "Free medical vision (Colab). Best for images." },
                { id: "gemini", name: "Gemini", desc: "Great chat, every language. Free key." },
                { id: "groq", name: "Groq", desc: "Very fast. Llama & vision models. Free key." },
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
            <ProviderKeyModel
              label="Gemini" keyValue={geminiKey} onKey={setGeminiKey} model={geminiModel} onModel={setGeminiModel} serverSet={serverKeys.gemini}
              models={geminiModels} loading={loadingModels === "gemini"} onLoad={() => loadModels("gemini", geminiKey)}
              placeholder="AIza…" getKeyUrl="https://aistudio.google.com/apikey" showKey={showKey} setShowKey={setShowKey} />
          )}
          {chatProvider === "groq" && (
            <ProviderKeyModel
              label="Groq" keyValue={groqKey} onKey={setGroqKey} model={groqModel} onModel={setGroqModel} serverSet={serverKeys.groq}
              models={groqModels} loading={loadingModels === "groq"} onLoad={() => loadModels("groq", groqKey)}
              placeholder="gsk_…" getKeyUrl="https://console.groq.com/keys" showKey={showKey} setShowKey={setShowKey} />
          )}
          {modelErr && <p className="text-xs text-amber-400">{modelErr}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={saveChat} className="btn-primary">{chatSaved ? <Check className="h-4 w-4" /> : null}{chatSaved ? "Saved" : "Save assistant settings"}</button>
            {(geminiKey || groqKey) && (
              <button onClick={() => { setGeminiKey(""); setGroqKey(""); setChatSettings({ geminiKey: "", groqKey: "" }); }} className="btn-ghost">
                Clear keys from browser
              </button>
            )}
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            🔒 Keys you enter here are saved on the <b>server</b> (written to <code className="text-slate-400">.env.local</code>), <b>never stored in the browser</b> and never committed to git. Only the (non‑secret) provider &amp; model choice stays in this browser.
          </p>
        </div>
      </Panel>

      {/* Full account management via Clerk */}
      {AUTH_ENABLED && (
      <Panel>
        <SectionTitle title="Account & Security" subtitle="Email, password, connected accounts, sessions & devices" />
        <div className="overflow-hidden rounded-xl">
          <UserProfile routing="hash" appearance={{ elements: { rootBox: "w-full", card: "shadow-none bg-transparent" } }} />
        </div>
      </Panel>
      )}
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

function ProviderKeyModel({ label, keyValue, onKey, model, onModel, models, loading, onLoad, placeholder, getKeyUrl, showKey, setShowKey, serverSet }: {
  label: string; keyValue: string; onKey: (v: string) => void; model: string; onModel: (v: string) => void;
  models: string[]; loading: boolean; onLoad: () => void; placeholder: string; getKeyUrl: string; showKey: boolean; setShowKey: (v: boolean) => void; serverSet: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={`${label} API key`} icon={KeyRound}>
        <div className="relative">
          <input type={showKey ? "text" : "password"} value={keyValue} onChange={(e) => onKey(e.target.value)} onBlur={onLoad} placeholder={serverSet ? "•••••••• saved on server — leave blank to keep" : placeholder} className={cn(inputCls, "pr-10 font-mono")} />
          <button onClick={() => setShowKey(!showKey)} type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
        </div>
        <div className="mt-1 flex items-center gap-2">
          {serverSet && <span className="inline-flex items-center gap-1 text-[11px] text-teal-300"><Check className="h-3 w-3" /> Saved on server</span>}
          <a href={getKeyUrl} target="_blank" rel="noreferrer" className="text-[11px] text-slate-400 hover:text-teal-300 hover:underline">Get a free key →</a>
        </div>
      </Field>
      <Field label={`${label} model`} icon={Sparkles}>
        <div className="flex gap-2">
          {models.length ? (
            <select value={model} onChange={(e) => onModel(e.target.value)} className={inputCls}>
              {!models.includes(model) && <option value={model}>{model}</option>}
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <input value={model} onChange={(e) => onModel(e.target.value)} placeholder="model name" className={inputCls} />
          )}
          <button onClick={onLoad} disabled={loading} type="button" title="Load models from the API" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-navy-850 text-slate-300 hover:bg-white/10 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>
      </Field>
    </div>
  );
}
