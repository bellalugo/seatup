# Déploiement de SEATUP en ligne (Vercel)

Objectif : mettre l'application en ligne sur `seatup.asynconv.fr`, avec mises à jour
automatiques à chaque `git push`.

Hébergeur : **Vercel** (offre gratuite Hobby, aucune carte bancaire requise).
La base de données reste sur **Firebase Firestore** (inchangé).

---

## Étape 0 — Sécuriser les secrets (À FAIRE EN PREMIER)

Le fichier `.env` est suivi par git et contient une ancienne clé Google Gemini, inutilisée
par l'app. On la neutralise avant de publier le code.

```bash
cd C:\dev\app_SIT
git rm --cached .env          # arrête de suivre .env (le fichier reste sur ton disque)
git commit -m "Stop tracking .env (secrets)"
```

Puis **révoque la clé Gemini** dans Google AI Studio / Google Cloud (menu API Keys) : elle est
dans l'historique git et ne sert à rien. Tu peux aussi supprimer les lignes `GEMINI_API_KEY`
(`.env`) et `GOOGLE_GENAI_API_KEY` (`.env.local`) : l'app ne s'en sert pas.

> Les vrais secrets Billetweb sont dans `.env.local`, jamais versionné. Bon.
> Les clés `NEXT_PUBLIC_FIREBASE_*` sont publiques par nature : aucun souci.

---

## Étape 1 — Vérifier que l'app se construit

```bash
cd C:\dev\app_SIT
npm install
npm run build
```

Si `npm run build` se termine sans erreur, on peut déployer. (Vercel lance cette même commande
à chaque mise à jour : si elle échoue, le déploiement échoue.)

---

## Étape 2 — Mettre le code sur GitHub (dépôt PRIVÉ)

1. Crée un compte GitHub si besoin (gratuit), puis un **nouveau dépôt privé** nommé p. ex. `seatup`.
   Ne coche PAS « Add a README » (le projet existe déjà).
2. Relie ton dépôt local et pousse-le :

```bash
cd C:\dev\app_SIT
git remote add origin https://github.com/<ton-compte>/seatup.git
git push -u origin master
```

---

## Étape 3 — Importer le projet dans Vercel

1. Va sur **https://vercel.com** (PAS v0) et connecte-toi **avec GitHub** (offre Hobby, gratuite).
2. « Add New… » → « **Project** » → **Import** le dépôt `seatup`.
3. Vercel détecte tout seul que c'est du Next.js : ne touche pas aux réglages de build.
4. **Ne déploie pas encore** : ajoute d'abord les variables (étape 4).

---

## Étape 4 — Variables d'environnement dans Vercel

Dans l'écran d'import (section « Environment Variables »), ajoute ces variables en copiant les
valeurs depuis ton `.env.local`. (Astuce : Vercel accepte le copier-coller en masse au format
`NOM=valeur`.)

Publiques (config Firebase) :
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Billetweb :
- `BILLETWEB_USER`
- `BILLETWEB_KEY`
- `BILLETWEB_EVENT_ID`

> N'ajoute PAS `GOOGLE_GENAI_API_KEY` / `GEMINI_API_KEY` (inutiles).

Puis clique **Deploy**. Au bout de 1–2 min, l'app est en ligne sur une adresse
`https://seatup-xxxx.vercel.app`.

---

## Étape 5 — Adresse personnalisée : seatup.asynconv.fr

1. Dans le projet Vercel → **Settings** → **Domains** → ajoute `seatup.asynconv.fr`.
2. Vercel affiche un enregistrement DNS à créer (en général un `CNAME` vers `cname.vercel-dns.com`).
3. Va dans la zone DNS de `asynconv.fr` (chez ton registrar) et ajoute exactement
   l'enregistrement indiqué pour le sous-domaine `seatup`.
4. Attends la validation (quelques minutes à quelques heures). Le HTTPS est automatique.

---

## Étape 6 — Autoriser le domaine pour la connexion

Console Firebase → **Authentication** → **Settings** → **Authorized domains** → ajoute
`seatup.asynconv.fr` ET l'adresse `...vercel.app` du projet.
Sans ça, la connexion (email + n° de billet) serait bloquée sur ces domaines.

---

## Étape 7 — Lien SEATUP dans le menu WordPress

WordPress → Apparence → Menus → entrée **SEATUP** → URL `https://seatup.asynconv.fr`. Enregistre.

---

## Au quotidien : mettre à jour l'app en ligne

```bash
cd C:\dev\app_SIT
git add -A
git commit -m "Description de la modif"
git push
```

Vercel reconstruit et déploie automatiquement (1–2 min). C'est tout.

---

## Rappels

- Republier les **règles Firestore** si tu les modifies (console Firebase → Firestore → Règles).
- `BILLETWEB_EVENT_ID` : à mettre à jour (dans les variables Vercel) à chaque nouvelle édition.
- Ne jamais committer `.env.local` (déjà ignoré).
