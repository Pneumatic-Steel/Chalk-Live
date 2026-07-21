const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve all static files from this exact folder
app.use(express.static(__dirname));

io.on('connection', (socket) => {
    console.log('A user grabbed a piece of chalk.');

    // Listen for drawing events and broadcast to everyone else
    socket.on('draw', (data) => {
        socket.broadcast.emit('draw', data);
    });

    // Listen for clear signals and broadcast to everyone
    socket.on('clear', () => {
        io.emit('clear');
    });

    socket.on('disconnect', () => {
        console.log('A user left the chalkboard.');
    });
});

// Auto-reset the board every 24 hours (24 * 60 * 60 * 1000 ms)
const TWENTY_FOUR_HOURS = 86400000;
setInterval(() => {
    io.emit('clear');
    console.log('Daily chalkboard reset triggered.');
}, TWENTY_FOUR_HOURS);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Chalkboard live on http://localhost:${PORT}`);
});
