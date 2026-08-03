# Un cœur à la carte

**Documentation: [Français](README.md) · English**

An interactive congenital heart pathophysiology simulator focused on neonatal
transition and functionally univentricular circulations.

[Open the simulator in English](https://paulpadovani.github.io/un-coeur-a-la-carte/en/)
·
[Ouvrir le simulateur en français](https://paulpadovani.github.io/un-coeur-a-la-carte/)

> **Medical disclaimer**
>
> This software is an educational tool. It is not a medical device, a
> validated predictive model, or an aid to diagnosis or therapeutic
> decision-making. It must not be used for patient care.

## Overview

“Un cœur à la carte” lets users assemble an anatomy from cards, start the
circulation at birth, and observe its evolution throughout the first week of
life. The same engine represents normal circulation, atrial and ventricular
septal defects, transposition of the great arteries, pulmonary or systemic
outflow obstruction, and several single-ventricle configurations.

The simulator connects anatomy, blood flow, and oxygenation. It displays in
real time:

- arterial and venous oxygen saturation;
- the pulmonary-to-systemic flow ratio (Qp/Qs);
- systemic oxygen delivery and physiological reserve;
- ductal closure and the fall in pulmonary vascular resistance;
- the observed circulatory trajectory and a constant-settings projection;
- the effects of seven medical or surgical interventions.

Animated flow provides a qualitative representation of flow direction and
distribution. It is not a computational fluid dynamics simulation.

## Getting started

### Online

- [English interface](https://paulpadovani.github.io/un-coeur-a-la-carte/en/)
- [Interface française](https://paulpadovani.github.io/un-coeur-a-la-carte/)

### Offline

1. Download or clone the repository.
2. Open `en/index.html` for English or `index.html` for French.

No installation, build step, dependency, or network connection is required.
Both interfaces use the same physiological engine written in plain HTML, CSS,
and JavaScript.

## Physiological model

The engine translates the selected anatomy into a circulatory graph, checks
pathway connectivity, solves blood flows, and then calculates oxygen
saturations by mass balance.

Two mechanisms are handled separately:

1. **common ventricular pressure**, which determines how flow is divided
   between Qp and Qs;
2. **complete mixing**, which determines systemic and pulmonary saturations.

This distinction allows one engine to represent separated circulations,
intracardiac shunts, ventriculoarterial discordance, and functionally
univentricular circulations.

During neonatal transition, pulmonary vascular resistance falls while ductal
closure evolves independently. Parameters are calibrated to preserve correct
physiological directionality and educational coherence; they are not intended
to produce individual predictions.

The main scientific foundations are documented in
[`REFERENCES.md`](REFERENCES.md).

## Behavioural validation

Four scripts check the essential directional behaviours:

```text
node test.js
node test2.js
node test3.js
node test4.js
```

They cover normal circulation, pulmonary and systemic duct dependence,
pulmonary overcirculation, atrial restriction, transposition with inadequate
mixing, and rejection of anatomically impossible outflow assemblies.

The behavioural report contains a matrix of 190 simulations — 19 anatomies
and 10 intervention strategies — together with their evolution over seven
days:

- view [`rapport-moteur.html`](rapport-moteur.html);
- regenerate it with `node rapport.js`.

These checks assess the model's internal consistency and directional
behaviour. They do not constitute clinical validation.

## Repository structure

| Component | Purpose |
|---|---|
| `index.html`, `en/index.html` | French and English interfaces |
| `css/vu.css` | Layout, projection, and visual accessibility |
| `js/anatomie.js` | Anatomy catalogue, resistances, and circulatory graph |
| `js/model.js` | Flow, saturation, and classification calculations |
| `js/vitals.js` | Clock, ductus arteriosus, physiological reserve, and events |
| `js/render.js` | Assembly, rendering, and flow visualisation |
| `js/transition.js` | Neonatal transition graph |
| `js/i18n.js` | English interface terminology |
| `js/main.js` | Interface coordination |
| `test*.js`, `rapport.js` | Directional checks and behavioural report |

## Scope and limitations

- The model covers the neonatal period from birth to day 7.
- Vascular and anatomical resistances are expressed in relative rather than
  clinical units.
- Glenn and Fontan circulations are not modelled.
- Anomalous pulmonary venous return, heterotaxy, and atrioventricular valve
  regurgitation are not represented.
- Flow paths are visual cues, not calculated velocity fields.

## Contributing and citation

Contributions addressing physiological accuracy, educational value,
accessibility, or robustness are welcome. Technical requirements and the
contribution process are described in [`CONTRIBUTING.md`](CONTRIBUTING.md).

Citation metadata is available in [`CITATION.cff`](CITATION.cff). GitHub also
provides export options through **Cite this repository**.

## Licence and brand identity

The software is made available under the
[PolyForm Noncommercial License 1.0.0](LICENSE). It is **source-available**,
not open source as defined by the Open Source Initiative. Commercial use
requires separate written permission from Paul Padovani.

The files `assets/logo.svg`, `assets/marque.svg`, and `assets/serveur.png`, as
well as the “Un cœur à la carte” name and visual identity, are excluded from
the software licence. No reuse rights are granted for these elements. See
[`NOTICE`](NOTICE) for the full scope.

Copyright © 2026 Paul Padovani.
