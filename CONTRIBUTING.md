# Contribuer à « Un cœur à la carte »

Les signalements, propositions et *pull requests* sont bienvenus pour améliorer
la justesse physiologique, la pédagogie, l'accessibilité et la robustesse du
simulateur.

## Avant de proposer une modification

1. Créer une branche dédiée.
2. Limiter la proposition à un problème clairement identifié.
3. Conserver le fonctionnement hors ligne, sans build ni dépendance.
4. Exécuter les quatre tests :

```text
node test.js
node test2.js
node test3.js
node test4.js
```

5. Expliquer l'effet attendu sur la physiologie ou l'interface.

## Règles du projet

- Scripts JavaScript classiques : pas de modules ES ni de `fetch()` local.
- Pas de `localStorage` ni de `sessionStorage`.
- Respecter `prefers-reduced-motion` et l'usage en projection.
- Ne jamais modifier `js/cartes.js` à la main : ce fichier est généré.
- Toute nouvelle référence médicale doit être réelle et vérifiable.
- Ne pas ajouter de données patients ou d'informations identifiantes.

## Licence des contributions

En soumettant une contribution, vous confirmez :

- être autorisé à la proposer ;
- accepter qu'elle soit distribuée sous la
  **PolyForm Noncommercial License 1.0.0** ;
- comprendre que les éléments de marque mentionnés dans `NOTICE` restent
  exclus de cette licence.

Les contributeurs conservent leurs droits d'auteur sur leurs contributions.
Cette règle permet d'accepter des *pull requests* sans transférer
automatiquement leur propriété à Paul Padovani.

## Portée médicale

Le simulateur est un outil pédagogique non validé pour la pratique clinique.
Une proposition ne doit pas le présenter comme un dispositif médical, un
modèle prédictif ou une aide à la décision thérapeutique.
