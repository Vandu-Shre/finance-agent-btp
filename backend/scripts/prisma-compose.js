/**
 * Assembles a full Prisma schema by combining a datasource file with base.prisma.
 * Usage: node scripts/prisma-compose.js [prod]
 * Output: prisma/schema.prisma (dev) or prisma/schema.prod.prisma (prod)
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = process.argv[2] === 'prod' ? 'prod' : 'dev';

const datasource = readFileSync(join(root, `prisma/datasource.${env}.prisma`), 'utf8');
const base = readFileSync(join(root, 'prisma/base.prisma'), 'utf8');
const outFile = join(root, env === 'prod' ? 'prisma/schema.prod.prisma' : 'prisma/schema.prisma');

writeFileSync(outFile, datasource.trimEnd() + '\n\n' + base);
console.log(`Composed ${outFile.replace(root + '/', '')}`);
