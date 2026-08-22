# Copyright & Attribution

**Aura — Clinical Intelligence Platform**
Copyright © 2026 **Yati Bhardwaj** ([@ys941](https://github.com/ys941))

Licensed under the [MIT Licence with Attribution Requirement](LICENSE).

---

## The short version

**You may:** use it, run it, self-host it, fork it, modify it, use it commercially,
build a business on it, and re-skin it entirely as your own brand.

**You must:** keep the copyright notice, and keep the author credit visible. Both are
licence conditions, not requests.

**You may not:** claim you wrote it, or strip the attribution and pass it off as
original work.

That's the whole deal.

---

## ✅ What you are free to do

| | |
|---|---|
| 🏢 **Use it commercially** | Use it in your own product, charge for it, keep the money. No revenue share, no licence fee, no permission needed. |
| 🎨 **Re-brand it completely** | Change the name, colours, logo and copy. It can look entirely like yours. |
| 🔧 **Modify anything** | Fork it, rip parts out, bolt parts on. No obligation to contribute changes back (though pull requests are welcome). |
| 📦 **Redistribute it** | Ship it to clients, bundle it, host it for others. |
| 🔒 **Keep your changes private** | This is MIT, not GPL. Your fork does not have to be open source. |

---

## ⭐ What is required in return

### 1. Keep the copyright notice

The licence requires the notice in [`LICENSE`](LICENSE) to travel with the software.
Keep that file in any copy or substantial portion you distribute.

### 2. Keep the author credit visible

**This is clause 2 of the [licence](LICENSE), not a courtesy.** Any deployment other
people can see must display legible credit to the author:

> Built by Yati Bhardwaj — https://github.com/ys941

The dashboard footer does this for you out of the box. Everything *around* it is yours
to change — the app name above it follows your Brand settings — but the credit itself
must stay, and the link must keep working.

The server also declines to start unless **both** are true:

```bash
ATTRIBUTION_ACK="https://github.com/ys941"   # set in your environment
```

...and the footer still contains the credit. Removing it stops the app from booting.

Nothing is transmitted anywhere. No network call is made, no telemetry is collected,
no licence server is contacted. The value is compared to a string in
[`lib/attribution.ts`](lib/attribution.ts) and that is all.

> **A note on the check:** it is easy to delete, and you are free to modify this
> code. But clause 2 of the licence requires the visible credit regardless of whether
> the check is present — removing the check does not remove the obligation, it just
> means the software stops reminding you of it.

---

## ❌ What is not okay

- **Claiming authorship.** Don't present this as software you wrote.
- **Removing the copyright notice or the visible credit.** Both are licence violations,
  not just bad manners.
- **Re-uploading it as your own project** with the attribution stripped.
- **Implying endorsement.** Building on this doesn't mean the author endorses, supports
  or is responsible for what you build.

---

## 🌐 What this copyright does *not* cover

This notice and the MIT licence cover **the source code in this repository only**.

They grant no rights to, and carry no warranty regarding:

- **Third-party services and models** the software talks to — MedGemma, Google and any
  other provider you configure. Each remains subject to that provider's own terms and
  model licence, and you supply your own credentials.
- **The studies you open.** Aura decodes them in your browser and keeps nothing — there
  is no database and no upload server. What you load, and whether you are permitted to
  load it, is entirely your responsibility.
- **Anything the AI outputs.** It is decision support at best, and frequently wrong. You
  remain responsible for every clinical judgement made in the presence of this software.

See [NOTICE.md](NOTICE.md) for the full detail.

---

## 🩺 Not a medical device — read this properly

**Aura is a research and demonstration prototype.** It is **not** a certified medical
device, has not been cleared or approved by any regulator, and is **not** intended for
primary diagnosis or treatment decisions.

Any AI-generated output is **decision support only** and must be verified by a qualified
clinician. Nothing Aura produces is a diagnosis, a clinical recommendation, or a
substitute for professional judgement.

If you deploy this anywhere near real patients or real patient data, that is your
decision and your regulatory responsibility — including HIPAA, GDPR, the EU MDR, or
whatever applies where you are. The author provides no warranty and accepts no
liability, as the licence states in capital letters.

---

## 📬 Questions

Unsure whether your use is okay? Just ask — the answer is almost always yes.

**ys9410017064@gmail.com** · [github.com/ys941](https://github.com/ys941)

---

<sub>Built after hours by a medical laboratory technologist who learned to code.
If this saved you time, a star costs nothing. ⭐</sub>
