#!/usr/bin/env node
/**
 * Au Nom de la Horde — publication des musiques en asset GitHub Release.
 * Installation : placer ce fichier dans tools/releaseAudio.mjs du dépôt contenant les OGG.
 * Pré-requis : Node.js 18+, zip, unzip ; gh authentifié pour --publish.
 * Aucune suppression ou modification des sources. Aucun fichier audio n'est suivi
 * ni ajouté à Git par ce script.
 *
 * node tools/releaseAudio.mjs --check
 * node tools/releaseAudio.mjs --version 1.0.0
 * node tools/releaseAudio.mjs --version 1.0.0 --publish
 */
import { existsSync, createReadStream } from 'node:fs';
import { readdir, mkdir, readFile, stat, writeFile, open } from 'node:fs/promises';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_REL = 'assets/musics/ambient';
const AUDIO_DIR = join(ROOT, AUDIO_REL);
const REPO = 'herveDarritchon/au-nom-de-la-horde-audio';
const ID = 'au-nom-de-la-horde-audio';
const VERSION_DEFAULT = '1.0.0';
const MAX_GITHUB_ASSET = 2 * 1024 ** 3;

function die(message) { console.error(`ERREUR : ${message}`); process.exit(1); }
function run(program, args, opts = {}) {
  const result = spawnSync(program, args, { cwd: ROOT, encoding: 'utf8', ...opts });
  if (result.error) die(`${program} : ${result.error.message}`);
  if (result.status !== 0) {
    die(`${program} ${args.join(' ')} a échoué (code ${result.status}).\n${result.stderr || result.stdout || ''}`);
  }
  return (result.stdout || '').trim();
}
function hasProgram(program) {
  const r = spawnSync(program, ['--help'], { stdio: 'ignore' });
  return !r.error;
}
function parseOptions(argv) {
  let version = VERSION_DEFAULT; let publish = false; let check = false;
  for (let i=0; i<argv.length; i++) {
    switch (argv[i]) {
      case '--version': version = argv[++i]; break;
      case '--publish': publish = true; break;
      case '--check': check = true; break;
      case '--help':
        console.log('Usage: node tools/releaseAudio.mjs [--check] [--version X.Y.Z] [--publish]');
        process.exit(0);
      default: die(`Option inconnue : ${argv[i]}`);
    }
  }
  if (!version || !/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version))
    die('Version invalide (exemple : 1.0.0).');
  if (check && publish) die('Choisir --check OU --publish.');
  return { version, publish, check };
}
async function allOggFiles(dir) {
  const names = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const e of names) {
    const p = join(dir, e.name);
    if (e.isDirectory()) result.push(...await allOggFiles(p));
    else if (e.isFile() && e.name.toLowerCase().endsWith('.ogg')) result.push(p);
  }
  return result.sort();
}
async function validateOgg(file) {
  const fh = await open(file, 'r');
  try {
    const bytes = Buffer.alloc(120);
    const { bytesRead } = await fh.read(bytes, 0, bytes.length, 0);
    if (bytes.subarray(0, bytesRead).toString('utf8').startsWith('version https://git-lfs.github.com/spec/v1'))
      die(`POINTEUR LFS au lieu du vrai fichier : ${relative(ROOT, file)}. Exécuter git lfs pull.`);
    if (bytesRead < 4 || bytes.subarray(0, 4).toString('ascii') !== 'OggS')
      die(`Fichier invalide, signature OGG absente : ${relative(ROOT, file)}`);
  } finally { await fh.close(); }
}
function getManifest(version) {
  const base = `https://github.com/${REPO}/releases`;
  return {
    id: ID,
    title: 'Au Nom de la Horde — Audio',
    description: 'Bibliothèque musicale pour le module Au Nom de la Horde.',
    version,
    compatibility: { minimum: '14', verified: '14' },
    url: `https://github.com/${REPO}`,
    manifest: `${base}/latest/download/module.json`,
    download: `${base}/download/v${version}/${ID}.zip`,
  };
}

