// Game state
const gridContainer = document.querySelector('.grid-container');
const scoreDisplay = document.getElementById('score');
const restartButton = document.getElementById('restart');
const bestScoreDisplay = document.getElementById('best-score');
let score = 0;
let grid = [];
let highScores = [];

// Sound and music system
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let backgroundMusic = null;
let isGameOver = false;
let audioInitialized = false;

// Initialize audio context on first user interaction
function initAudio() {
    if (audioInitialized) return;
    
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    createBackgroundMusic();
    audioInitialized = true;
}

// Create a reverb effect
async function createReverb() {
    const convolver = audioContext.createConvolver();
    const impulseResponse = await fetch('https://cdn.jsdelivr.net/gh/cwilso/WebAudio/sounds/impulse-responses/matrix-reverb2.wav')
        .then(response => response.arrayBuffer())
        .then(buffer => audioContext.decodeAudioData(buffer))
        .catch(() => null); // Fallback gracefully if reverb can't be loaded

    if (impulseResponse) {
        convolver.buffer = impulseResponse;
    }
    return convolver;
}

// Create instruments
function createInstrument(type, options = {}) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    
    // Basic oscillator setup
    oscillator.type = type;
    
    // Filter setup for more natural sound
    filter.type = options.filterType || 'lowpass';
    filter.frequency.value = options.filterFreq || 2000;
    filter.Q.value = options.filterQ || 1;
    
    // Gain setup
    gainNode.gain.value = 0;
    
    // Connect the nodes
    oscillator.connect(filter);
    filter.connect(gainNode);
    
    return { oscillator, gainNode, filter };
}

// Create a more complex sound with harmonics
function createComplexTone(fundamental, options = {}) {
    const harmonics = [
        { freq: fundamental, gain: 0.5 },    // Fundamental
        { freq: fundamental * 2, gain: 0.2 }, // 2nd harmonic
        { freq: fundamental * 3, gain: 0.1 }, // 3rd harmonic
        { freq: fundamental * 4, gain: 0.05 } // 4th harmonic
    ];
    
    const instruments = harmonics.map(h => {
        const inst = createInstrument(options.type || 'sine', {
            filterFreq: options.filterFreq || 2000,
            filterQ: options.filterQ || 1
        });
        inst.oscillator.frequency.value = h.freq;
        inst.gainNode.gain.value = h.gain * (options.volume || 1);
        return inst;
    });
    
    return instruments;
}

function createBackgroundMusic() {
    if (backgroundMusic) {
        stopBackgroundMusic();
    }

    const bpm = 100;
    const beatLength = 60 / bpm;
    const barLength = beatLength * 4;
    const totalBars = 4;
    
    backgroundMusic = {
        instruments: [],
        gains: [],
        isPlaying: false,
        reverbNode: null,
        timeout: null
    };

    // Create reverb
    createReverb().then(reverb => {
        if (reverb) {
            backgroundMusic.reverbNode = reverb;
            backgroundMusic.reverbNode.connect(audioContext.destination);
        }
    });

    const currentTime = audioContext.currentTime;
    let startTime = currentTime + 0.1; // Small delay to ensure all setup is complete

    // Melody sequence (pentatonic scale for a more pleasant sound)
    const melodySequence = [
        { note: 392.00, duration: beatLength }, // G4
        { note: 440.00, duration: beatLength }, // A4
        { note: 493.88, duration: beatLength }, // B4
        { note: 587.33, duration: beatLength }, // D5
        { note: 659.25, duration: beatLength }, // E5
        { note: 783.99, duration: beatLength }, // G5
        { note: 659.25, duration: beatLength }, // E5
        { note: 587.33, duration: beatLength }  // D5
    ];

    // Bass sequence
    const bassSequence = [
        { note: 98.00, duration: barLength },  // G2
        { note: 110.00, duration: barLength }, // A2
        { note: 123.47, duration: barLength }, // B2
        { note: 146.83, duration: barLength }  // D3
    ];

    // Schedule melody
    melodySequence.forEach((note, i) => {
        const instruments = createComplexTone(note.note, {
            type: 'sine',
            volume: 0.15,
            filterFreq: 3000
        });
        
        instruments.forEach(inst => {
            const { oscillator, gainNode } = inst;
            
            if (backgroundMusic.reverbNode) {
                gainNode.connect(backgroundMusic.reverbNode);
            } else {
                gainNode.connect(audioContext.destination);
            }

            gainNode.gain.setValueAtTime(0, startTime + i * beatLength);
            gainNode.gain.linearRampToValueAtTime(0.15, startTime + i * beatLength + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, startTime + (i + 1) * beatLength);

            oscillator.start(startTime);
            backgroundMusic.instruments.push(oscillator);
            backgroundMusic.gains.push(gainNode);
        });
    });

    // Schedule bass
    bassSequence.forEach((note, i) => {
        const instruments = createComplexTone(note.note, {
            type: 'triangle',
            volume: 0.2,
            filterFreq: 1000
        });
        
        instruments.forEach(inst => {
            const { oscillator, gainNode } = inst;
            
            if (backgroundMusic.reverbNode) {
                gainNode.connect(backgroundMusic.reverbNode);
            } else {
                gainNode.connect(audioContext.destination);
            }

            gainNode.gain.setValueAtTime(0, startTime + i * barLength);
            gainNode.gain.linearRampToValueAtTime(0.2, startTime + i * barLength + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, startTime + (i + 1) * barLength);

            oscillator.start(startTime);
            backgroundMusic.instruments.push(oscillator);
            backgroundMusic.gains.push(gainNode);
        });
    });

    // Schedule next loop
    const loopLength = totalBars * barLength;
    backgroundMusic.timeout = setTimeout(() => {
        if (backgroundMusic && backgroundMusic.isPlaying && !isGameOver) {
            createBackgroundMusic();
        }
    }, (loopLength - 0.1) * 1000);

    backgroundMusic.isPlaying = true;
}

