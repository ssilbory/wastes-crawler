import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { parseDoc, type MdDoc } from './markdown.ts';

export const ErratumSchema = z.object({
  /** Path relative to vendor/wwn-srd/. */
  file: z.string().min(1),
  /** Exact text in the mirror; must occur exactly once in the file. */
  find: z.string().min(1),
  replace: z.string(),
  /** Page index in the official WWN SRD PDF file (pdftoppm -f N) that has the correct text. */
  pdfPage: z.int().positive(),
  note: z.string().min(1),
});
export type Erratum = z.infer<typeof ErratumSchema>;

/** Reads vendored SRD files with errata patched in memory, leaving vendor/ untouched. */
export class SrdReader {
  private readonly used = new Set<Erratum>();

  constructor(
    readonly root: string,
    private readonly errata: Erratum[],
  ) {}

  doc(file: string): MdDoc {
    let text = readFileSync(join(this.root, file), 'utf8');
    for (const e of this.errata.filter((x) => x.file === file)) {
      const count = text.split(e.find).length - 1;
      if (count !== 1) {
        throw new Error(`erratum for ${file} matches ${count} times, expected 1: "${e.find}"`);
      }
      text = text.replace(e.find, () => e.replace);
      this.used.add(e);
    }
    return parseDoc(file, text);
  }

  /** Errata for files no extractor read; usually a renamed file or a stale entry. */
  unusedErrata(): Erratum[] {
    return this.errata.filter((e) => !this.used.has(e));
  }
}
