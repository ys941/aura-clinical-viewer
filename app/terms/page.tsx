import type { Metadata } from "next";
import { LegalShell } from "@/components/LegalShell";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: `Terms of Service — ${BRAND.name}` };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="18 June 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of {BRAND.name}
        (the &ldquo;Service&rdquo;), a browser-based medical-imaging viewer and AI decision-support tool.
        By using the Service you agree to these Terms. If you do not agree, do not use the Service.
      </p>

      <h2>1. What {BRAND.name} is — and is not</h2>
      <p>
        {BRAND.name} lets you open and review medical images in your browser and, optionally, generate an
        AI-assisted read of a study. <strong>{BRAND.name} is not a certified medical device</strong> and is
        not intended for primary diagnosis, treatment decisions, or any use that requires regulatory clearance.
        It is intended for research, education, and clinical-workflow support only.
      </p>

      <h2>2. Clinical responsibility</h2>
      <p>
        Any output — including AI-generated findings and impressions — is <strong>decision support only</strong>.
        It may be incomplete or incorrect and is derived from a limited, sampled subset of a study. A qualified,
        licensed clinician remains fully responsible for interpreting images and making all clinical decisions,
        and must independently verify any output against the complete study.
      </p>

      <h2>3. Acceptable use</h2>
      <ul>
        <li>Use the Service only for lawful purposes and in compliance with all applicable laws and regulations, including data-protection and health-information laws (e.g. HIPAA, GDPR) for any data you load.</li>
        <li>You are solely responsible for ensuring you have the right to load, view, and process any images or data you upload.</li>
        <li>Do not upload data you are not authorised to handle, and do not use the Service to attempt to re-identify anonymised data.</li>
        <li>Do not misuse, disrupt, reverse-engineer for malicious purposes, or attempt to gain unauthorised access to the Service or its infrastructure.</li>
      </ul>

      <h2>4. Accounts</h2>
      <p>
        Authentication is provided by Clerk. You are responsible for maintaining the confidentiality of your
        credentials and for all activity under your account. Notify the operator promptly of any unauthorised use.
      </p>

      <h2>5. AI models and third-party services</h2>
      <p>
        When you run an AI analysis, a small number of sampled, windowed images and basic study metadata are sent
        to the AI model endpoint <strong>you configure</strong> (for example, a MedGemma server you run on Google
        Colab, or Google&rsquo;s Gemini API). Your use of those services is subject to <strong>their</strong> terms
        and privacy policies. {BRAND.name} does not control, and is not responsible for, third-party services.
      </p>

      <h2>6. Intellectual property &amp; license</h2>
      <p>
        The {BRAND.name} source code is made available under the MIT License. These Terms do not grant you rights
        in third-party components, which are subject to their own licenses.
      </p>

      <h2>7. Disclaimer of warranties</h2>
      <p>
        The Service is provided <strong>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;</strong>, without
        warranties of any kind, express or implied, including merchantability, fitness for a particular purpose,
        accuracy, and non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or
        that any output is accurate or reliable.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, the authors, contributors, and operators of {BRAND.name} shall not
        be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss arising
        from clinical decisions, data loss, or use of (or inability to use) the Service or its AI output.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these Terms from time to time. Continued use of the Service after changes take effect
        constitutes acceptance of the revised Terms.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about these Terms can be directed to the operator of this {BRAND.name} deployment.
      </p>
    </LegalShell>
  );
}
