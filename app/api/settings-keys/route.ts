import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

// Store the chatbot API keys on the SERVER (.env.local) instead of the browser.
const ENV_PATH = path.join(process.cwd(), ".env.local");

function upsert(content: string, key: string, value: string): string {
  const re = new RegExp(`^[ \\t]*${key}=.*$`, "m");
  const line = `${key}=${value}`;
  if (re.test(content)) return content.replace(re, line);
  return (content && !content.endsWith("\n") ? content + "\n" : content) + line + "\n";
}

// Report which keys are configured server-side (booleans + model names only — never the key values).
export async function GET() {
  return NextResponse.json({
    gemini: !!process.env.GEMINI_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || "",
    groqModel: process.env.GROQ_MODEL || "",
  });
}

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const geminiKey = typeof body?.geminiKey === "string" ? body.geminiKey.trim() : "";
  const groqKey = typeof body?.groqKey === "string" ? body.groqKey.trim() : "";
  const geminiModel = typeof body?.geminiModel === "string" ? body.geminiModel.trim() : "";
  const groqModel = typeof body?.groqModel === "string" ? body.groqModel.trim() : "";

  // Apply immediately to the running server (no restart needed for this process).
  if (geminiKey) process.env.GEMINI_API_KEY = geminiKey;
  if (groqKey) process.env.GROQ_API_KEY = groqKey;
  if (geminiModel) process.env.GEMINI_MODEL = geminiModel;
  if (groqModel) process.env.GROQ_MODEL = groqModel;

  // Persist to .env.local so it survives restarts.
  try {
    let content = "";
    try { content = await fs.readFile(ENV_PATH, "utf8"); } catch {}
    if (geminiKey) content = upsert(content, "GEMINI_API_KEY", geminiKey);
    if (groqKey) content = upsert(content, "GROQ_API_KEY", groqKey);
    if (geminiModel) content = upsert(content, "GEMINI_MODEL", geminiModel);
    if (groqModel) content = upsert(content, "GROQ_MODEL", groqModel);
    await fs.writeFile(ENV_PATH, content, "utf8");
    return NextResponse.json({ ok: true, persisted: true, gemini: !!process.env.GEMINI_API_KEY, groq: !!process.env.GROQ_API_KEY });
  } catch {
    // e.g. read-only filesystem (serverless) — keys still applied to this process.
    return NextResponse.json({ ok: true, persisted: false, gemini: !!process.env.GEMINI_API_KEY, groq: !!process.env.GROQ_API_KEY,
      note: "Applied to the running server, but couldn't write .env.local (read-only filesystem). Add it manually to persist across restarts." });
  }
}
