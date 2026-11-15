import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));

interface Rule {
  id: string;
  pattern: RegExp;
  correction: string;
}

const RULES: Rule[] = [
  {
    id: 'mSv',
    pattern: /\bmSv\b/i,
    correction: 'usar «u» (unidades didácticas) y «exposición», nunca dosis médicas',
  },
  {
    id: 'dosis',
    pattern: /\bdosis\b/i,
    correction: 'usar «exposición acumulada en u»',
  },
  {
    id: 'en vivo',
    pattern: /\ben vivo\b/i,
    correction: 'si es una copia guardada, decir «datos guardados del {fecha}»; no afirmar lectura en directo',
  },
  {
    id: 'NASA valida',
    pattern: /NASA\s+valida/i,
    correction: 'decir «fulguración registrada por NASA DONKI» sin afirmar validación de la misión',
  },
  {
    id: 'game.dose',
    pattern: /\b(?:game|state|mission)\s*\.\s*dose\b/i,
    correction: 'la exposición de misión es ms.exposure en u; no reutilizar la dosis del Modo libre',
  },
  {
    id: 'clave de dosis libre',
    pattern: /\bstormDose\b|\bstormReal\b/,
    correction: 'no reutilizar textos de dosis/tiempo real del Modo libre en la misión',
  },
];

interface Hit {
  file: string;
  line: number;
  text: string;
  rule: Rule;
}

const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html', '.json']);

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (match, prefix: string) => prefix + ' '.repeat(match.length - prefix.length));
}

function filesUnder(path: string): string[] {
  if (!existsSync(path)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else if (EXTENSIONS.has(extname(full))) out.push(full);
  }
  return out;
}

function audit(paths: string[]): Hit[] {
  const hits: Hit[] = [];
  for (const path of paths) {
    for (const file of filesUnder(path)) {
      const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
      for (const [index, line] of lines.entries()) {
        for (const rule of RULES) {
          if (rule.pattern.test(line)) {
            hits.push({ file: relative(ROOT, file), line: index + 1, text: line.trim(), rule });
          }
        }
      }
    }
  }
  return hits;
}

function report(hits: Hit[]): string {
  return hits
    .map((hit) => `${hit.file}:${hit.line} — «${hit.text}» — ${hit.rule.correction}`)
    .join('\n');
}

describe('auditoría de textos de misión', () => {
  it('el detector reconoce los términos prohibidos', () => {
    const sample = [
      'const a = "Dosis 0,5 mSv";',
      'const b = "La NASA valida la misión";',
      'const c = "tormenta en vivo";',
      'const d = "game.dose";',
      'const e = "stormDose";',
    ].join('\n');
    const found = RULES.filter((rule) => rule.pattern.test(sample)).map((rule) => rule.id);
    expect(found).toEqual(['mSv', 'dosis', 'en vivo', 'NASA valida', 'game.dose', 'clave de dosis libre']);
  });

  it('src/engine y src/ui/mission no contienen textos de dosis médica, tiempo real ni validación NASA', () => {
    const hits = audit([join(ROOT, 'src/engine'), join(ROOT, 'src/ui/mission')]);
    expect(hits, report(hits)).toEqual([]);
  });

  it('la UI de misión no referencia la dosis del Modo libre', () => {
    const hits = audit([join(ROOT, 'src/ui/mission')]).filter((hit) =>
      ['game.dose', 'clave de dosis libre'].includes(hit.rule.id),
    );
    expect(hits, report(hits)).toEqual([]);
  });
});
