import { rolldown } from '../../frontend/node_modules/rolldown/dist/index.mjs';
import { fileURLToPath } from 'node:url';
const input=fileURLToPath(new URL('../mascot/entry.ts',import.meta.url));
const file=fileURLToPath(new URL('../ui/mascot.js',import.meta.url));
const bundle=await rolldown({input});
await bundle.write({file,format:'iife',minify:true,
  banner:'/*! Tickety animated aircraft. Local SVG renderer. */'});
await bundle.close();
console.log('Built Tickety animated plane: ui/mascot.js');
