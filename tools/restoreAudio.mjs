#!/usr/bin/env node
/**
 * Reconstitue assets/musics/ambient depuis la GitHub Release audio.
 * À placer dans tools/restoreAudio.mjs du dépôt principal.
 * Pré-requis : GitHub CLI (gh) et unzip.
 *
 * node tools/restoreAudio.mjs
 * node tools/restoreAudio.mjs --version 1.0.0
 * node tools/restoreAudio.mjs --overwrite  # remplace les fichiers locaux (attention)
 *
 * Ne décompresse PAS le module.json du module audio à la racine du projet !
 */
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'herveDarritchon/au-nom-de-la-horde-audio';
const FILENAME = 'au-nom-de-la-horde-audio.zip';
const AUDIO = join(ROOT, 'assets/musics/ambient');
function die(message) { console.error(`ERREUR : ${message}`); process.exitCode = 1; }
function run(program, args) {
  const r = spawnSync(program, args, { cwd: ROOT, encoding: 'utf8' });
  if (r.error || r.status !== 0) throw new Error(`${program} : ${r.error?.message || r.stderr || r.stdout}`);
  return r.stdout;
}
async function hasOgg(dir) {
  if (!existsSync(dir)) return false;
  for (const d of await readdir(dir, { withFileTypes: true })) {
    if (d.isFile() && d.name.toLowerCase().endsWith('.ogg')) return true;
    if (d.isDirectory() && await hasOgg(join(dir, d.name))) return true;
  }
  return false;
}
async function main() {
  const args = process.argv.slice(2);
  let version = null, overwrite = false;
  for (let i=0; i<args.length; i++) {
    if (args[i] === '--version') version = args[++i];
    else if (args[i] === '--overwrite') overwrite = true;
    else throw new Error(`Argument inconnu : ${args[i]}`);
  }
  if (version && !/^v?\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version))
    throw new Error('Version invalide. Exemple : 1.0.0');
  if (!overwrite && await hasOgg(AUDIO)) throw new Error('Des OGG existent déjà. Aucun fichier modifié. Utiliser --overwrite après sauvegarde si nécessaire.');
  const temp = await mkdtemp(join(tmpdir(), 'anlh-audio-'));
  try {
    const tag = version ? [`v${version.replace(/^v/, '')}`] : [];
    run('gh', ['release', 'download', ...tag, '--repo', REPO, '--pattern', FILENAME, '--dir', temp]);
    const zipPath = join(temp, FILENAME);
    if (!existsSync(zipPath)) throw new Error(`Archive introuvable : ${zipPath}`);
    // Extraire UNIQUEMENT les musiques, pas module.json (risque d'écraser le manifeste principal).
    run('unzip', [overwrite ? '-oq' : '-nq', zipPath, 'assets/musics/ambient/*', '-d', ROOT]);
    console.log(`Musiques restaurées sous ${AUDIO}`);
    console.log('Le module.json du dépôt principal n’a pas été modifié.');
  } finally { await rm(temp, {recursive:true, force:true}); }
}
main().catch(die);
