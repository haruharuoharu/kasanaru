import {build} from 'esbuild';
await build({entryPoints:['src/wallet-entry.js'],outfile:'public/wallet.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof'});

import {copyFile} from 'node:fs/promises';
await copyFile('src/record.js','public/record.js');
