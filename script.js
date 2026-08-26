const socket = io({ transports: ['websocket'] });
const canvas = document.getElementById('chalkboard');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let drawing = false;
let localHistory = [];
let isErasing = false;
let isStamping = false; 
let currentEmojiText = '😀'; // Default equip
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
const clearBtn = document.getElementById('clear-btn');
const emojiBtn = document.getElementById('emoji-btn');
const emojiLibrary = document.getElementById('emoji-library');
const emojis = emojiLibrary.querySelectorAll('span');

// Color picker logic resets stamping
colorPicker.addEventListener('input', (e) => {
    isErasing = false;
    isStamping = false;
    eraserBtn.classList.remove('active');
    emojiBtn.classList.remove('active');
    emojiLibrary.classList.remove('show'); // Hide menu
    current.color = e.target.value;
    current.effect = 'none';
    effectPicker.value = 'none';
});

brushSize.addEventListener('input', (e) => {
    current.size = parseInt(e.target.value);
});

effectPicker.addEventListener('change', (e) => {
    isErasing = false;
    isStamping = false;
    eraserBtn.classList.remove('active');
    emojiBtn.classList.remove('active');
    emojiLibrary.classList.remove('show');
    current.effect = e.target.value;
});

eraserBtn.addEventListener('click', () => {
    isErasing = true;
    isStamping = false;
    eraserBtn.classList.add('active');
    emojiBtn.classList.remove('active');
    emojiLibrary.classList.remove('show');
});

// Toggles the new Emoji Library Menu
emojiBtn.addEventListener('click', () => {
    emojiLibrary.classList.toggle('show');
    if (emojiLibrary.classList.contains('show')) {
        isStamping = true;
        isErasing = false;
        emojiBtn.classList.add('active');
        eraserBtn.classList.remove('active');
    }
});

// Logic for clicking an emoji inside the menu
emojis.forEach(emojiSpan => {
    emojiSpan.addEventListener('click', (e) => {
        // Remove highlight from all, add to the one clicked
        emojis.forEach(span => span.classList.remove('selected'));
        e.target.classList.add('selected');
        
        // Equip the clicked emoji
        currentEmojiText = e.target.innerText;
        emojiBtn.innerText = currentEmojiText; // Updates the main button icon
        emojiLibrary.classList.remove('show'); // Auto-close menu after picking
    });
});

clearBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to wipe the board for everyone?")) {
        socket.emit('clear');
    }
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

const recordLine = (x0, y0, x1, y1, color, size, effect, emit) => {
    const strokeData = { type: 'line', x0, y0, x1, y1, color, size, effect };
    if (emit) {
        localHistory.push(strokeData);
        socket.emit('draw', strokeData);
    }
};

const recordStamp = (x, y, text, size, emit) => {
    const stampData = { type: 'emoji', x, y, text, size };
    if (emit) {
        localHistory.push(stampData);
        socket.emit('draw', stampData);
    }
};

const onPointerDown = (e) => {
    if (e.target.closest('#toolbar')) return; 

    // Auto-close the emoji menu if they click the canvas
    emojiLibrary.classList.remove('show');

    const coords = getCenterCoords(e);
    
    if (isStamping) {
        // Plop down the currently equipped emoji from the library
        recordStamp(coords.x, coords.y, currentEmojiText, current.size, true);
    } else {
        drawing = true;
        current.x = coords.x;
        current.y = coords.y;
    }
};

const onPointerUp = (e) => {
    if (!drawing || isStamping) return;
    drawing = false;
    const coords = getCenterCoords(e);
    const activeColor = isErasing ? '#2a3631' : current.color;
    const activeEffect = isErasing ? 'none' : current.effect;
    recordLine(current.x, current.y, coords.x, coords.y, activeColor, current.size, activeEffect, true);
};

const onPointerMove = (e) => {
    if (!drawing || isStamping) return;
    const coords = getCenterCoords(e);
    const activeColor = isErasing ? '#2a3631' : current.color;
    const activeEffect = isErasing ? 'none' : current.effect;
    recordLine(current.x, current.y, coords.x, coords.y, activeColor, current.size, activeEffect, true);
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
});

socket.on('draw', (data) => {
    localHistory.push(data);
});

socket.on('clear', () => {
    localHistory = []; 
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
});

let time = 0;

function renderCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    time += 1; 
    
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    localHistory.forEach(data => {
        if (data.type === 'emoji') {
            ctx.font = `${data.size * 10}px Arial`; 
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            
            ctx.fillText(data.text, data.x + cx, data.y + cy);
            
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        } else {
            const effect = data.effect || 'none';
            
            ctx.beginPath();
            ctx.moveTo(data.x0 + cx, data.y0 + cy);
            ctx.lineTo(data.x1 + cx, data.y1 + cy);
            ctx.lineWidth = data.size;
            
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = data.color;

            if (effect !== 'none' && data.color !== '#2a3631') {
                const pos = data.x0 + data.y0;
                
                if (effect === 'rainbow') {
                    const hue = (Math.abs(pos / 2) - (time * 5)) % 360; 
                    ctx.strokeStyle = `hsl(${hue < 0 ? hue + 360 : hue}, 100%, 60%)`;
                } else if (effect === 'fire') {
                    const flicker = Math.abs(Math.sin((pos * 0.05) - (time * 0.2))) * 100;
                    ctx.strokeStyle = flicker > 50 ? '#ffaa00' : '#ff2200';
                    ctx.shadowBlur = data.size * 2;
                    ctx.shadowColor = '#ff0000';
                } else if (effect === 'mystic') {
                    const pulse = Math.abs(Math.cos((pos * 0.02) + (time * 0.1))) * 100;
                    ctx.strokeStyle = pulse > 50 ? '#00ffff' : '#ff00ff';
                    ctx.shadowBlur = data.size * 2.5;
                    ctx.shadowColor = '#8a2be2';
                } else if (effect === 'galaxy') {
                    const twinkle = Math.abs(Math.sin((data.x0 * data.y0) * 0.005 + (time * 0.3))) * 100;
                    ctx.strokeStyle = twinkle > 90 ? '#ffffff' : '#4b0082';
                    ctx.shadowBlur = twinkle > 90 ? data.size * 2 : 0;
                    ctx.shadowColor = '#ff00ff';
                }
            }

            ctx.stroke();
            ctx.closePath();
        }
    });

    requestAnimationFrame(renderCanvas);
}

renderCanvas();
