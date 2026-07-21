const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let strokeHistory = [];
let activeUsers = 0; // Tracks live connections

io.on('connection', (socket) => {
    // Add to user count and update everyone
    activeUsers++;
    io.emit('userCount', activeUsers);
    console.log('A user grabbed a piece of chalk. Total:', activeUsers);

    socket.emit('init', strokeHistory);

    socket.on('draw', (data) => {
        strokeHistory.push(data);
        socket.broadcast.emit('draw', data);
    });

    socket.on('clear', () => {
        strokeHistory = [];
        io.emit('clear');
    });

    socket.on('disconnect', () => {
        // Drop user count and update everyone
        activeUsers--;
        io.emit('userCount', activeUsers);
        console.log('A user left the chalkboard. Total:', activeUsers);
    });
});

const TWENTY_FOUR_HOURS = 86400000;
setInterval(() => {
    strokeHistory = [];
    io.emit('clear');
    console.log('Daily chalkboard reset triggered.');
}, TWENTY_FOUR_HOURS);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Chalkboard live on http://localhost:${PORT}`);
});
