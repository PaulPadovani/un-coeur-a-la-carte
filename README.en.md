# Un cœur à la carte

**Documentation: [Français](README.md) · English**

**A congenital heart physiology simulator.** Assemble a heart from anatomical
cards, start the clock at birth, and watch the circulation reorganise. A normal
heart, ASD, VSD, transposition, coarctation and functionally univentricular
hearts all use the same physiological engine.

**Run online:**
[▶ Français](https://paulpadovani.github.io/un-coeur-a-la-carte/) ·
[▶ English](https://paulpadovani.github.io/un-coeur-a-la-carte/en/)

The simulator also runs fully offline: download the repository and double-click
`index.html` for French or `en/index.html` for English. There is no build step,
dependency or network requirement.

**Official repository:**
[github.com/PaulPadovani/un-coeur-a-la-carte](https://github.com/PaulPadovani/un-coeur-a-la-carte)

> **Medical disclaimer.** This is an educational tool. It is not a medical
> device, a validated predictive model, or an aid to diagnosis or therapeutic
> decision-making. Its parameters favour correct physiological directionality
> and conceptual clarity.

## How the bilingual version works

- `/` is the French GitHub Pages version.
- `/en/` is the English GitHub Pages version.
- Both pages share the same HTML/CSS/JavaScript physiological engine.
- `js/i18n.js` contains the English interface, intervention, classification
  and outcome terminology; no browser storage or local data fetching is used.

The language selector always switches between these two stable URLs. The French
and English interfaces therefore cannot drift into separate physiological
implementations.

## Physiological model

The engine translates the chosen anatomy into a graph, checks its connectivity,
solves blood flows, and then calculates oxygen saturations using mass balance.
It deliberately distinguishes two concepts:

1. **Common ventricular pressure** determines how flow is divided between Qp
   and Qs.
2. **Complete mixing** determines systemic and pulmonary saturations.

This distinction allows one engine to represent a VSD, an ASD, transposition
and functionally univentricular physiology without applying a single mixing
formula to every anatomy.

Pulmonary vascular resistance falls over the first week while ductal closure
evolves independently between H12 and H72. The transition graph shows the
observed trajectory as a solid line and a constant-settings projection as a
dashed line. It is a teaching model, not a patient-specific prediction.

## Repository contents

The public repository contains:

- the bilingual interface and neonatal physiological engine;
- four directional test scripts and the behavioural report generator;
- a concise, verified physiological bibliography in `REFERENCES.md`;
- licensing, citation and contribution files.

It does not include manuscripts, unpublished articles, submission material,
conference presentations, working bibliography files, scientific PDFs, Adobe
sources, or the historical Glenn/Fontan engine.

## Validation

Run the four directional checks from the repository root:

```text
node test.js
node test2.js
node test3.js
node test4.js
```

The verified behaviours include normal circulation, pulmonary and systemic
duct dependence, pulmonary overcirculation, atrial restriction, transposition
with inadequate mixing, and rejection of anatomically impossible outflow
assemblies.

## Licence and brand assets

The software is source-available under the
[PolyForm Noncommercial License 1.0.0](LICENSE). Non-commercial educational,
academic, scientific and healthcare use is allowed under its terms; commercial
use requires separate written permission from Paul Padovani.

`assets/logo.svg`, `assets/marque.svg`, `assets/serveur.png`, and the name and
visual identity “Un cœur à la carte” are excluded from the software licence.
No reuse rights are granted for those elements. See [NOTICE](NOTICE).

Copyright © 2026 Paul Padovani.
