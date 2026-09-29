import { createServer } from 'vite';
import config from '../../electron.vite.config.ts';

// Exercise the real app and renderer configuration, with only the IPC boundary mocked.
const server = await createServer({
  ...config.renderer,
  root: 'src/renderer',
  configFile: false,
  server: { host: '127.0.0.1', port: 15175, strictPort: true },
});
await server.listen();
