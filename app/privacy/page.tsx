import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `Privacy Policy — ${BRAND.name}` };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="18 June 2026">
      <p>
        This Privacy Policy explains how {BRAND.name} handles data. {BRAND.name} is designed to be
        <strong> privacy-first</strong>: your medical images are processed <strong>entirely in your browser</strong>
        and are not uploaded to or stored on any {BRAND.name} server.
      </p>

      <h2>1. Imaging data (stays on your device)</h2>
      <ul>
        <li>DICOM files, images, and ZIP archives you open are decoded and rendered <strong>locally in your browser</strong>.</li>
        <li>{BRAND.name} has <strong>no backend database</strong>. Nothing you load is transmitted to or retained by {BRAND.name}.</li>
        <li>Your working session lives in browser memory only and is <strong>cleared when you refresh or close the tab</strong>.</li>
      </ul>

      <h2>2. AI analysis (only when you choose)</h2>
      <p>
        Images leave your browser <strong>only if you click the AI button</strong>. In that case, a small number of
        sampled, windowed montage images plus basic study metadata (e.g. modality, image count) are sent to the AI
        model endpoint <strong>you configure</strong> — for example a MedGemma server you run on Google Colab, or the
        Google Gemini API. That processing is governed by the third party&rsquo;s privacy policy. To protect privacy,
        we recommend anonymising studies before running AI analysis; identifiers are not deliberately included in what is sent.
      </p>

      <h2>3. Account data</h2>
      <p>
        Authentication is handled by <a href="https://clerk.com" target="_blank" rel="noopener noreferrer">Clerk</a>.
        When you sign up or sign in, Clerk processes your name, email address, and (optionally) a profile photo and
        role you provide. This data is stored with Clerk under their privacy policy, not in a {BRAND.name} database.
        You can view, edit, or delete your account information from the Settings page or your Clerk account.
      </p>

      <h2>4. Cookies &amp; tracking</h2>
      <p>
        {BRAND.name} does not use advertising or analytics trackers. The only cookies used are those required by
        Clerk to keep you securely signed in.
      </p>

      <h2>5. Third-party services</h2>
      <ul>
        <li><strong>Clerk</strong> — authentication and account management.</li>
        <li><strong>Your configured AI provider</strong> — e.g. a self-hosted MedGemma endpoint (Google Colab + Cloudflare tunnel) or Google&rsquo;s Gemini API, used only during AI analysis.</li>
      </ul>
      <p>Each third party processes data under its own terms and privacy policy.</p>

      <h2>6. Security</h2>
      <p>
        Data in transit is protected with TLS/HTTPS. Because imaging is processed locally and not stored on a server,
        the primary safeguard for your images is your own device and browser.
      </p>

      <h2>7. Protected health information (PHI)</h2>
      <p>
        If you load studies containing PHI, <strong>you are the data controller</strong> for that information and are
        responsible for handling it in compliance with applicable law (e.g. HIPAA, GDPR). {BRAND.name} does not store
        that PHI. Anonymise data before using AI analysis where possible.
      </p>

      <h2>8. Your rights</h2>
      <p>
        You may access, correct, or delete your account data at any time via Settings or your Clerk account. Because
        {BRAND.name} does not store your imaging, there is no server-side imaging data to request or delete.
      </p>

      <h2>9. Children</h2>
      <p>The Service is intended for professional and educational use and is not directed to children under 16.</p>

      <h2>10. Changes</h2>
      <p>We may update this Policy from time to time; material changes will be reflected by the &ldquo;last updated&rdquo; date above.</p>

      <h2>11. Contact</h2>
      <p>Questions about this Policy can be directed to the operator of this {BRAND.name} deployment.</p>
    </LegalShell>
  );
}
