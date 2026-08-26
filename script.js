const socket = io({ transports: ['websocket'] });
const canvas = document.getElementById('chalkboard');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let drawing = false;
let localHistory = [];
let isErasing = false;
let isStamping = false; 
let currentEmojiText = '😀'; 

let activeSticker = null; 
let interactionMode = 'none'; 

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
const bgColorPicker = document.getElementById('bg-color-picker'); // The new UI element
const brushSize = document.getElementById('brush-size');
const eraserBtn = document.getElementById('eraser-btn');
const effectPicker = document.getElementById('brush-effect');
const clearBtn = document.getElementById('clear-btn');
const emojiBtn = document.getElementById('emoji-btn');
const emojiLibrary = document.getElementById('emoji-library');
const emojis = emojiLibrary.querySelectorAll('span');

function finalizeSticker() {
    if (activeSticker) {
        recordStamp(activeSticker.x, activeSticker.y, activeSticker.text, activeSticker.size, activeSticker.angle, true);
        activeSticker = null;
        interactionMode = 'none';
    }
}

// Background Color Logic
bgColorPicker.addEventListener('input', (e) => {
    finalizeSticker();
    const newBgColor = e.target.value;
    document.body.style.backgroundColor = newBgColor; // Update locally instantly
    
    // Package it and blast it to the server
    const bgData = { type: 'bg', color: newBgColor };
    localHistory.push(bgData);
    socket.emit('draw', bgData);
});

colorPicker.addEventListener('input', (e) => {
    finalizeSticker();
    isErasing = false;
    isStamping = false;
    eraserBtn.classList.remove('active');
    emojiBtn.classList.remove('active');
    emojiLibrary.classList.remove('show'); 
    current.color = e.target.value;
    current.effect = 'none';
    effectPicker.value = 'none';
});

brushSize.addEventListener('input', (e) => {
    current.size = parseInt(e.target.value);
});

effectPicker.addEventListener('change', (e) => {
    finalizeSticker();
    isErasing = false;
    isStamping = false;
    eraserBtn.classList.remove('active');
    emojiBtn.classList.remove('active');
    emojiLibrary.classList.remove('show');
    current.effect = e.target.value;
});

eraserBtn.addEventListener('click', () => {
    finalizeSticker();
    isErasing = true;
    isStamping = false;
    eraserBtn.classList.add('active');
    emojiBtn.classList.remove('active');
    emojiLibrary.classList.remove('show');
});

emojiBtn.addEventListener('click', () => {
    finalizeSticker();
    emojiLibrary.classList.toggle('show');
    if (emojiLibrary.classList.contains('show')) {
        isStamping = true;
        isErasing = false;
        emojiBtn.classList.add('active');
        eraserBtn.classList.remove('active');
    }
});

emojis.forEach(emojiSpan => {
    emojiSpan.addEventListener('click', (e) => {
        emojis.forEach(span => span.classList.remove('selected'));
        e.target.classList.add('selected');
        
        currentEmojiText = e.target.innerText;
        emojiBtn.innerText = currentEmojiText; 
        emojiLibrary.classList.remove('show'); 
    });
});

