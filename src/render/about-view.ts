// The About page's text (src/ui/about/AboutApp.tsx). Credits come from the NOTICE file itself, so
// the page and the file can't drift apart.

/** The software shipped inside the game, with its license; tests keep it matched to package.json. */
export const SHIPPED: readonly { name: string; what: string; license: string }[] = [
  { name: 'preact', what: 'Interface library', license: 'MIT' },
  { name: 'zod', what: 'Data validation', license: 'MIT' },
  { name: '@fontsource/ibm-plex-sans', what: 'IBM Plex Sans font', license: 'OFL-1.1' },
  { name: '@fontsource/jacquard-12', what: 'Jacquard 12 font', license: 'OFL-1.1' },
  { name: '@fontsource/vt323', what: 'VT323 font', license: 'OFL-1.1' },
];

/** NOTICE's paragraphs, after its title line, each joined onto one line. */
export function noticeParagraphs(notice: string): string[] {
  const blocks = notice
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.replace(/\s*\n\s*/g, ' ').trim())
    .filter((b) => b !== '');
  return blocks.slice(1);
}

/** What the player is told about keeping saves, from the browser's answer (null if unknown). */
export function storageNote(persisted: boolean | null): string {
  if (persisted === true)
    return 'This browser has agreed to keep your saves, even when the device runs low on space.';
  if (persisted === false)
    return 'This browser may clear your saves if the device runs low on space, or after weeks unused. Installing the game, or the button below, asks it to keep them.';
  return 'This browser does not say whether it will keep your saves.';
}