function stopBackgroundMusic() {
    if (backgroundMusic) {
        backgroundMusic.isPlaying = false;
        clearTimeout(backgroundMusic.timeout);
        
        // Fade out all current sounds
        backgroundMusic.gains.forEach(gain => {
            const currentTime = audioContext.currentTime;
            gain.gain.linearRampToValueAtTime(0, currentTime + 0.5);
        });
        
        // Clean up after fade out
        setTimeout(() => {
            if (backgroundMusic.reverbNode) {
                backgroundMusic.reverbNode.disconnect();
            }
            backgroundMusic.instruments.forEach(osc => {
                try {
                    osc.stop();
                    osc.disconnect();
                } catch (e) {
                    // Ignore errors if oscillator is already stopped
                }
            });
            backgroundMusic.gains.forEach(gain => gain.disconnect());
        }, 500);
    }
}

function createSound(type) {
    if (isGameOver) return null;
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    switch (type) {
        case 'move':
            oscillator.type = 'sine';
            oscillator.frequency.value = 220;
            gainNode.gain.value = 0.05;
            break;
        case 'merge':
            oscillator.type = 'triangle';
            oscillator.frequency.value = 440;
            gainNode.gain.value = 0.08;
            break;
        case 'win':
            oscillator.type = 'square';
            oscillator.frequency.value = 880;
            gainNode.gain.value = 0.1;
            break;
        case 'lose':
            oscillator.type = 'sawtooth';
            oscillator.frequency.value = 110;
            gainNode.gain.value = 0.1;
            break;
    }
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    return { oscillator, gainNode };
}

function playSound(type) {
    if (isGameOver && type !== 'lose') return;
    
    const sound = createSound(type);
    if (!sound) return;
    
    const { oscillator, gainNode } = sound;
    const duration = type === 'win' || type === 'lose' ? 0.6 : 0.1;
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    setTimeout(() => {
        oscillator.stop();
        oscillator.disconnect();
        gainNode.disconnect();
    }, duration * 1000);
}

function gameOver() {
    isGameOver = true;
    stopBackgroundMusic();
    saveHighScore(score);
    playSound('lose');
    setTimeout(() => alert('Game over!'), 500);
    return true;
}

function checkWin() {
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            if (grid[y][x] === 2048) {
                isGameOver = true;
                stopBackgroundMusic();
                playSound('win');
                setTimeout(() => alert('You win!'), 500);
                return true;
            }
        }
    }
    return false;
}

function initGame() {
    grid = Array(4).fill().map(() => Array(4).fill(0));
    score = 0;
    isGameOver = false;
    clearBoard();
    generateRandomCell();
    generateRandomCell();
    updateGrid();
    scoreDisplay.textContent = score;
    initAudio();  // Initialize audio when game starts
}

function getTilePosition(x, y) {
    const cell = gridContainer.children[y * 4 + x];
    const rect = cell.getBoundingClientRect();
    const containerRect = gridContainer.getBoundingClientRect();
    return {
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top
    };
}

function getPosition(x, y) {
    const cell = gridContainer.children[y * 4 + x];
    const rect = cell.getBoundingClientRect();
    const containerRect = gridContainer.getBoundingClientRect();
    return {
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top
    };
}

