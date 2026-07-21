const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// Keep track of all drawn lines so new/refreshed screens can load them
let strokeHistory = [];

io.on('connection', (socket) => {
    console.log('A user grabbed a piece of chalk.');

    // Send existing drawing history to the newly connected user
    socket.emit('init', strokeHistory);

    // Listen for drawing events, save them, and broadcast
    socket.on('draw', (data) => {
        strokeHistory.push(data);
        socket.broadcast.emit('draw', data);
    });

    // Clear history when cleared
    socket.on('clear', () => {
        strokeHistory = [];
        io.emit('clear');
    });

    socket.on('disconnect', () => {
        console.log('A user left the chalkboard.');
    });
});

// Auto-reset the board every 24 hours
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
