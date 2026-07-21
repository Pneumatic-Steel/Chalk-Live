const socket = io({ transports: ['websocket'] });
const canvas = document.getElementById('chalkboard');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let drawing = false;
let localHistory = [];
let current = {
    color: 'rgba(255, 255, 255, 0.9)',
    size: 4,
    x: 0,
    y: 0
};

ctx.lineJoin = 'round';
ctx.lineCap = 'round';

// Handle tool selection (colors and eraser)
document.querySelectorAll('.color-picker').forEach(picker => {
    picker.addEventListener('click', (e) => {
        current.color = e.currentTarget.getAttribute('data-color');
        current.size = parseInt(e.currentTarget.getAttribute('data-size'));
        
        document.querySelectorAll('.color-picker').forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');
    });
});

// Calculates coordinates relative to the absolute center of the screen
const getCenterCoords = (e) => {
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    return {
        x: clientX - (window.innerWidth / 2),
        y: clientY - (window.innerHeight / 2)
    };
};

const drawLine = (x0, y0, x1, y1, color, size, emit) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    ctx.beginPath();
    // Add the screen's center point back to draw at the correct local pixel
    ctx.moveTo(x0 + cx, y0 + cy);
    ctx.lineTo(x1 + cx, y1 + cy);
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
    const coords = getCenterCoords(e);
    current.x = coords.x;
    current.y = coords.y;
};

const onPointerUp = (e) => {
    if (!drawing) return;
    drawing = false;
    const coords = getCenterCoords(e);
    drawLine(current.x, current.y, coords.x, coords.y, current.color, current.size, true);
};

const onPointerMove = (e) => {
    if (!drawing) return;
    const coords = getCenterCoords(e);
    drawLine(current.x, current.y, coords.x, coords.y, current.color, current.size, true);
    current.x = coords.x;
    current.y = coords.y;
};

canvas.addEventListener('mousedown', onPointerDown);
canvas.addEventListener('mouseup', onPointerUp);
canvas.addEventListener('mouseout', onPointerUp);
canvas.addEventListener('mousemove', onPointerMove);

// Mobile touch listeners
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
    
    // Redraw everything perfectly anchored to the new center
    localHistory.forEach(data => {
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, false);
    });
});
