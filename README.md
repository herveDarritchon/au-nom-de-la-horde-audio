# Migration audio « Au Nom de la Horde » (Foundry VTT)

Répertoire source exact : `assets/musics/ambient/{durotar,official}/` dans le dépôt principal.
Dépôt cible des GitHub Releases : `herveDarritchon/au-nom-de-la-horde-audio`.
Module Foundry audio : `au-nom-de-la-horde-audio`.

## Prérequis

Node.js 18+ ; `zip`, `unzip` ; GitHub CLI `gh` authentifié pour publier/restaurer.
Le dépôt cible doit posséder une branche avec au moins un commit (ex. README).
Sauvegarder tous les OGG hors Git avant de retirer Git LFS.

## Installer

Copier les trois scripts dans `tools/` du dépôt principal.
Ignorer le répertoire de sortie en ajoutant `/dist/audio-release/` au `.gitignore`.

## Vérifier, préparer, publier

```sh
node tools/releaseAudio.mjs --check
node tools/releaseAudio.mjs --version 1.0.0
node tools/releaseAudio.mjs --version 1.0.0 --publish
```

`--check` vérifie la présence de vrais OGG et détecte les pointeurs LFS.
Sans `--publish`, le script prépare et vérifie une archive localement ; il ne publie rien.
Pour une future version, utiliser par exemple `--version 1.0.1`.
L'archive de version stable s'appelle `au-nom-de-la-horde-audio.zip`.

## Références dans le code

```sh
node tools/auditMusicPaths.mjs --from ID_DU_MODULE_PRINCIPAL
node tools/auditMusicPaths.mjs --from ID_DU_MODULE_PRINCIPAL --write
```

`--from` peut être omis si `module.json` à la racine fournit l'ID source.
Relire le `git diff` après `--write`. Ce script ne convertit pas les bases de mondes Foundry ou les compendiums binaires.

## Installation des musiques sur une nouvelle machine

```sh
node tools/restoreAudio.mjs
# ou une version précise :
node tools/restoreAudio.mjs --version 1.0.0
```

La restauration télécharge la dernière archive publiée (ou la version demandée)
et extrait uniquement `assets/musics/ambient/`, sans toucher au `module.json` principal.
Elle refuse par défaut de remplacer des fichiers OGG existants ; `--overwrite` doit rester exceptionnel.

## Manifeste et dépendance Foundry

Dépendance à ajouter **sans écraser** les autres champs du `module.json` principal :

```json
{
  "id": "au-nom-de-la-horde-audio",
  "type": "module",
  "manifest": "https://github.com/herveDarritchon/au-nom-de-la-horde-audio/releases/latest/download/module.json"
}
```

Placer cet objet dans `relationships.requires` (tableau existant ou nouveau).
Les références des musiques doivent devenir :
`modules/au-nom-de-la-horde-audio/assets/musics/ambient/...`.
Tester l'installation dans un Foundry vierge et les playlists avant de retirer LFS.

## Débrancher Git LFS APRES validation

- Ignorer `/assets/musics/ambient/` dans le `.gitignore` du dépôt principal.
- Modifier `.gitattributes` pour retirer les règles LFS applicables aux musiques migrées.
- `git rm -r --cached -- assets/musics/ambient/` pour retirer les fichiers **de l'index uniquement**.
- Commiter `.gitattributes`, `.gitignore`, les changements de manifestes et les suppressions indexées.

Important : cela ne supprime PAS les anciens objets LFS déjà stockés côté GitHub.

## Droits de distribution

Les noms indiquent des pistes musicales originales de World of Warcraft.
Vérifier les droits de redistribution de ces enregistrements **avant de publier publiquement** l'archive.
