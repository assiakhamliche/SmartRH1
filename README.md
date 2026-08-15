# Générateur de Contrats + Scanner CIN (OCR)

Application web en ligne : scan OCR des CIN marocaines (via Gemini) **et** génération des contrats, sur une seule interface. Déployable gratuitement sur Vercel.

## Contenu

```
public/index.html   → l'application (générateur + onglet Scanner CIN)
api/ocr.js          → fonction serverless qui appelle Gemini (clé cachée)
package.json
vercel.json
```

## Prérequis

1. Un compte **Vercel** (gratuit) : https://vercel.com
2. Une **clé API Gemini** (Google AI Studio) : https://aistudio.google.com/apikey

## Déploiement (méthode simple, sans ligne de commande)

1. Va sur https://vercel.com → **Add New… → Project**.
2. Choisis **« Deploy » depuis un dossier / drag & drop**, ou connecte un dépôt GitHub contenant ces fichiers.
   - Le plus simple : dépose ce dossier (avec `public/` et `api/`) tel quel.
3. Avant (ou juste après) le déploiement, va dans **Settings → Environment Variables** du projet et ajoute :
   - **Name** : `GEMINI_API_KEY`
   - **Value** : ta clé API Gemini
   - Environnements : Production (et Preview si tu veux)
4. Clique sur **Deploy**. Vercel te donne une URL du type `https://ton-projet.vercel.app`.
5. Partage cette URL à ton équipe : chacun l'ouvre dans son navigateur.

## Déploiement en ligne de commande (alternatif)

```bash
npm i -g vercel
cd cin-app
vercel                      # suit les questions, crée le projet
vercel env add GEMINI_API_KEY   # colle ta clé
vercel --prod               # déploie en production
```

## Utilisation

1. Ouvre l'URL de l'app.
2. **Scanner CIN** → dépose un PDF de CIN (recto+verso) → **Lancer l'extraction**.
   Les salariés extraits (nom, prénom, CIN, date de naissance, adresse) remplissent la liste.
3. Choisis la **Société** et le **Type de contrat**, complète le salaire (le **Simulateur** peut le calculer), **valide**, puis **Imprimer / Envoyer**.
4. L'**import Excel** classique reste disponible (Excel ▸ Importer une liste).

## Notes

- La clé Gemini n'est **jamais** exposée au navigateur : elle vit uniquement dans les variables d'environnement du serveur.
- Limite de taille d'un PDF par requête : ~4 Mo (limite Vercel). Pour de gros lots, découpe en plusieurs PDF.
- Les sociétés/modèles que chaque utilisateur ajoute/modifie sont stockés **dans son navigateur** (localStorage). Les modèles et sociétés livrés par défaut sont identiques pour tout le monde. Pour une configuration **partagée** entre tous (base de données centrale), c'est une évolution possible — me le demander.
- Modèles OCR essayés dans l'ordre : `gemini-2.0-flash`, puis `gemini-2.5-flash`, puis `gemini-1.5-flash`.
