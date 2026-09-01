import http from 'http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server as socketIo } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, 'dist');

// URL del gateway inyectada en runtime (sin rebuild). Render Docker no pasa
// VITE_* al build, así que server.js embebe el valor en el HTML que sirve.
const gatewayUrl = (process.env.GATEWAY_URL || '').replace(/\/+$/, '');
const runtimeConfigScript = gatewayUrl
  ? `<script>window.__API_BASE_URL__ = ${JSON.stringify(gatewayUrl)};</script>`
  : `<!-- GATEWAY_URL no definido; el front usa fallback local -->`;

const contentTypes = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.ico': 'image/x-icon',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

function injectRuntimeConfig(html) {
    return html.replace('</head>', `${runtimeConfigScript}</head>`);
}

const server = http.createServer(async (req, res) => {
    if (!req.url || req.url.startsWith('/socket.io/')) {
        return;
    }

    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok\n');
        return;
    }

    const requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const requestedFile = requestPath === '/'
        ? path.join(distPath, 'index.html')
        : path.normalize(path.join(distPath, requestPath));

    if (!requestedFile.startsWith(distPath)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden\n');
        return;
    }

    try {
        const file = await readFile(requestedFile);
        const contentType = contentTypes[path.extname(requestedFile)] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        if (requestedFile.endsWith('index.html')) {
            const html = injectRuntimeConfig(file.toString());
            res.end(html);
        } else {
            res.end(file);
        }
    } catch {
        try {
            const index = await readFile(path.join(distPath, 'index.html'));
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(injectRuntimeConfig(index.toString()));
        } catch {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Servidor HTTP en funcionamiento\n');
        }
    }
});

const io = new socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
});


io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`)

    socket.on("joinGame", (gameId) => {
        if (typeof gameId !== 'string' || gameId.trim() === '') {
            return;
        }

        socket.join(`game:${gameId}`);
    });

    socket.on("leaveGame", (gameId) => {
        if (typeof gameId !== 'string' || gameId.trim() === '') {
            return;
        }

        socket.leave(`game:${gameId}`);
    });

    socket.on("gameUpdated", ({ gameId } = {}) => {
        if (typeof gameId !== 'string' || gameId.trim() === '') {
            return;
        }

        socket.to(`game:${gameId}`).emit("gameUpdated", { gameId });
    });

    socket.on("newGame", () =>{
        socket.broadcast.emit("newGame",)
    });
});


const PORT = Number(process.env.SOCKET_PORT || process.env.PORT || 3000);
const HOST = process.env.SOCKET_HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`Servidor Socket.IO escuchando en ${HOST}:${PORT}`);
});

export default server;