function createTile(x, y, value, isNew = false) {
    const tile = document.createElement('div');
    tile.className = 'tile' + (isNew ? ' new' : '');
    tile.textContent = value;
    tile.setAttribute('data-value', value);
    tile.setAttribute('data-x', x);
    tile.setAttribute('data-y', y);
    
    // Set initial position
    const position = getPosition(x, y);
    tile.style.left = position.left + 'px';
    tile.style.top = position.top + 'px';
    
    gridContainer.appendChild(tile);
    return tile;
}

function clearBoard() {
    // Remove all existing tiles
    const tiles = document.querySelectorAll('.tile');
    tiles.forEach(tile => tile.remove());
}

function updateGrid() {
    // Remove any tiles that were merged in the previous move
    const tiles = document.querySelectorAll('.tile.merged');
    tiles.forEach(tile => tile.remove());

    // Update or create tiles based on current grid state
    grid.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const existingTile = document.querySelector(`[data-x="${x}"][data-y="${y}"]:not(.merged)`);
                if (existingTile) {
                    // Update existing tile if value changed
                    if (parseInt(existingTile.getAttribute('data-value')) !== value) {
                        existingTile.textContent = value;
                        existingTile.setAttribute('data-value', value);
                        existingTile.classList.add('merging');
                        setTimeout(() => {
                            existingTile.classList.remove('merging');
                        }, 250);
                    }
                } else {
                    // Create new tile if none exists at this position
                    createTile(x, y, value, false);
                }
            }
        });
    });

    // Remove any tiles that are no longer in the grid
    document.querySelectorAll('.tile').forEach(tile => {
        const x = parseInt(tile.getAttribute('data-x'));
        const y = parseInt(tile.getAttribute('data-y'));
        if (grid[y][x] === 0) {
            tile.remove();
        }
    });
}

function moveTile(tile, fromX, fromY, toX, toY, value) {
    const position = getPosition(toX, toY);
    
    // Update data attributes
    tile.setAttribute('data-x', toX);
    tile.setAttribute('data-y', toY);
    
    // If merging, update the value and add merge animation
    if (value && parseInt(tile.getAttribute('data-value')) !== value) {
        tile.textContent = value;
        tile.setAttribute('data-value', value);
        tile.classList.add('merging');
        
        // Schedule cleanup of merge animation
        setTimeout(() => {
            if (tile && tile.parentElement) {
                tile.classList.remove('merging');
                tile.classList.add('merged');
            }
        }, 250);
    }
    
    // Update position
    tile.style.left = position.left + 'px';
    tile.style.top = position.top + 'px';
}

function moveTiles(direction) {
    let moved = false;
    const newGrid = Array(4).fill().map(() => Array(4).fill(0));
    const mergedTiles = new Set();

    // Helper function to process tile movement
    const processTileMovement = (x, y, newX, newY, value) => {
        const tile = document.querySelector(`[data-x="${x}"][data-y="${y}"]:not(.merged)`);
        if (tile) {
            moveTile(tile, x, y, newX, newY, value);
            if (value !== grid[y][x]) {
                playSound('merge');
            } else {
                playSound('move');
            }
        }
    };

    if (direction === 'left' || direction === 'right') {
        const step = direction === 'left' ? 1 : -1;
        const start = direction === 'left' ? 0 : 3;
        const end = direction === 'left' ? 4 : -1;
        
        for (let y = 0; y < 4; y++) {
            let newX = start;
            for (let x = start; x !== end; x += step) {
                if (grid[y][x]) {
                    let currentX = newX;
                    let value = grid[y][x];
                    
                    // Check for merge
                    if (newGrid[y][currentX - step] === value && !mergedTiles.has(`${y},${currentX - step}`)) {
                        currentX -= step;
                        value *= 2;
                        score += value;
                        mergedTiles.add(`${y},${currentX}`);
                    }
                    
                    if (x !== currentX) {
                        moved = true;
                    }
                    
                    newGrid[y][currentX] = value;
                    processTileMovement(x, y, currentX, y, value);
                    newX += step;
                }
            }
        }
    } else {
        const step = direction === 'up' ? 1 : -1;
        const start = direction === 'up' ? 0 : 3;
        const end = direction === 'up' ? 4 : -1;
        
        for (let x = 0; x < 4; x++) {
            let newY = start;
            for (let y = start; y !== end; y += step) {
                if (grid[y][x]) {
                    let currentY = newY;
                    let value = grid[y][x];
                    
                    // Check for merge
                    if (newGrid[currentY - step] && newGrid[currentY - step][x] === value && !mergedTiles.has(`${currentY - step},${x}`)) {
                        currentY -= step;
                        value *= 2;
                        score += value;
                        mergedTiles.add(`${currentY},${x}`);
                    }
                    
                    if (y !== currentY) {
                        moved = true;
                    }
                    
                    newGrid[currentY][x] = value;
                    processTileMovement(x, y, x, currentY, value);
                    newY += step;
                }
            }
        }
    }

    if (moved) {
        setTimeout(() => {
            grid = newGrid;
            generateRandomCell();
            updateGrid();
            scoreDisplay.textContent = score;
            
            // Check win/lose after tiles have settled
            setTimeout(() => {
                if (checkWin() || checkLose()) {
                    saveHighScore(score);
                }
            }, 250);
        }, 250);
    }

    return moved;
}

