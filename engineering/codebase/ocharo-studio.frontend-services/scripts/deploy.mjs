import { access, cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../apps/web/dist/', import.meta.url));
const target = fileURLToPath(new URL('../../ocharo-studio.backend-services/OcharoStudio.Api/wwwroot/', import.meta.url));
await access(new URL('../apps/web/dist/index.html', import.meta.url));
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
console.log('Copied verified Studio SPA build into the API host.');
