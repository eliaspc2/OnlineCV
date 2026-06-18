import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(function (_a) {
    var command = _a.command;
    return ({
        plugins: [react()],
        base: command === 'build' ? './' : '/',
        server: {
            host: '127.0.0.1',
            port: 5173,
            strictPort: true,
            hmr: {
                protocol: 'ws',
                host: '127.0.0.1',
                clientPort: 5173
            }
        }
    });
});
