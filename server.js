import http from 'http';
import { Server as socketIo } from 'socket.io';
import { Socket } from 'socket.io-client';

const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Servidor HTTP en funcionamiento\n');
});

const io = new socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
});


io.on("connection", (socket) => {
    console.log(`User conected: ${socket.id}`)

    socket.on("newGame", () =>{
        socket.broadcast.emit("newGame",)
    });
});


const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Servidor Socket.IO escuchando en el puerto ${PORT}`);
});

export default server;
