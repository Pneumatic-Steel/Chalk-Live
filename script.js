const socket = io({
    transports: ['websocket']
});

const canvas = document.getElementById('chalkboard');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let drawing = false;
let current = {
    color: 'rgba(255, 255, 255, 0.9)',
    size: 4
};

ctx.lineJoin = 'round';
ctx.lineCap = 'round';
ctx.lineWidth = current.size;

// Handle tool selection (colors and eraser)
document.querySelectorAll('.color-picker').forEach(picker => {
    picker.addEventListener('click', (e) => {
        current.color = e.currentTarget.getAttribute('data-color');
        current.size = parseInt(e.currentTarget.getAttribute('data-size'));
        
        document.querySelectorAll('.color-picker').forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');
    });
});

const drawLine = (x0, y0, x1, y1, color, size, emit) => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.stroke();
    ctx.closePath();

    if (!emit) return;
    socket.emit('draw', { x0, y0, x1, y1, color, size });
};

const onPointerDown = (e) => {
    drawing = true;
    current.x = e.clientX || e.touches[0].clientX;
    current.y = e.clientY || e.touches[0].clientY;
};

const onPointerUp = (e) => {
    if (!drawing) return;
    drawing = false;
    drawLine(current.x, current.y, e.clientX || e.changedTouches[0].clientX, e.clientY || e.changedTouches[0].clientY, current.color, current.size, true);
};

const onPointerMove = (e) => {
    if (!drawing) return;
    const x = e.clientX || e.touches[0].clientX;
    const y = e.clientY || e.touches[0].clientY;
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

// Load existing strokes when first joining or refreshing
socket.on('init', (history) => {
    history.forEach(data => {
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, false);
    });
});

socket.on('draw', (data) => {
    drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size, false);
});

socket.on('clear', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

window.addEventListener('resize', () => {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.putImageData(imgData, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = current.size;
});
