#!/usr/bin/env node
/**
 * Pull the base CSS and JS straight out of references/recipes.md into test/_generated/.
 *
 * The point is to test the recipe, not a transcription of it. If the block in the docs
 * stops working, this test fails — which is the only way a recipe stays honest as the
 * docs change.
 *
 *   node test/extract.mjs
 *   node scripts/verify.mjs http://localhost:8080/test/states.html
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const doc = readFileSync(join(here, '..', 'references', 'recipes.md'), 'utf8');

const section = (heading) => {
  const at = doc.indexOf(heading);
  if (at < 0) throw new Error(`missing section: ${heading}`);
  return doc.slice(at);
};

const block = (text, lang) => {
  const m = text.match(new RegExp('```' + lang + '\\n([\\s\\S]*?)\\n```'));
  if (!m) throw new Error(`missing ${lang} block`);
  return m[1];
};

const base = section('## Base');
const label = section('## `state-label`');

const files = {
  'cursor.css': block(base, 'css'),
  'cursor.js': block(base, 'js'),
  'label.css': block(label, 'css'),
};

mkdirSync(join(here, '_generated'), { recursive: true });
for (const [name, body] of Object.entries(files)) {
  writeFileSync(join(here, '_generated', name), body + '\n');
  console.log(`${name.padEnd(12)} ${body.split('\n').length} lines`);
}
