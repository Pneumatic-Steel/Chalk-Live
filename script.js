const socket = io({ transports: ['websocket'] });
const canvas = document.getElementById('chalkboard');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let drawing = false;
let localHistory = []; // Keeps a local copy for window resizing
let current = {
    color: 'rgba(255, 255, 255, 0.9)',
    size: 4
};

ctx.lineJoin = 'round';
ctx.lineCap = 'round';

document.querySelectorAll('.color-picker').forEach(picker => {
    picker.addEventListener('click', (e) => {
        current.color = e.currentTarget.getAttribute('data-color');
        current.size = parseInt(e.currentTarget.getAttribute('data-size'));
        
        document.querySelectorAll('.color-picker').forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');
    });
});

// Draws using mathematical fractions so it fits PC and Mobile equally
const drawLine = (x0, y0, x1, y1, color, size, emit) => {
    const w = canvas.width;
    const h = canvas.height;

    ctx.beginPath();
    ctx.moveTo(x0 * w, y0 * h);
    ctx.lineTo(x1 * w, y1 * h);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.stroke();
    ctx.closePath();

    if (!emit) return;
    
    const strokeData = { x0, y0, x1, y1, color, size };
    localHistory.push(strokeData);
    socket.emit('draw', strokeData);
};

const onPointerDown = (e) => {
    drawing = true;
    current.x = (e.clientX || e.touches[0].clientX) / canvas.width;
    current.y = (e.clientY || e.touches[0].clientY) / canvas.height;
};

const onPointerUp = (e) => {
    if (!drawing) return;
    drawing = false;
    const x = (e.clientX || e.changedTouches[0].clientX) / canvas.width;
    const y = (e.clientY || e.changedTouches[0].clientY) / canvas.height;
    drawLine(current.x, current.y, x, y, current.color, current.size, true);
};

const onPointerMove = (e) => {
    if (!drawing) return;
    const x = (e.clientX || e.touches[0].clientX) / canvas.width;
    const y = (e.clientY || e.touches[0].clientY) / canvas.height;
    drawLine(current.x, current.y, x, y, current.color, current.size, true);
    current.x = x;
    current.y = y;
};

canvas.addEventListener('mousedown', onPointerDown);
canvas.addEventListener('mouseup', onPointerUp);
canvas.addEventListener('mouseout', onPointerUp);
canvas.addEventListener('mousemove', onPointerMove);

canvas.addEventListener('touchstart', onPointerDown, { passive: false });
canvas.addEventListener('touchend', onPointerUp, { passive: false });
canvas.addEventListener('touchcancel', onPointerUp, { passive: false });
canvas.addEventListener('touchmove', onPointerMove, { passive: false });

socket.on('init', (history) => {
    localHistory = history;
    history.forEach(data => {
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, false);
    });
});

socket.on('draw', (data) => {
    localHistory.push(data);
    drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, false);
});

socket.on('clear', () => {
    localHistory = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Listens for the player count updates and changes the HTML number
const userCountDisplay = document.getElementById('user-count');
socket.on('userCount', (count) => {
    userCountDisplay.innerText = count;
});

// Perfect scaling if a phone rotates or a window is resized
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    localHistory.forEach(data => {
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, false);
    });
});
