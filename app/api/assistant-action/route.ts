import { NextResponse } from "next/server";
import { groqReasoningOpts, resolveGroqModel } from "@/lib/groqModels";

export const runtime = "nodejs";

// Gemini decides whether a message changes an app SETTING, and extracts the values.
const AGENT = `You are the settings agent for Aura, a medical-imaging web app. Read the user's message and decide if they want to change an app SETTING. If so, pick the action and extract ONLY the fields they mentioned. Otherwise answer normally.

Settings you can change:
- profile: firstName, lastName, role (one of: Radiologist, Cardiologist, Ophthalmologist, Pathologist, Clinician, Resident, Technologist, Administrator), organization
- letterhead (used on generated reports): clinicName, clinicAddress, doctorName, doctorCreds (qualifications / registration number)
- chat_model: provider ("medgemma", "gemini", or "groq"), geminiModel, groqModel

Viewer controls (the image viewer). Use action "viewer" with params {"command": <one below>, and extra fields as noted}:
- "window", value: soft | angio | lung | bone | brain   — OR custom: {"command":"window","ww":<number>,"wc":<number>}
- "brightness", value: up | down   (brighter / darker)
- "contrast", value: up | down     (more / less contrast)
- "wheel", value: zoom | scroll
- "tool", value: pan | zoom | magnify | length | angle | rectangle | ellipse | probe | annotate | freehand | windowlevel
- "zoom", value: in | out | fit | fill | actual   — OR {"command":"zoom","percent":<number>}
- "rotate"        (rotates 90°)
- "flip", value: horizontal | vertical
- "invert"        (toggle black/white)
- "overlays", value: on | off
- "panel", value: series | tags, and "show": on | off | toggle
- "fullscreen"
- "reset"         (reset view)
- "clear"         (clear annotations/measurements)
- "copy"          (copy current image)
- "cine", value: play | pause | toggle
- "fps", n: <number>
- "navigate", value: next | prev | first | last   — OR {"command":"navigate","slice":<number>}
- "series", value: next | prev   — OR {"command":"series","number":<number>}
- "pin", value: add | clear   (pin the current slice for focused AI, or clear all pins)
- "analyze", value: study | pinned
- "report"        (open the report)
- "upload"        (open the file picker to load a new study)

Report actions (the generated radiology report):
- action "report_edit", params {"section": findings|impression|recommendations|technique|history, "text": "<the exact text>", "mode": replace|append}
- action "report_download"   (download the report as HTML)
- action "report_print"      (print / save the report as PDF)

Respond with JSON ONLY, matching:
{"action":"set_profile"|"set_letterhead"|"set_chat_model"|"viewer"|"report_edit"|"report_download"|"report_print"|"answer","params":{ ...only the fields/command to change... },"reply":"<one short sentence confirming what you did, or your normal answer — in the SAME language the user wrote in>"}

If it is NOT a settings/viewer request, use "action":"answer" and put a normal, helpful reply in "reply". Never invent values the user didn't give.`;

const ROLES = ["Radiologist", "Cardiologist", "Ophthalmologist", "Pathologist", "Clinician", "Resident", "Technologist", "Administrator"];