function checkLose() {
    // Check for empty cells
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            if (grid[y][x] === 0) return false;
        }
    }
    
    // Check for possible merges
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            if (x < 3 && grid[y][x] === grid[y][x + 1]) return false;
            if (y < 3 && grid[y][x] === grid[y + 1][x]) return false;
        }
    }
    
    // Only call gameOver() if we've determined there are no valid moves
    gameOver();
    return true;
}

window.addEventListener('keydown', (event) => {
    switch (event.key) {
        case 'ArrowUp':
            event.preventDefault();
            moveTiles('up');
            break;
        case 'ArrowDown':
            event.preventDefault();
            moveTiles('down');
            break;
        case 'ArrowLeft':
            event.preventDefault();
            moveTiles('left');
            break;
        case 'ArrowRight':
            event.preventDefault();
            moveTiles('right');
            break;
    }
});

restartButton.addEventListener('click', initGame);

// Add control pad functionality
const controlButtons = {
    'move-up': { key: 'ArrowUp', keyCode: 38 },
    'move-down': { key: 'ArrowDown', keyCode: 40 },
    'move-left': { key: 'ArrowLeft', keyCode: 37 },
    'move-right': { key: 'ArrowRight', keyCode: 39 }
};

Object.entries(controlButtons).forEach(([id, keyInfo]) => {
    const button = document.getElementById(id);
    if (button) {
        // Handle both mouse clicks and touch events
        const handleMove = (e) => {
            e.preventDefault(); // Prevent double-firing on touch devices
            // Create and dispatch a keyboard event to reuse existing logic
            const event = new KeyboardEvent('keydown', {
                key: keyInfo.key,
                keyCode: keyInfo.keyCode,
                which: keyInfo.keyCode,
                bubbles: true
            });
            document.dispatchEvent(event);
        };

        button.addEventListener('click', handleMove);
        button.addEventListener('touchstart', handleMove);
        
        // Prevent default touch behavior to avoid scrolling
        button.addEventListener('touchend', e => e.preventDefault());
    }
});

// Add high scores management
const HIGH_SCORES_KEY = '2048-high-scores';

function loadHighScores() {
    const saved = localStorage.getItem(HIGH_SCORES_KEY);
    highScores = saved ? JSON.parse(saved) : [];
    updateHighScoresDisplay();
    updateBestScore();
}

function updateBestScore() {
    const bestScore = highScores.length > 0 ? Math.max(...highScores) : 0;
    bestScoreDisplay.textContent = bestScore;
}

function saveHighScore(score) {
    highScores.push(score);
    highScores.sort((a, b) => b - a); // Sort in descending order
    if (highScores.length > 5) {
        highScores.length = 5; // Keep only top 5
    }
    localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(highScores));
    updateHighScoresDisplay();
    updateBestScore();
}

function updateHighScoresDisplay() {
    const list = document.getElementById('high-scores-list');
    list.innerHTML = '';
    
    if (highScores.length === 0) {
        list.innerHTML = '<li class="no-scores">No scores yet!</li>';
        return;
    }
    
    highScores.forEach((score, index) => {
        const li = document.createElement('li');
        li.textContent = `${score} points`;
        if (score === score) {
            li.style.animation = 'highlight 1s ease';
        }
        list.appendChild(li);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initGame();
    loadHighScores();
});

function generateRandomCell() {
    const emptyCells = [];
    grid.forEach((row, y) => {
        row.forEach((cell, x) => {
            if (cell === 0) {
                emptyCells.push({ x, y });
            }
        });
    });

    if (emptyCells.length > 0) {
        const { x, y } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const value = Math.random() < 0.9 ? 2 : 4;
        grid[y][x] = value;
        
        // Create new tile with animation
        createTile(x, y, value, true);
    }
}
