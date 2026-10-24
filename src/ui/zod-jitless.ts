// Turns off zod's compiled parsers in the browser. They are built with `new Function`, which the
// Content Security Policy forbids (tools/csp.ts); zod would fall back on its own, but its probe
// still raises a policy violation. Each schema reads this setting as it is built, so this module is
// imported before anything that defines one. Tests and tools keep the faster compiled parsers.
import { z } from 'zod';

z.config({ jitless: true });