async function main() {
  const { version, publish, check } = parseOptions(process.argv.slice(2));
  if (!existsSync(AUDIO_DIR)) die(`Répertoire introuvable : ${AUDIO_DIR}`);
  const files = await allOggFiles(AUDIO_DIR);
  if (!files.length) die(`Aucun fichier .ogg trouvé sous ${AUDIO_REL}`);
  let totalBytes = 0;
  for (const f of files) {
    await validateOgg(f);
    totalBytes += (await stat(f)).size;
  }
  console.log(`Source        : ${AUDIO_REL}/`);
  console.log(`Fichiers OGG  : ${files.length}`);
  console.log(`Taille        : ${(totalBytes / 1024 ** 2).toFixed(1)} Mio`);
  console.log(`Publication   : ${REPO} — v${version}`);
  console.log('Chemins Foundry : modules/au-nom-de-la-horde-audio/assets/musics/ambient/...');
  if (check) { console.log('Contrôle OK. Aucune modification.'); return; }

  if (!hasProgram('zip') || !hasProgram('unzip')) die('zip et unzip doivent être installés.');
  const out = join(ROOT, 'dist', 'audio-release', `v${version}`);
  await mkdir(out, { recursive: true });
  const zipPath = join(out, `${ID}.zip`);
  const manifestPath = join(out, 'module.json');
  const reuseArchive = existsSync(zipPath);
  if (reuseArchive && !publish)
    die(`Archive déjà existante : ${zipPath} ; utiliser --publish pour publier l'archive validée, ou choisir une autre version.`);
  if (reuseArchive) {
    if (!existsSync(manifestPath)) die(`Manifeste manquant : ${manifestPath}`);
    let manifest;
    try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); }
    catch { die('Manifeste existant invalide.'); }
    const expectedManifest = getManifest(version);
    if (manifest.id !== ID || manifest.version !== version || manifest.download !== expectedManifest.download)
      die('Le manifeste existant ne correspond pas à la version ou au module attendus.');
    const archiveTime = (await stat(zipPath)).mtimeMs;
    for (const f of files) {
      if ((await stat(f)).mtimeMs > archiveTime + 1000)
        die(`Un OGG a été modifié depuis la génération du ZIP : ${relative(ROOT, f)}. Reconstruire l'archive avant publication.`);
    }
    console.log('Archive existante réutilisée après vérification (chemins, manifeste et dates de modification).');
  } else {
    await writeFile(manifestPath, JSON.stringify(getManifest(version), null, 2) + '\n');
    // Préserve exactement l'arborescence assets/musics/ambient/{durotar,official}/.
    run('zip', ['-q', '-X', '-0', zipPath, ...files.map(f => relative(ROOT, f))]);
    run('zip', ['-q', '-X', '-0', '-j', zipPath, manifestPath]);
  }
  const entries = run('unzip', ['-Z', '-1', zipPath]).split(/\r?\n/).filter(Boolean);
  if (entries.length !== files.length + 1 || !entries.includes('module.json'))
    die('Archive non conforme : nombre de fichiers / manifeste inattendu.');
  const expected = new Set(files.map(f => relative(ROOT, f).split(sep).join('/')));
  for (const entry of entries) {
    if (entry !== 'module.json' && !expected.has(entry)) die(`Entrée imprévue dans le ZIP : ${entry}`);
  }
  run('unzip', ['-tq', zipPath]);
  const archiveBytes = (await stat(zipPath)).size;
  if (archiveBytes >= MAX_GITHUB_ASSET)
    die('Archive >= 2 Gio : GitHub Releases refuse cet asset. Prévoir plusieurs archives/modules.');
  console.log(`Archive créée : ${zipPath}`);
  console.log(`Taille ZIP    : ${(archiveBytes / 1024 ** 2).toFixed(1)} Mio`);
  console.log(`Manifeste     : ${manifestPath}`);
  if (!publish) {
    console.log('Dry-run terminé : aucune release publiée. Ajouter --publish après vérification.');
    return;
  }
  if (!hasProgram('gh')) die('GitHub CLI (gh) introuvable.');
  run('gh', ['auth', 'status']);
  const existing = spawnSync('gh', ['release', 'view', `v${version}`, '--repo', REPO], { encoding: 'utf8' });
  if (existing.status === 0) die(`La release v${version} existe déjà : choisir une nouvelle version.`);
  console.log('Création de la GitHub Release…');
  run('gh', ['release', 'create', `v${version}`, manifestPath, zipPath,
    '--repo', REPO, '--title', `Au Nom de la Horde — Audio v${version}`,
    '--notes', 'Publication de la bibliothèque musicale du module Au Nom de la Horde.'],
    { stdio: 'inherit' });
  console.log(`Release publiée : https://github.com/${REPO}/releases/tag/v${version}`);
}
main().catch(e => die(e.message));
