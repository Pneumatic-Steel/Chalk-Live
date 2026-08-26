const socket = io({ transports: ['websocket'] });
const canvas = document.getElementById('chalkboard');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let drawing = false;
let localHistory = [];
let isErasing = false;
let isStamping = false; // New Emoji Mode tracker
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
const emojiInput = document.getElementById('emoji-input');

colorPicker.addEventListener('input', (e) => {
    isErasing = false;
    isStamping = false;
    eraserBtn.classList.remove('active');
    emojiBtn.classList.remove('active');
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
    current.effect = e.target.value;
});

eraserBtn.addEventListener('click', () => {
    isErasing = true;
    isStamping = false;
    eraserBtn.classList.add('active');
    emojiBtn.classList.remove('active');
});

// Activate Emoji Mode
emojiBtn.addEventListener('click', () => {
    isStamping = true;
    isErasing = false;
    emojiBtn.classList.add('active');
    eraserBtn.classList.remove('active');
});

// Auto-activate Emoji Mode if you click into the text box
emojiInput.addEventListener('focus', () => {
    isStamping = true;
    isErasing = false;
    emojiBtn.classList.add('active');
    eraserBtn.classList.remove('active');
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

// Packages and sends emoji sticker data
const recordStamp = (x, y, text, size, emit) => {
    const stampData = { type: 'emoji', x, y, text, size };
    if (emit) {
        localHistory.push(stampData);
        socket.emit('draw', stampData);
    }
};

const onPointerDown = (e) => {
    // If they click on the toolbar itself, don't draw or stamp
    if (e.target.closest('#toolbar')) return; 

    const coords = getCenterCoords(e);
    
    if (isStamping) {
        // Drop the sticker immediately on click!
        const emoji = emojiInput.value || '😀';
        recordStamp(coords.x, coords.y, emoji, current.size, true);
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
        // If the data packet is an emoji sticker
        if (data.type === 'emoji') {
            ctx.font = `${data.size * 10}px Arial`; // Multiplies the slider size to make it huge
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Emoji shadow for some depth
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            
            ctx.fillText(data.text, data.x + cx, data.y + cy);
            
            // Reset shadow so it doesn't bleed into lines
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        } 
        // If the data packet is a chalk line or old data from before the update
        else {
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
