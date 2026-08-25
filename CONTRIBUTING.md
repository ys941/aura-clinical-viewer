<div align="center">

# 🤝 Contributing to Aura

**One viewer for every scan.**<br>
A clinician shouldn't need one tool for a CT, another for a fundus photograph
and a third for a scanned report.

<sub>Bug reports · features · docs · tests · a clearer safety caveat — all of it counts</sub>

</div>

---

## ⚕️ Read this before anything else

**Aura is a research prototype, not a medical device.** It is not cleared or approved by
any regulator, and nothing it produces is a diagnosis. That places a duty on contributors
that most projects don't have.

> ### ⚠️ Never commit patient data
>
> No real studies, no screenshots containing patient details, no DICOM files with intact
> tags — not in an issue, a PR, a test fixture or a demo asset. Use anonymised or
> synthetic data. If you're unsure whether something is anonymised, assume it isn't.
>
> ### ⚠️ Never present AI output as a diagnosis
>
> The analysis is decision support and is frequently wrong. Any change that removes a
> caveat, upgrades hedged language into a confident claim, or makes a finding look
> authoritative will be declined.
>
> ### ⚠️ Don't quietly add storage
>
> Aura has **no database and no upload server** by design — a study is decoded in the
> browser, worked on, and gone when the tab closes. That property is the privacy model.
> A PR that persists study data anywhere changes what this software *is*, so raise it in
> a discussion first.
>
> ### ⚠️ When it doesn't know, it must say so
>
> With no model connected, the analysis says so plainly rather than inventing a finding.
> Keep that behaviour. A confident hallucination in a clinical tool is worse than an
> error message.

---

## 👋 Start here

Aura was built by one person — a medical laboratory technologist who learned to code —
mostly after midnight on a two-core laptop. Two things follow:

1. **There are rough edges.** Ask about them, or fix them.
2. **Your first pull request is welcome here.** Genuinely. Questions aren't an imposition.

Domain knowledge is as valuable as code here. If you're a radiographer, radiologist or
technologist who can say *"no clinician would ever want it to do that"* — that's a
contribution, and an issue saying exactly that is welcome.

---

## 🚀 Getting it running

You need **Node 18+**. No database, no paid accounts, no patient data.

```bash
git clone https://github.com/ys941/aura-clinical-viewer.git
cd aura-clinical-viewer
npm install

cp .env.example .env.local
npm run dev            # http://localhost:4477
```

One variable is required:

| Variable | What it's for |
|---|---|
| `ATTRIBUTION_ACK` | Set to `https://github.com/ys941` — the server won't start without it ([why](#-attribution)) |

Everything else is optional. Without a model connected the viewer, measurements, reports
and exports all work — you just won't get AI analysis, and the app will say so plainly.

> 💡 **Test data:** any public anonymised DICOM set works. Aura also opens ordinary PNGs,
> JPEGs and TIFFs, so you can exercise most of the UI with any image at all.

---

## 🧭 Where things live

```
app/                    the screens
components/
├─ viewer/Viewer.tsx    the workstation itself
└─ Footer.tsx           the credit
lib/
├─ loadStudy.ts         decoding a file, a ZIP, or a folder into ordered series
└─ attribution*.ts      the attribution gate
public/cornerstone/     vendored Cornerstone.js workers
```

Start with `lib/loadStudy.ts` — how an arbitrary dropped file becomes ordered series is
the heart of the product.

---

## 💡 Things worth doing

Nobody's working on these. No permission needed — just say so first so two people don't
do the same work twice.

| | Area | Why it matters |
|:--:|---|---|
| 🧪 | **Tests** | There is no test suite. Biggest gap and the easiest start — series sorting and metadata parsing are pure functions needing no images. |
| ♿ | **Accessibility** | Never audited for keyboard or screen-reader use. Clinical software especially shouldn't require a mouse. |
| 📐 | **Measurements** | More tools, better precision, and units that are always unambiguous. |
| 🗂️ | **Format coverage** | Odd DICOM variants, compressed transfer syntaxes, multi-frame edge cases. |
| ⚡ | **Large studies** | Loading a several-hundred-slice study could be faster and lighter on memory. |
| 📖 | **Docs** | A setup guide written by someone who just did the setup, including where they got stuck. |

---

## 🔀 Sending a pull request

```bash
git checkout -b fix/series-order-on-multiframe
# ... make the change ...
npm run build          # must pass
git commit -m "fix: sort multi-frame series by instance number, not filename"
git push origin fix/series-order-on-multiframe
```

What helps:

- **Say what changed and why.** One honest paragraph beats a formal template.
- **Keep it focused.** One idea per PR.
- **Screenshots for UI changes** — using synthetic or anonymised images only.
- **Say if you're unsure.** "I couldn't test this on a real CT" is useful information.

Reviews may take a few days — this is nobody's day job. A nudge after a week is fine.

---

## ⭐ Attribution

Aura is free to use, fork, self-host, rebrand and build a business on. There is one
condition, and it is deliberately small:

**Credit to the original author stays visible.**

- The app footer credits [@ys941](https://github.com/ys941). Everything around it is
  yours to change.
- The server runs two checks at start-up: `ATTRIBUTION_ACK="https://github.com/ys941"`
  must be set in your environment, **and** the footer must still contain the credit.
  Strip the credit and the app refuses to boot. Nothing is transmitted — both checks
  are local.

This is the project's **attribution requirement** (see [COPYRIGHT.md](COPYRIGHT.md)), so it applies whether or not the check is
present — deleting [`lib/attribution.server.ts`](lib/attribution.server.ts) does not
remove the obligation.

Full detail on what you may and may not do: [COPYRIGHT.md](COPYRIGHT.md).

---

## 🎨 Code style

No linter gate, no formatting police. Match the surrounding code. TypeScript is `strict`,
so `npm run build` will tell you most of what's wrong.

> ⚠️ **`lib/attribution.ts` must stay free of Node built-ins.** The footer is a client
> component and imports from it — a `node:fs` import there breaks the browser bundle,
> and only a production build will tell you.

---

## 🐛 Reporting bugs

Open an issue with whatever you have — what you expected, what happened, and anything
from the console.

> ⚠️ **Never attach a real patient study or an un-anonymised screenshot.**

## 🔐 Security issues

Please **don't** open a public issue. Email **ys9410017064@gmail.com** and give it a few
days before disclosing publicly. You'll be credited unless you'd rather not be.

Anything that could cause study data to leave the browser is in scope and taken
seriously.

---

## 📜 Licence

Contributions are made under the [MIT Licence](LICENSE),
the same as the project.

See [COPYRIGHT.md](COPYRIGHT.md) for exactly what you may and may not do — the short
version is "almost anything, just keep the credit".

---

<div align="center">

**Thank you for being here.** ⭐

<sub>⚕️ Not a medical device. Not for primary diagnosis. Always verified by a clinician.</sub>

</div>
