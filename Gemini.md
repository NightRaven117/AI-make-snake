<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Nifty 100 Snake Game</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;800&display=swap');

        body {
            background-color: #0b0f19;
            color: #e2e8f0;
            font-family: 'JetBrains Mono', monospace;
            overflow: hidden; /* Prevent scrolling while playing */
            touch-action: none; /* Prevent zoom/scroll on mobile */
        }

        /* CRT Screen Effect for Canvas */
        .canvas-container {
            position: relative;
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.15), inset 0 0 20px rgba(0,0,0,0.5);
            border: 2px solid #334155;
            border-radius: 8px;
            background-color: #0f172a;
        }

        canvas {
            display: block;
            image-rendering: pixelated; /* Keeps edges sharp */
        }

        /* UI Overlays */
        .overlay {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.95);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            z-index: 50;
        }
        
        .hidden { display: none !important; }

        /* Control Buttons */
        .d-pad {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            width: 160px;
        }
        .btn {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 8px;
            height: 48px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            color: #94a3b8;
            cursor: pointer;
            transition: all 0.1s;
            user-select: none;
        }
        .btn:active {
            background: #3b82f6;
            color: white;
            border-color: #60a5fa;
            transform: translateY(2px);
        }
    </style>
</head>
<body class="h-screen w-screen flex flex-col items-center justify-center p-2">

    <!-- Header -->
    <div class="w-full max-w-2xl flex justify-between items-end mb-4 px-2">
        <div>
            <h1 class="text-2xl font-extrabold text-blue-400 tracking-tighter">NIFTY<span class="text-white">100</span></h1>
            <p class="text-xs text-slate-500 uppercase tracking-widest">Market Simulator</p>
        </div>
        <div class="text-right">
            <p class="text-[10px] text-slate-500 uppercase">Portfolio Value</p>
            <p id="scoreDisplay" class="text-2xl font-bold text-green-400">₹0.00</p>
        </div>
    </div>

    <!-- Main Game Area -->
    <div class="flex flex-col md:flex-row gap-6 items-center">
        
        <!-- Game Board -->
        <div class="canvas-container">
            <canvas id="gameCanvas" width="400" height="400"></canvas>
            
            <!-- START SCREEN -->
            <div id="startScreen" class="overlay">
                <div class="text-5xl mb-4">📈</div>
                <h2 class="text-2xl font-bold text-white mb-2">Market Open</h2>
                <p class="text-xs text-slate-400 mb-6 text-center max-w-[250px]">
                    Navigate the market. Acquire companies. Avoid bankruptcy (walls).
                </p>
                <button onclick="initGame()" class="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded text-sm font-bold uppercase tracking-wider transition hover:scale-105 active:scale-95 shadow-lg shadow-blue-900/50">
                    Start Trading
                </button>
            </div>

            <!-- GAME OVER SCREEN -->
            <div id="gameOverScreen" class="overlay hidden">
                <div class="text-5xl mb-4">📉</div>
                <h2 class="text-3xl font-bold text-red-500 mb-1">CRASHED</h2>
                <p class="text-slate-400 text-sm mb-6">Market correction triggered.</p>
                <div class="bg-slate-800 p-4 rounded mb-6 text-center w-48">
                    <p class="text-[10px] text-slate-500 uppercase">Final Portfolio</p>
                    <p id="finalScore" class="text-xl font-bold text-white">0 Companies</p>
                </div>
                <button onclick="initGame()" class="bg-white text-slate-900 hover:bg-slate-200 px-8 py-3 rounded text-sm font-bold uppercase tracking-wider transition hover:scale-105 active:scale-95">
                    Re-Invest
                </button>
            </div>
        </div>

        <!-- Sidebar / Controls -->
        <div class="flex flex-col items-center gap-6">
            
            <!-- Target Info -->
            <div class="bg-slate-800/50 border border-slate-700 p-4 rounded-lg w-48 shadow-xl">
                <p class="text-[10px] text-slate-400 uppercase tracking-widest mb-1">New Listing</p>
                <div class="flex items-center gap-3">
                    <div id="targetColor" class="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_currentColor]"></div>
                    <div>
                        <p id="targetTicker" class="text-lg font-bold text-white leading-none">---</p>
                        <p id="targetName" class="text-[10px] text-slate-500 truncate w-24">---</p>
                    </div>
                </div>
            </div>

            <!-- Mobile Controls -->
            <div class="d-pad md:hidden">
                <div></div>
                <div class="btn" onclick="handleInput('UP')">▲</div>
                <div></div>
                <div class="btn" onclick="handleInput('LEFT')">◀</div>
                <div class="btn" onclick="handleInput('DOWN')">▼</div>
                <div class="btn" onclick="handleInput('RIGHT')">▶</div>
            </div>

            <!-- Desktop Instructions -->
            <div class="hidden md:block text-[10px] text-slate-600 text-center">
                Use <span class="bg-slate-800 px-1 rounded text-slate-400">Arrow Keys</span> to move
            </div>
        </div>
    </div>

    <script>
        // --- CONFIGURATION ---
        const CANVAS_SIZE = 400;
        const GRID_SIZE = 20; // 20x20 grid
        const TILE_SIZE = CANVAS_SIZE / GRID_SIZE;
        const GAME_SPEED_START = 150;
        const TARGET_STOCK_COUNT = 4; // Number of stocks on board at once

        // --- VISUAL CONSTANTS ---
        const PLAYER_COLOR = '#22c55e'; // Green-500
        const PLAYER_HEAD_COLOR = '#15803d'; // Green-700

        // --- DATA: NIFTY 100 COMPANIES ---
        const companies = [
            { t: "RIL", n: "Reliance", c: "#00529b" },
            { t: "TCS", n: "TCS", c: "#5f259f" },
            { t: "HDFC", n: "HDFC Bank", c: "#004c8f" },
            { t: "INFY", n: "Infosys", c: "#007cc3" },
            { t: "ICICI", n: "ICICI Bank", c: "#f37021" },
            { t: "HUL", n: "Hindustan Unilever", c: "#2d9cdb" },
            { t: "ITC", n: "ITC Ltd", c: "#005c8f" },
            { t: "SBIN", n: "SBI", c: "#2f80ed" },
            { t: "L&T", n: "Larsen & Toubro", c: "#f2c94c" },
            { t: "AIRTEL", n: "Bharti Airtel", c: "#eb5757" },
            { t: "KOTAK", n: "Kotak Mahindra", c: "#bb6bd9" },
            { t: "WIPRO", n: "Wipro", c: "#aa66cc" },
            { t: "HCL", n: "HCL Tech", c: "#33b5e5" },
            { t: "ASIAN", n: "Asian Paints", c: "#ff4444" },
            { t: "MARUTI", n: "Maruti Suzuki", c: "#0099cc" },
            { t: "SUN", n: "Sun Pharma", c: "#f78b00" },
            { t: "TITAN", n: "Titan Company", c: "#3e2723" },
            { t: "ULTR", n: "UltraTech", c: "#ffbb33" },
            { t: "NTPC", n: "NTPC", c: "#2bbbad" },
            { t: "NESTLE", n: "Nestle India", c: "#c0c0c0" }
        ];

        // --- GAME STATE ---
        let canvas, ctx;
        let gameLoopId;
        let snake = []; // Array of {x, y} coordinates only
        let portfolio = []; // Array of company objects corresponding to snake segments
        let foods = [];  // Array of {x, y, company}
        let direction = { x: 0, y: 0 };
        let nextDirection = { x: 0, y: 0 }; // Buffer to prevent 180 turns in one tick
        let score = 0;
        let companyIndex = 0;
        let gameSpeed = GAME_SPEED_START;
        let isGameRunning = false;

        // --- INITIALIZATION ---
        window.onload = () => {
            canvas = document.getElementById('gameCanvas');
            ctx = canvas.getContext('2d');
            
            // Draw initial empty grid
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            drawGrid();
        };

        function initGame() {
            // Reset UI
            document.getElementById('startScreen').classList.add('hidden');
            document.getElementById('gameOverScreen').classList.add('hidden');
            
            // Reset State
            // Start with 3 Grey Blocks (Empty companies)
            const emptyBlock = { t: "", n: "", c: "#64748b" };
            
            // Initialize Coordinates
            snake = [
                { x: 5, y: 10 },
                { x: 4, y: 10 },
                { x: 3, y: 10 }
            ];
            
            // Initialize Portfolio (Synced with snake length)
            portfolio = [emptyBlock, emptyBlock, emptyBlock];
            
            direction = { x: 1, y: 0 }; // Start moving right
            nextDirection = { x: 1, y: 0 };
            score = 0;
            companyIndex = 1;
            gameSpeed = GAME_SPEED_START;
            isGameRunning = true;
            foods = []; // Clear old food

            updateScore();
            replenishFoods();
            
            // Start Loop
            if (gameLoopId) clearInterval(gameLoopId);
            gameLoopId = setInterval(gameLoop, gameSpeed);
        }

        // --- CORE LOGIC ---
        function gameLoop() {
            if (!isGameRunning) return;

            update();
            draw();
        }

        function update() {
            // Update direction from buffer
            direction = nextDirection;

            // Calculate new head position
            const head = snake[0];
            const newX = head.x + direction.x;
            const newY = head.y + direction.y;

            // 1. Check Wall Collision
            if (newX < 0 || newX >= GRID_SIZE || newY < 0 || newY >= GRID_SIZE) {
                gameOver();
                return;
            }

            // 2. Check Self Collision
            // We ignore the very last tail segment because it will move forward this frame anyway
            for (let i = 0; i < snake.length - 1; i++) {
                if (newX === snake[i].x && newY === snake[i].y) {
                    gameOver();
                    return;
                }
            }

            // 3. Check Food Collision
            // Find if head hits any of the active foods
            const eatenFoodIndex = foods.findIndex(f => f.x === newX && f.y === newY);

            // ALWAYS add new head coordinate
            snake.unshift({ x: newX, y: newY });

            if (eatenFoodIndex !== -1) {
                const eatenFood = foods[eatenFoodIndex];

                // EAT: Add new company to portfolio
                portfolio.unshift(eatenFood.company);
                
                // Remove eaten food
                foods.splice(eatenFoodIndex, 1);

                score++;
                updateScore();
                
                // Increase speed slightly every 5 companies
                if (score % 5 === 0 && gameSpeed > 60) {
                    gameSpeed -= 10;
                    clearInterval(gameLoopId);
                    gameLoopId = setInterval(gameLoop, gameSpeed);
                }

                // Spawn a new stock to maintain market depth
                replenishFoods();
            } else {
                // MOVE: Remove tail coordinate
                snake.pop();
                // We DO NOT change the portfolio. 
                // The companies stay in their relative indices [0, 1, 2...]
                // The coordinates just shifted, so Company[0] is now at the new Head Coords.
            }
        }

        function replenishFoods() {
            while (foods.length < TARGET_STOCK_COUNT) {
                spawnOneFood();
            }
        }

        function spawnOneFood() {
            // Select next company in list
            const nextCo = companies[companyIndex % companies.length];
            companyIndex++;

            // Update UI to show the latest listing
            document.getElementById('targetTicker').innerText = nextCo.t;
            document.getElementById('targetName').innerText = nextCo.n;
            document.getElementById('targetColor').style.backgroundColor = nextCo.c;

            // Random Position
            let valid = false;
            let fx, fy;
            
            // Safety break loop
            let attempts = 0;
            while (!valid && attempts < 100) {
                attempts++;
                fx = Math.floor(Math.random() * GRID_SIZE);
                fy = Math.floor(Math.random() * GRID_SIZE);
                
                valid = true;
                
                // Ensure not on snake
                for (let part of snake) {
                    if (part.x === fx && part.y === fy) {
                        valid = false;
                        break;
                    }
                }
                
                // Ensure not on existing food
                if (valid) {
                    for (let f of foods) {
                        if (f.x === fx && f.y === fy) {
                            valid = false;
                            break;
                        }
                    }
                }
            }

            if (valid) {
                foods.push({ x: fx, y: fy, company: nextCo });
            }
        }

        function gameOver() {
            isGameRunning = false;
            clearInterval(gameLoopId);
            document.getElementById('finalScore').innerText = score + " Companies";
            document.getElementById('gameOverScreen').classList.remove('hidden');
        }

        // --- RENDERING ---
        function draw() {
            // Clear Canvas
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

            // Draw Grid
            drawGrid();

            // Draw All Foods
            for (const f of foods) {
                const fx = f.x * TILE_SIZE;
                const fy = f.y * TILE_SIZE;
                
                // Glow effect
                ctx.shadowBlur = 10;
                ctx.shadowColor = f.company.c;
                ctx.fillStyle = f.company.c;
                ctx.fillRect(fx + 2, fy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                ctx.shadowBlur = 0; // Reset
                
                // Food Text
                ctx.fillStyle = "white";
                ctx.font = "bold 9px Arial";
                ctx.textAlign = "center";
                ctx.fillText(f.company.t.substring(0,3), fx + TILE_SIZE/2, fy + TILE_SIZE/2 + 3);
            }

            // Draw Snake
            // We iterate backwards to draw tail first, head last (on top)
            for (let i = snake.length - 1; i >= 0; i--) {
                const part = snake[i];     // Coordinate
                const company = portfolio[i]; // Company Data
                
                const px = part.x * TILE_SIZE;
                const py = part.y * TILE_SIZE;
                const isHead = (i === 0);
                const isEmpty = !company.t; // Check if no ticker

                // Color Logic: Grey if empty, Green if collected
                if (isEmpty) {
                    ctx.fillStyle = isHead ? "#94a3b8" : "#475569"; // Slate-400 Head, Slate-600 Body
                } else {
                    ctx.fillStyle = isHead ? PLAYER_HEAD_COLOR : PLAYER_COLOR;
                }
                
                // Head is slightly larger
                if (isHead) {
                    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                    // White border for head
                    ctx.strokeStyle = "white";
                    ctx.lineWidth = 2;
                    ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                } else {
                    ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
                }

                // Ticker Text - Show on EVERY segment ONLY if it's a collected company
                if (!isEmpty) {
                    ctx.fillStyle = "rgba(255,255,255,0.95)";
                    ctx.font = "bold 8px Arial";
                    ctx.textAlign = "center";
                    // Show first 3 chars to fit in grid
                    ctx.fillText(company.t.substring(0,3), px + TILE_SIZE/2, py + TILE_SIZE/2 + 3);
                }
            }
        }

        function drawGrid() {
            ctx.strokeStyle = "#1e293b";
            ctx.lineWidth = 1;
            for (let i = 0; i <= GRID_SIZE; i++) {
                const pos = i * TILE_SIZE;
                // Vertical
                ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, CANVAS_SIZE); ctx.stroke();
                // Horizontal
                ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(CANVAS_SIZE, pos); ctx.stroke();
            }
        }

        function updateScore() {
            // Fake currency calculation
            const val = (score * 1000) + 100;
            document.getElementById('scoreDisplay').innerText = "₹" + val.toLocaleString();
        }

        // --- INPUT HANDLING ---
        function handleInput(key) {
            if (!isGameRunning) return;

            // Prevent reversing direction directly
            switch(key) {
                case 'UP':
                    if (direction.y === 0) nextDirection = { x: 0, y: -1 };
                    break;
                case 'DOWN':
                    if (direction.y === 0) nextDirection = { x: 0, y: 1 };
                    break;
                case 'LEFT':
                    if (direction.x === 0) nextDirection = { x: -1, y: 0 };
                    break;
                case 'RIGHT':
                    if (direction.x === 0) nextDirection = { x: 1, y: 0 };
                    break;
            }
        }

        // Keyboard Listener
        window.addEventListener('keydown', e => {
            if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].indexOf(e.code) > -1) {
                e.preventDefault();
            }
            
            switch(e.key) {
                case 'ArrowUp': handleInput('UP'); break;
                case 'ArrowDown': handleInput('DOWN'); break;
                case 'ArrowLeft': handleInput('LEFT'); break;
                case 'ArrowRight': handleInput('RIGHT'); break;
            }
        });

    </script>
</body>
</html>