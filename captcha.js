(function() {
    'use strict';

    /* ═══════════════════════════════════════
       Procedural piece generation
       Every CAPTCHA generates unique random
       polyomino shapes (6-9 cells) that can't
       be enumerated by bots.
       ═══════════════════════════════════════ */

    const PALETTE = [
        '#00d4ff','#ffd600','#b347d9','#3fb950','#f85149','#f0883e','#58a6ff',
        '#e879f9','#06b6d4','#fb923c','#a78bfa','#4ade80','#f472b6','#fbbf24',
        '#34d399','#f87171','#c084fc','#38bdf8','#fb7185','#22d3ee','#a3e635',
    ];

    // Generate a random connected polyomino of n cells using random walk
    function generatePolyomino(n) {
        const cells = [[0, 0]];
        const set = new Set(['0,0']);
        const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

        let attempts = 0;
        while (cells.length < n && attempts < 500) {
            attempts++;
            const base = cells[Math.floor(Math.random() * cells.length)];
            const d = dirs[Math.floor(Math.random() * 4)];
            const nx = base[0] + d[0], ny = base[1] + d[1];
            const key = nx + ',' + ny;
            if (!set.has(key)) {
                cells.push([nx, ny]);
                set.add(key);
            }
        }
        return normalizeCells(cells);
    }

    // Generate a piece that is visually distinct from another
    function generateDistinctPiece(targetCells, existingPieces, sizeRange) {
        for (let attempt = 0; attempt < 100; attempt++) {
            const size = sizeRange[0] + Math.floor(Math.random() * (sizeRange[1] - sizeRange[0] + 1));
            const cells = generatePolyomino(size);
            if (cellsEqual(cells, targetCells)) continue;
            if (existingPieces.some(p => cellsEqual(p, cells))) continue;
            const bounds = pieceBounds(cells);
            if (bounds.w === 1 || bounds.h === 1) {
                if (cells.length > 3) continue;
            }
            return cells;
        }
        return generatePolyomino(sizeRange[0]);
    }

    // Apply random rotation (0, 90, 180, 270) to cells
    function randomRotation(cells) {
        const turns = Math.floor(Math.random() * 4);
        let cur = cells;
        for (let i = 0; i < turns; i++) {
            cur = cur.map(([x,y]) => [-y, x]);
        }
        return normalizeCells(cur);
    }

    const CELL = 30;
    const BOARD_CELLS = 10;
    const BOARD_PX = BOARD_CELLS * CELL + 2;

    /* ═══════════════════════════════════════
       Utility
       ═══════════════════════════════════════ */
    function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

    function pieceBounds(cells) {
        let mx = 0, my = 0;
        for (const [x, y] of cells) { mx = Math.max(mx, x); my = Math.max(my, y); }
        return { w: mx + 1, h: my + 1 };
    }

    function normalizeCells(cells) {
        let minX = Infinity, minY = Infinity;
        for (const [x, y] of cells) { minX = Math.min(minX, x); minY = Math.min(minY, y); }
        return cells.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    }

    function cellsEqual(a, b) {
        if (a.length !== b.length) return false;
        const na = normalizeCells(a), nb = normalizeCells(b);
        return na.every((c, i) => c[0] === nb[i][0] && c[1] === nb[i][1]);
    }

    /* ═══════════════════════════════════════
       CAPTCHA state
       ═══════════════════════════════════════ */
    let challenge = null;
    let dragState = null;

    function generateChallenge() {
        const targetSize = 6 + Math.floor(Math.random() * 4);
        let targetCells = randomRotation(generatePolyomino(targetSize));
        let bounds = pieceBounds(targetCells);

        while (bounds.w > BOARD_CELLS || bounds.h > BOARD_CELLS) {
            targetCells = randomRotation(generatePolyomino(targetSize));
            bounds = pieceBounds(targetCells);
        }

        const targetColor = PALETTE[Math.floor(Math.random() * PALETTE.length)];

        const maxOx = BOARD_CELLS - bounds.w;
        const maxOy = BOARD_CELLS - bounds.h;
        const ox = Math.floor(Math.random() * (maxOx + 1));
        const oy = Math.floor(Math.random() * (maxOy + 1));

        const numDistractors = 4 + Math.floor(Math.random() * 2);
        const distractorCells = [];
        for (let i = 0; i < numDistractors; i++) {
            const cells = generateDistinctPiece(
                targetCells, distractorCells,
                [Math.max(4, targetSize - 1), targetSize + 1]
            );
            distractorCells.push(cells);
        }

        const usedColors = new Set([targetColor]);
        function pickColor() {
            for (let i = 0; i < 50; i++) {
                const c = PALETTE[Math.floor(Math.random() * PALETTE.length)];
                if (!usedColors.has(c)) { usedColors.add(c); return c; }
            }
            return PALETTE[Math.floor(Math.random() * PALETTE.length)];
        }

        const pieces = shuffle([
            { cells: targetCells, color: targetColor, correct: true },
            ...distractorCells.map(cells => ({
                cells: randomRotation(cells),
                color: pickColor(),
                correct: false
            }))
        ]);

        const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        challenge = { targetCells, targetColor, holeOffset: { x: ox, y: oy }, pieces, token };
        return challenge;
    }

    /* ═══════════════════════════════════════
       Drawing
       ═══════════════════════════════════════ */
    function drawBoard() {
        const canvas = document.getElementById('boardCanvas');
        canvas.width = BOARD_PX;
        canvas.height = BOARD_PX;
        const ctx = canvas.getContext('2d');
        const ch = challenge;

        ctx.fillStyle = '#252836';
        ctx.fillRect(0, 0, BOARD_PX, BOARD_PX);

        ctx.strokeStyle = '#333750';
        ctx.lineWidth = 1;
        for (let i = 0; i <= BOARD_CELLS; i++) {
            const p = i * CELL + 1;
            ctx.beginPath(); ctx.moveTo(p, 1); ctx.lineTo(p, BOARD_PX - 1); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(1, p); ctx.lineTo(BOARD_PX - 1, p); ctx.stroke();
        }

        const holeSet = new Set();
        for (const [cx, cy] of ch.targetCells) {
            const bx = cx + ch.holeOffset.x;
            const by = cy + ch.holeOffset.y;
            holeSet.add(bx + ',' + by);
        }
        for (let y = 0; y < BOARD_CELLS; y++) {
            for (let x = 0; x < BOARD_CELLS; x++) {
                if (!holeSet.has(x + ',' + y)) {
                    ctx.fillStyle = '#3a3f55';
                    ctx.fillRect(x * CELL + 2, y * CELL + 2, CELL - 2, CELL - 2);
                }
            }
        }

        for (const [cx, cy] of ch.targetCells) {
            const bx = cx + ch.holeOffset.x;
            const by = cy + ch.holeOffset.y;
            ctx.fillStyle = '#151821';
            ctx.fillRect(bx * CELL + 2, by * CELL + 2, CELL - 2, CELL - 2);
            ctx.strokeStyle = 'rgba(88,166,255,0.25)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(bx * CELL + 2, by * CELL + 2, CELL - 2, CELL - 2);
        }

        ctx.strokeStyle = '#2e3147';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, BOARD_PX, BOARD_PX);
    }

    function drawPieceCanvas(canvas, cells, color, size) {
        const bounds = pieceBounds(cells);
        const cs = size || 26;
        const pad = 4;
        canvas.width = bounds.w * cs + pad * 2;
        canvas.height = bounds.h * cs + pad * 2;
        const ctx = canvas.getContext('2d');

        for (const [cx, cy] of cells) {
            const x = cx * cs + pad;
            const y = cy * cs + pad;
            ctx.fillStyle = color;
            ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(x + 1, y + 1, cs - 2, 3);
            ctx.fillRect(x + 1, y + 1, 3, cs - 2);
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(x + 1, y + cs - 3, cs - 2, 2);
            ctx.fillRect(x + cs - 3, y + 1, 2, cs - 2);
        }
    }

    /* ═══════════════════════════════════════
       Anti-bot measures
       ═══════════════════════════════════════ */

    let mouseTrail = [];
    let captchaOpenTime = 0;
    let failCount = 0;
    const MAX_FAILS = 5;

    function recordMouse(e) {
        if (!challenge) return;
        mouseTrail.push({ x: e.clientX, y: e.clientY, t: Date.now() });
        if (mouseTrail.length > 200) mouseTrail.shift();
    }

    function validateBehavior() {
        // Must have mouse movement (bots teleport)
        if (mouseTrail.length < 5) return false;

        // Must take at least 800ms (humans need time)
        const elapsed = Date.now() - captchaOpenTime;
        if (elapsed < 800) return false;

        // Check for non-linear movement
        let dirChanges = 0;
        for (let i = 2; i < mouseTrail.length; i++) {
            const dx1 = mouseTrail[i-1].x - mouseTrail[i-2].x;
            const dy1 = mouseTrail[i-1].y - mouseTrail[i-2].y;
            const dx2 = mouseTrail[i].x - mouseTrail[i-1].x;
            const dy2 = mouseTrail[i].y - mouseTrail[i-1].y;
            if ((dx1 * dy2 - dy1 * dx2) !== 0) dirChanges++;
        }
        if (dirChanges < 3) return false;

        // Check for variable speed
        const speeds = [];
        for (let i = 1; i < mouseTrail.length; i++) {
            const dx = mouseTrail[i].x - mouseTrail[i-1].x;
            const dy = mouseTrail[i].y - mouseTrail[i-1].y;
            const dt = mouseTrail[i].t - mouseTrail[i-1].t;
            if (dt > 0) speeds.push(Math.sqrt(dx*dx + dy*dy) / dt);
        }
        if (speeds.length > 2) {
            const avg = speeds.reduce((a,b) => a+b, 0) / speeds.length;
            const variance = speeds.reduce((a,b) => a + (b-avg)**2, 0) / speeds.length;
            if (variance < 0.001 && speeds.length > 10) return false;
        }

        return true;
    }

    /* ═══════════════════════════════════════
       CAPTCHA lifecycle
       ═══════════════════════════════════════ */
    function openCaptcha() {
        generateChallenge();
        drawBoard();
        renderPieces();
        mouseTrail = [];
        captchaOpenTime = Date.now();
        document.getElementById('captchaFeedback').textContent = '';
        document.getElementById('captchaFeedback').className = 'captcha-feedback';
        document.getElementById('captchaOverlay').classList.add('open');
        document.addEventListener('mousemove', recordMouse);
    }

    function closeCaptcha() {
        document.getElementById('captchaOverlay').classList.remove('open');
        document.removeEventListener('mousemove', recordMouse);
        cleanupDrag();
    }

    function renderPieces() {
        const panel = document.getElementById('piecesPanel');
        panel.querySelectorAll('canvas').forEach(c => c.remove());

        challenge.pieces.forEach((p, idx) => {
            const c = document.createElement('canvas');
            c.className = 'piece-canvas';
            c.dataset.idx = idx;
            drawPieceCanvas(c, p.cells, p.color, 26);
            panel.appendChild(c);

            c.addEventListener('mousedown', e => startDrag(e, idx, c));
            c.addEventListener('touchstart', e => startDragTouch(e, idx, c), { passive: false });
        });
    }

    /* ═══════════════════════════════════════
       Drag & Drop
       ═══════════════════════════════════════ */
    function startDrag(e, idx, srcCanvas) {
        e.preventDefault();
        const piece = challenge.pieces[idx];
        const ghost = document.createElement('canvas');
        ghost.className = 'drag-ghost';
        drawPieceCanvas(ghost, piece.cells, piece.color, CELL);
        document.body.appendChild(ghost);
        srcCanvas.classList.add('dragging');

        dragState = {
            pieceIdx: idx,
            ghost,
            srcCanvas,
            offsetX: ghost.width / 2,
            offsetY: ghost.height / 2
        };
        moveGhost(e.clientX, e.clientY);

        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
    }

    function startDragTouch(e, idx, srcCanvas) {
        e.preventDefault();
        const touch = e.touches[0];
        const piece = challenge.pieces[idx];
        const ghost = document.createElement('canvas');
        ghost.className = 'drag-ghost';
        drawPieceCanvas(ghost, piece.cells, piece.color, CELL);
        document.body.appendChild(ghost);
        srcCanvas.classList.add('dragging');

        dragState = {
            pieceIdx: idx,
            ghost,
            srcCanvas,
            offsetX: ghost.width / 2,
            offsetY: ghost.height / 2
        };
        moveGhost(touch.clientX, touch.clientY);

        document.addEventListener('touchmove', onDragMoveTouch, { passive: false });
        document.addEventListener('touchend', onDragEndTouch);
    }

    function moveGhost(cx, cy) {
        if (!dragState) return;
        dragState.ghost.style.left = (cx - dragState.offsetX) + 'px';
        dragState.ghost.style.top = (cy - dragState.offsetY) + 'px';
    }

    function onDragMove(e) { moveGhost(e.clientX, e.clientY); }
    function onDragMoveTouch(e) { e.preventDefault(); moveGhost(e.touches[0].clientX, e.touches[0].clientY); }

    function onDragEnd(e) { finishDrag(e.clientX, e.clientY); }
    function onDragEndTouch(e) {
        const t = e.changedTouches[0];
        finishDrag(t.clientX, t.clientY);
    }

    function finishDrag(cx, cy) {
        if (!dragState) return;

        const boardCanvas = document.getElementById('boardCanvas');
        const rect = boardCanvas.getBoundingClientRect();
        const piece = challenge.pieces[dragState.pieceIdx];

        const inBoard = cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom;

        cleanupDrag();

        if (inBoard && piece.correct) {
            onCaptchaSuccess();
        } else if (inBoard) {
            onCaptchaFail();
        }
    }

    function cleanupDrag() {
        if (dragState) {
            dragState.ghost.remove();
            dragState.srcCanvas.classList.remove('dragging');
            document.removeEventListener('mousemove', onDragMove);
            document.removeEventListener('mouseup', onDragEnd);
            document.removeEventListener('touchmove', onDragMoveTouch);
            document.removeEventListener('touchend', onDragEndTouch);
            dragState = null;
        }
    }

    /* ═══════════════════════════════════════
       Result handling
       ═══════════════════════════════════════ */
    function onCaptchaSuccess() {
        const fb = document.getElementById('captchaFeedback');

        if (!validateBehavior()) {
            fb.textContent = '\u26a0 Подозрительное поведение. Попробуйте ещё раз.';
            fb.className = 'captcha-feedback fail';
            setTimeout(() => {
                generateChallenge();
                drawBoard();
                renderPieces();
                mouseTrail = [];
                captchaOpenTime = Date.now();
                fb.textContent = '';
                fb.className = 'captcha-feedback';
            }, 1500);
            return;
        }

        fb.textContent = '\u2713 Проверка пройдена!';
        fb.className = 'captcha-feedback ok';

        highlightBoard(true);
        failCount = 0;

        setTimeout(() => {
            closeCaptcha();
            showToast('Форма отправлена!', 'success');
            document.getElementById('mainForm').reset();
        }, 900);
    }

    function onCaptchaFail() {
        failCount++;
        const fb = document.getElementById('captchaFeedback');

        if (failCount >= MAX_FAILS) {
            fb.textContent = '\u2717 Слишком много ошибок. Попробуйте позже.';
            fb.className = 'captcha-feedback fail';
            setTimeout(() => closeCaptcha(), 2000);
            setTimeout(() => { failCount = 0; }, 30000);
            return;
        }

        fb.textContent = '\u2717 Неверная фигура. Попробуйте ещё раз.';
        fb.className = 'captcha-feedback fail';

        highlightBoard(false);

        const delay = 1200 + failCount * 500;
        setTimeout(() => {
            generateChallenge();
            drawBoard();
            renderPieces();
            mouseTrail = [];
            captchaOpenTime = Date.now();
            fb.textContent = '';
            fb.className = 'captcha-feedback';
        }, delay);
    }

    function highlightBoard(success) {
        const canvas = document.getElementById('boardCanvas');
        const ctx = canvas.getContext('2d');
        const ch = challenge;
        const color = success ? ch.targetColor : 'rgba(248,81,73,0.5)';

        for (const [cx, cy] of ch.targetCells) {
            const bx = cx + ch.holeOffset.x;
            const by = cy + ch.holeOffset.y;
            ctx.fillStyle = color;
            ctx.fillRect(bx * CELL + 2, by * CELL + 2, CELL - 2, CELL - 2);
            if (success) {
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                ctx.fillRect(bx * CELL + 2, by * CELL + 2, CELL - 2, 3);
                ctx.fillRect(bx * CELL + 2, by * CELL + 2, 3, CELL - 2);
            }
        }
    }

    /* ═══════════════════════════════════════
       Toast
       ═══════════════════════════════════════ */
    function showToast(msg, type) {
        const el = document.getElementById('toast');
        el.textContent = msg;
        el.className = 'toast ' + type + ' show';
        setTimeout(() => el.classList.remove('show'), 2500);
    }

    /* ═══════════════════════════════════════
       Init
       ═══════════════════════════════════════ */
    document.getElementById('mainForm').addEventListener('submit', e => {
        e.preventDefault();
        // Honeypot check: if hidden field is filled, it's a bot
        const hp = document.getElementById('website');
        if (hp && hp.value) {
            showToast('Форма отправлена!', 'success');
            return; // Silently pretend success, but do nothing
        }
        openCaptcha();
    });

    document.getElementById('captchaClose').addEventListener('click', closeCaptcha);
    document.getElementById('captchaOverlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeCaptcha();
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeCaptcha();
    });

})();
