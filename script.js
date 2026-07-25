const socket = io({ transports: ['websocket'] });
const canvas = document.getElementById('chalkboard');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let drawing = false;
let localHistory = [];
let isErasing = false;
let current = {
    color: '#ffffff',
    size: 4,
    effect: 'none',
    x: 0,
    y: 0
};

ctx.lineJoin = 'round';
ctx.lineCap = 'round';

const colorPicker = document.getElementById('color-picker');
const brushSize = document.getElementById('brush-size');
const eraserBtn = document.getElementById('eraser-btn');
const effectPicker = document.getElementById('brush-effect');

// Intercept standard color picking to turn off effects
colorPicker.addEventListener('input', (e) => {
    isErasing = false;
    eraserBtn.classList.remove('active');
    current.color = e.target.value;
    current.effect = 'none';
    effectPicker.value = 'none';
});

brushSize.addEventListener('input', (e) => {
    current.size = parseInt(e.target.value);
});

// Listen for effect dropdown changes
effectPicker.addEventListener('change', (e) => {
    isErasing = false;
    eraserBtn.classList.remove('active');
    current.effect = e.target.value;
});

eraserBtn.addEventListener('click', () => {
    isErasing = true;
    eraserBtn.classList.add('active');
});

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

const drawLine = (x0, y0, x1, y1, color, size, effect, emit) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    ctx.beginPath();
    ctx.moveTo(x0 + cx, y0 + cy);
    ctx.lineTo(x1 + cx, y1 + cy);
    ctx.lineWidth = size;
    
    // Default resets for standard solid lines
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = color;

    // Apply the math magic if an effect is selected
    if (effect !== 'none' && color !== '#2a3631') {
        // Generates a fixed pseudo-random number based on the coordinates 
        // so it redraws perfectly identical during window resizing
        const seed = Math.abs(Math.sin(x0 + y0)) * 100;
        
        if (effect === 'rainbow') {
            const hue = (Math.abs(x0 + y0) / 2) % 360;
            ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
        } else if (effect === 'fire') {
            ctx.strokeStyle = seed > 50 ? '#ffaa00' : '#ff2200';
            ctx.shadowBlur = size * 2;
            ctx.shadowColor = '#ff0000';
        } else if (effect === 'mystic') {
            ctx.strokeStyle = seed > 50 ? '#00ffff' : '#ff00ff';
            ctx.shadowBlur = size * 2.5;
            ctx.shadowColor = '#8a2be2';
        } else if (effect === 'galaxy') {
            ctx.strokeStyle = seed > 92 ? '#ffffff' : '#4b0082';
            ctx.shadowBlur = size * 2;
            ctx.shadowColor = '#ff00ff';
        }
    }

    ctx.stroke();
    ctx.closePath();

    if (!emit) return;
    
    const strokeData = { x0, y0, x1, y1, color, size, effect };
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
    const activeColor = isErasing ? '#2a3631' : current.color;
    const activeEffect = isErasing ? 'none' : current.effect;
    drawLine(current.x, current.y, coords.x, coords.y, activeColor, current.size, activeEffect, true);
};

const onPointerMove = (e) => {
    if (!drawing) return;
    const coords = getCenterCoords(e);
    const activeColor = isErasing ? '#2a3631' : current.color;
    const activeEffect = isErasing ? 'none' : current.effect;
    drawLine(current.x, current.y, coords.x, coords.y, activeColor, current.size, activeEffect, true);
    current.x = coords.x;
    current.y = coords.y;
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
        // Fallback to 'none' for old lines that were saved before we added the effect code
        const eff = data.effect || 'none';
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, eff, false);
    });
});

socket.on('draw', (data) => {
    localHistory.push(data);
    const eff = data.effect || 'none';
    drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, eff, false);
});

socket.on('clear', () => {
    localHistory = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

const userCountDisplay = document.getElementById('user-count');
socket.on('userCount', (count) => {
    userCountDisplay.innerText = count;
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    localHistory.forEach(data => {
        const eff = data.effect || 'none';
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, eff, false);
    });
});