async function agentJson(message: string, body: any): Promise<{ text?: string; error?: string }> {
  const reqProvider = String(body?.provider || "").toLowerCase();
  const geminiKey = (String(body?.geminiKey || "") || process.env.GEMINI_API_KEY || "").trim();
  const groqKey = (String(body?.groqKey || "") || process.env.GROQ_API_KEY || "").trim();
  // Use the selected provider if it has a key, otherwise whichever capable key exists.
  const use = (reqProvider === "gemini" && geminiKey) ? "gemini"
    : (reqProvider === "groq" && groqKey) ? "groq"
    : geminiKey ? "gemini" : groqKey ? "groq" : "";
  if (!use) return { error: "no-key" };

  if (use === "groq") {
    const model = resolveGroqModel(String(body?.groqModel || "") || process.env.GROQ_MODEL);
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` }, signal: AbortSignal.timeout(30000),
      body: JSON.stringify({ model, temperature: 0.1, ...groqReasoningOpts(model), response_format: { type: "json_object" }, messages: [{ role: "system", content: AGENT }, { role: "user", content: message }] }),
    });
    if (!r.ok) return { error: `Groq ${r.status}: ${(await r.text().catch(() => "")).slice(0, 120)}` };
    const d = await r.json();
    return { text: d?.choices?.[0]?.message?.content || "" };
  }
  const model = (String(body?.geminiModel || "") || process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${geminiKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ systemInstruction: { parts: [{ text: AGENT }] }, contents: [{ role: "user", parts: [{ text: message }] }], generationConfig: { temperature: 0.1, responseMimeType: "application/json" } }),
  });
  if (!r.ok) return { error: `Gemini ${r.status}: ${(await r.text().catch(() => "")).slice(0, 120)}` };
  const d = await r.json();
  return { text: (d?.candidates?.[0]?.content?.parts || []).map((p: any) => p?.text || "").join("").trim() };
}

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const message = String(body?.message || "").slice(0, 2000);
  if (!message) return NextResponse.json({ action: "answer", reply: "How can I help?" });

  try {
    const out = await agentJson(message, body);
    if (out.error === "no-key") return NextResponse.json({ action: "answer", noKey: true, reply: "To control the app by chat, add a Gemini or Groq key in Settings → AI Assistant." });
    if (out.error) return NextResponse.json({ action: "answer", reply: out.error });
    const text = (out.text || "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { return NextResponse.json({ action: "answer", reply: text || "Okay." }); }

    const action = ["set_profile", "set_letterhead", "set_chat_model", "viewer", "report_edit", "report_download", "report_print", "answer"].includes(parsed?.action) ? parsed.action : "answer";
    const p = parsed?.params && typeof parsed.params === "object" ? parsed.params : {};
    // whitelist + sanitize params per action
    const params: any = {};
    if (action === "set_profile") {
      for (const k of ["firstName", "lastName", "organization"]) if (typeof p[k] === "string" && p[k].trim()) params[k] = p[k].trim().slice(0, 80);
      if (typeof p.role === "string") { const m = ROLES.find((r) => r.toLowerCase() === p.role.trim().toLowerCase()); if (m) params.role = m; }
    } else if (action === "set_letterhead") {
      for (const k of ["clinicName", "clinicAddress", "doctorName", "doctorCreds"]) if (typeof p[k] === "string") params[k] = p[k].trim().slice(0, 160);
    } else if (action === "set_chat_model") {
      if (["gemini", "medgemma", "groq"].includes(p.provider)) params.provider = p.provider;
      if (typeof p.geminiModel === "string" && p.geminiModel.trim()) params.geminiModel = p.geminiModel.trim().slice(0, 60);
      if (typeof p.groqModel === "string" && p.groqModel.trim()) params.groqModel = p.groqModel.trim().slice(0, 60);
    } else if (action === "viewer") {
      const cmds = ["window", "brightness", "contrast", "wheel", "tool", "zoom", "rotate", "flip", "invert", "overlays", "panel", "fullscreen", "reset", "clear", "copy", "cine", "fps", "navigate", "series", "pin", "analyze", "report", "upload"];
      if (cmds.includes(p.command)) {
        params.command = p.command;
        if (typeof p.value === "string") params.value = p.value.trim().toLowerCase().slice(0, 20);
        if (typeof p.show === "string") params.show = p.show.trim().toLowerCase().slice(0, 10);
        for (const k of ["ww", "wc", "percent", "n", "slice", "number"]) { const v = Number(p[k]); if (Number.isFinite(v)) params[k] = v; }
      }
    } else if (action === "report_edit") {
      const sec = String(p.section || "").toLowerCase();
      params.section = /impress|diagnos|conclus|opinion/.test(sec) ? "impression" : /recommend|advice|advis/.test(sec) ? "recommendations" : /techni|protocol/.test(sec) ? "technique" : /hist|indicat|clinical/.test(sec) ? "history" : "findings";
      params.text = String(p.text || "").slice(0, 3000);
      params.mode = p.mode === "append" ? "append" : "replace";
    }
    const reply = typeof parsed?.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : "Done.";
    const needsParams = ["set_profile", "set_letterhead", "set_chat_model", "viewer", "report_edit"].includes(action);
    const finalAction = needsParams && !Object.keys(params).length ? "answer" : action;
    return NextResponse.json({ action: finalAction, params, reply });
  } catch (e: any) {
    return NextResponse.json({ action: "answer", reply: e?.name === "TimeoutError" ? "Gemini took too long — try again." : "Couldn't reach Gemini. Check your key and try again." });
  }
}