clearBtn.addEventListener('click', () => {
    finalizeSticker();
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

const recordStamp = (x, y, text, size, angle, emit) => {
    const stampData = { type: 'emoji', x, y, text, size, angle };
    if (emit) {
        localHistory.push(stampData);
        socket.emit('draw', stampData);
    }
};

const onPointerDown = (e) => {
    if (e.target.closest('#toolbar') || e.target.closest('#emoji-library')) return; 

    emojiLibrary.classList.remove('show');
    const coords = getCenterCoords(e);
    
    if (activeSticker) {
        const dx = coords.x - activeSticker.x;
        const dy = coords.y - activeSticker.y;
        const unX = dx * Math.cos(-activeSticker.angle) - dy * Math.sin(-activeSticker.angle);
        const unY = dx * Math.sin(-activeSticker.angle) + dy * Math.cos(-activeSticker.angle);
        
        const halfBox = (activeSticker.size * 10) / 2;
        
        const distToHandle = Math.sqrt(Math.pow(unX - halfBox, 2) + Math.pow(unY - halfBox, 2));
        if (distToHandle < 30) {
            interactionMode = 'scaling';
            return; 
        }
        
        if (unX > -halfBox && unX < halfBox && unY > -halfBox && unY < halfBox) {
            interactionMode = 'moving';
            return;
        }
        
        finalizeSticker();
        return; 
    }

    if (isStamping) {
        activeSticker = {
            x: coords.x,
            y: coords.y,
            text: currentEmojiText,
            size: current.size,
            angle: 0
        };
        interactionMode = 'none';
    } else {
        drawing = true;
        current.x = coords.x;
        current.y = coords.y;
    }
};

const onPointerUp = (e) => {
    if (interactionMode !== 'none') {
        interactionMode = 'none';
    } else if (drawing) {
        drawing = false;
        const coords = getCenterCoords(e);
        const activeColor = isErasing ? document.body.style.backgroundColor || '#2a3631' : current.color;
        const activeEffect = isErasing ? 'none' : current.effect;
        recordLine(current.x, current.y, coords.x, coords.y, activeColor, current.size, activeEffect, true);
    }
};

const onPointerMove = (e) => {
    const coords = getCenterCoords(e);
    
    if (activeSticker && interactionMode === 'moving') {
        activeSticker.x = coords.x;
        activeSticker.y = coords.y;
    } else if (activeSticker && interactionMode === 'scaling') {
        const dx = coords.x - activeSticker.x;
        const dy = coords.y - activeSticker.y;
        
        activeSticker.angle = Math.atan2(dy, dx) - (Math.PI / 4);
        const distance = Math.sqrt(dx * dx + dy * dy);
        activeSticker.size = Math.max(2, distance / 7.07); 
    } else if (drawing) {
        // Eraser dynamically checks the current background color instead of hardcoded slate green!
        const activeColor = isErasing ? document.body.style.backgroundColor || '#2a3631' : current.color;
        const activeEffect = isErasing ? 'none' : current.effect;
        recordLine(current.x, current.y, coords.x, coords.y, activeColor, current.size, activeEffect, true);
        current.x = coords.x;
        current.y = coords.y;
    }
};

canvas.addEventListener('mousedown', onPointerDown);
canvas.addEventListener('mouseup', onPointerUp);
canvas.addEventListener('mouseout', onPointerUp);
canvas.addEventListener('mousemove', onPointerMove);

canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onPointerDown(e); }, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); onPointerUp(e); }, { passive: false });
canvas.addEventListener('touchcancel', (e) => { e.preventDefault(); onPointerUp(e); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); onPointerMove(e); }, { passive: false });

socket.on('init', (history) => {
    localHistory = history;
    
    // Scans history for the latest background color when joining late
    const latestBg = localHistory.slice().reverse().find(d => d.type === 'bg');
    if (latestBg) {
        document.body.style.backgroundColor = latestBg.color;
        bgColorPicker.value = latestBg.color;
    }
});

socket.on('draw', (data) => {
    localHistory.push(data);
    
    // Updates UI instantly for everyone else connected when a bg change drops
    if (data.type === 'bg') {
        document.body.style.backgroundColor = data.color;
        bgColorPicker.value = data.color;
    }
});

socket.on('clear', () => {
    localHistory = []; 
    document.body.style.backgroundColor = '#2a3631';
    bgColorPicker.value = '#2a3631';
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
        if (data.type === 'bg') {
            return; // We safely ignore BG packets in the render loop so it doesn't crash trying to draw a line
        }
        
        if (data.type === 'emoji') {
            ctx.save();
            ctx.translate(data.x + cx, data.y + cy);
            ctx.rotate(data.angle || 0); 
            
            ctx.font = `${data.size * 10}px Arial`; 
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.fillText(data.text, 0, 0);
            
            ctx.restore();
        } else {
            const effect = data.effect || 'none';
            ctx.beginPath();
            ctx.moveTo(data.x0 + cx, data.y0 + cy);
            ctx.lineTo(data.x1 + cx, data.y1 + cy);
            ctx.lineWidth = data.size;
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = data.color;

            if (effect !== 'none' && data.color !== document.body.style.backgroundColor && data.color !== '#2a3631') {
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

    if (activeSticker) {
        ctx.save();
        ctx.translate(activeSticker.x + cx, activeSticker.y + cy);
        ctx.rotate(activeSticker.angle);
        
        const boxSize = activeSticker.size * 10;
        const halfBox = boxSize / 2;

        ctx.font = `${boxSize}px Arial`; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(activeSticker.text, 0, 0);

        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(-halfBox, -halfBox, boxSize, boxSize);

        ctx.setLineDash([]);
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.arc(halfBox, halfBox, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.font = '16px Arial';
        ctx.fillText('⤡', halfBox, halfBox);

        ctx.restore();
    }

    requestAnimationFrame(renderCanvas);
}

renderCanvas();
