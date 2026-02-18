"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { companies } from "@/lib/companies";
import type { Position, Company, Food, FoodKind, GameState, PortfolioEntry } from "@/lib/types";

const GRID_SIZE = 20;
const GAME_SPEED_START = 150;
const TARGET_STOCK_COUNT = 4;

const BG_COLOR = "#0f172a";
const GRID_LINE_COLOR = "#1e293b";
const EMPTY_BODY = "#475569";
const EMPTY_HEAD = "#94a3b8";
const EMPTY_BLOCK: PortfolioEntry = {
  company: { t: "", n: "", c: "#64748b", logo: "", p: 0 },
  costBasis: 0,
};
const PRICE_TICK_MS = 500;
const STARTING_WALLET = 25_000;
const BUY_ONLY_COUNT = 8;

const FOOD_BUY_BG = "#166534";
const FOOD_SELL_BG = "#991b1b";
const FOOD_LIFE_MIN = 5_000;
const FOOD_LIFE_MAX = 10_000;

const LOGO_PADDING_RATIO = 0.1;
const FOOD_PADDING_RATIO = 0.12;

const drawGrid = (
  ctx: CanvasRenderingContext2D,
  canvasSize: number,
  tileSize: number
) => {
  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID_SIZE; i++) {
    const pos = i * tileSize;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, canvasSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(canvasSize, pos);
    ctx.stroke();
  }
};

const drawFoods = (
  ctx: CanvasRenderingContext2D,
  foods: Food[],
  logoCache: Map<string, HTMLImageElement>,
  tileSize: number
) => {
  const pad = Math.round(tileSize * FOOD_PADDING_RATIO);
  for (const f of foods) {
    const fx = f.x * tileSize;
    const fy = f.y * tileSize;

    ctx.fillStyle = f.kind === "buy" ? FOOD_BUY_BG : FOOD_SELL_BG;
    ctx.fillRect(fx + 1, fy + 1, tileSize - 2, tileSize - 2);

    const img = logoCache.get(f.company.logo);
    if (img?.complete && img.naturalWidth > 0) {
      ctx.drawImage(
        img,
        fx + pad,
        fy + pad,
        tileSize - pad * 2,
        tileSize - pad * 2
      );
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(tileSize * 0.35)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        f.company.t.substring(0, 5),
        fx + tileSize / 2,
        fy + tileSize / 2
      );
    }
  }
};

const drawSnake = (
  ctx: CanvasRenderingContext2D,
  snake: Position[],
  portfolio: PortfolioEntry[],
  logoCache: Map<string, HTMLImageElement>,
  tileSize: number
) => {
  const pad = Math.round(tileSize * LOGO_PADDING_RATIO);
  for (let i = snake.length - 1; i >= 0; i--) {
    const part = snake[i];
    const { company } = portfolio[i];
    const px = part.x * tileSize;
    const py = part.y * tileSize;
    const isHead = i === 0;
    const isEmpty = !company.t;

    if (isEmpty) {
      ctx.fillStyle = isHead ? EMPTY_HEAD : EMPTY_BODY;
    } else {
      ctx.fillStyle = "#ffffff";
    }

    ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);

    if (isHead) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, tileSize, tileSize);
    }

    if (!isEmpty) {
      const img = logoCache.get(company.logo);
      if (img?.complete && img.naturalWidth > 0) {
        ctx.drawImage(
          img,
          px + pad,
          py + pad,
          tileSize - pad * 2,
          tileSize - pad * 2
        );
      } else {
        ctx.fillStyle = "#334155";
        ctx.font = `bold ${Math.round(tileSize * 0.35)}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          company.t.substring(0, 5),
          px + tileSize / 2,
          py + tileSize / 2
        );
      }
    }
  }
};

const computeCanvasSize = () => {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const sidebarWidth = 280;
  const padding = 32;
  const maxSize = Math.min(vh - padding, vw - sidebarWidth - padding);
  return Math.floor(maxSize / GRID_SIZE) * GRID_SIZE;
};

export const SnakeGame = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const snakeRef = useRef<Position[]>([]);
  const portfolioRef = useRef<PortfolioEntry[]>([]);
  const foodsRef = useRef<Food[]>([]);
  const directionRef = useRef({ x: 0, y: 0 });
  const nextDirectionRef = useRef({ x: 0, y: 0 });
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const priceTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const companyIndexRef = useRef(1);
  const isRunningRef = useRef(false);
  const scoreRef = useRef(0);
  const buyCountRef = useRef(0);
  const sellCountRef = useRef(0);
  const walletRef = useRef(STARTING_WALLET);
  const currentPricesRef = useRef<Map<string, number>>(new Map());
  const spawnCountRef = useRef(0);
  const tickRef = useRef<() => void>(() => {});
  const logoCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const canvasSizeRef = useRef(0);
  const tileSizeRef = useRef(0);

  const [canvasSize, setCanvasSize] = useState(0);
  const [score, setScore] = useState(0);
  const [buyCount, setBuyCount] = useState(0);
  const [sellCount, setSellCount] = useState(0);
  const [wallet, setWallet] = useState(STARTING_WALLET);
  const [currentValue, setCurrentValue] = useState(0);
  const [returns, setReturns] = useState(0);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [currentTarget, setCurrentTarget] = useState<Company | null>(null);
  const [playerName, setPlayerName] = useState("");

  useEffect(() => {
    const cache = logoCacheRef.current;
    for (const co of companies) {
      if (cache.has(co.logo)) continue;
      const img = new Image();
      img.src = `/logos/${co.logo}`;
      cache.set(co.logo, img);
    }
  }, []);

  useEffect(() => {
    const size = computeCanvasSize();
    canvasSizeRef.current = size;
    tileSizeRef.current = size / GRID_SIZE;
    setCanvasSize(size);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, size, size);
    drawGrid(ctx, size, size / GRID_SIZE);
  }, []);

  const initPrices = () => {
    const prices = currentPricesRef.current;
    prices.clear();
    for (const co of companies) {
      prices.set(co.t, co.p);
    }
  };

  const recomputePortfolio = () => {
    const prices = currentPricesRef.current;
    let totalCurrent = 0;
    let totalCost = 0;
    for (const entry of portfolioRef.current) {
      if (!entry.company.t) continue;
      totalCurrent += prices.get(entry.company.t) ?? entry.company.p;
      totalCost += entry.costBasis;
    }
    setCurrentValue(totalCurrent);
    setReturns(totalCurrent - totalCost);
  };

  const fluctuatePrices = () => {
    const prices = currentPricesRef.current;
    for (const co of companies) {
      const current = prices.get(co.t) ?? co.p;
      const change = (Math.random() - 0.5) * 0.08;
      const newPrice = Math.max(Math.round(current * (1 + change)), Math.round(co.p * 0.1));
      prices.set(co.t, newPrice);
    }
    recomputePortfolio();
  };

  const clearPriceTick = () => {
    if (priceTickRef.current) {
      clearInterval(priceTickRef.current);
      priceTickRef.current = null;
    }
  };

  const startPriceTick = () => {
    clearPriceTick();
    priceTickRef.current = setInterval(fluctuatePrices, PRICE_TICK_MS);
  };

  const spawnOneFood = () => {
    spawnCountRef.current++;

    const ownedEntries = portfolioRef.current.filter((e) => e.company.t !== "");

    let kind: FoodKind;
    if (spawnCountRef.current <= BUY_ONLY_COUNT || ownedEntries.length === 0) {
      kind = "buy";
    } else {
      kind = Math.random() < 0.5 ? "buy" : "sell";
    }

    let foodCompany: Company;
    if (kind === "sell") {
      foodCompany =
        ownedEntries[Math.floor(Math.random() * ownedEntries.length)].company;
    } else {
      foodCompany = companies[companyIndexRef.current % companies.length];
      companyIndexRef.current++;
    }

    setCurrentTarget(foodCompany);

    let valid = false;
    let fx = 0;
    let fy = 0;
    let attempts = 0;

    while (!valid && attempts < 100) {
      attempts++;
      fx = Math.floor(Math.random() * GRID_SIZE);
      fy = Math.floor(Math.random() * GRID_SIZE);
      valid = true;

      for (const part of snakeRef.current) {
        if (part.x === fx && part.y === fy) {
          valid = false;
          break;
        }
      }

      if (valid) {
        for (const f of foodsRef.current) {
          if (f.x === fx && f.y === fy) {
            valid = false;
            break;
          }
        }
      }
    }

    if (valid) {
      const lifespan = FOOD_LIFE_MIN + Math.random() * (FOOD_LIFE_MAX - FOOD_LIFE_MIN);
      foodsRef.current.push({
        x: fx,
        y: fy,
        company: foodCompany,
        kind,
        expiresAt: Date.now() + lifespan,
      });
    }
  };

  const replenishFoods = () => {
    while (foodsRef.current.length < TARGET_STOCK_COUNT) {
      spawnOneFood();
    }
  };

  const clearLoop = () => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }
  };

  const startLoop = () => {
    clearLoop();
    gameLoopRef.current = setInterval(
      () => tickRef.current(),
      GAME_SPEED_START
    );
  };

  const handleGameOver = () => {
    isRunningRef.current = false;
    clearLoop();
    clearPriceTick();
    recomputePortfolio();
    setGameState("gameOver");
  };

  tickRef.current = () => {
    const ctx = canvasRef.current?.getContext("2d");
    const cs = canvasSizeRef.current;
    const ts = tileSizeRef.current;
    if (!ctx || !isRunningRef.current || !cs) return;

    const now = Date.now();
    const beforeCount = foodsRef.current.length;
    foodsRef.current = foodsRef.current.filter((f) => f.expiresAt > now);
    if (foodsRef.current.length < beforeCount) {
      replenishFoods();
    }

    directionRef.current = { ...nextDirectionRef.current };
    const snake = snakeRef.current;
    const head = snake[0];
    const dir = directionRef.current;
    const newX = head.x + dir.x;
    const newY = head.y + dir.y;

    if (newX < 0 || newX >= GRID_SIZE || newY < 0 || newY >= GRID_SIZE) {
      handleGameOver();
      return;
    }

    for (let i = 0; i < snake.length - 1; i++) {
      if (newX === snake[i].x && newY === snake[i].y) {
        handleGameOver();
        return;
      }
    }

    const eatenFoodIndex = foodsRef.current.findIndex(
      (f) => f.x === newX && f.y === newY
    );

    snake.unshift({ x: newX, y: newY });

    if (eatenFoodIndex !== -1) {
      const eatenFood = foodsRef.current[eatenFoodIndex];
      foodsRef.current.splice(eatenFoodIndex, 1);

      const prices = currentPricesRef.current;
      const livePrice = prices.get(eatenFood.company.t) ?? eatenFood.company.p;

      if (eatenFood.kind === "buy") {
        while (walletRef.current < livePrice) {
          let earliestOwned = -1;
          for (let i = portfolioRef.current.length - 1; i >= 1; i--) {
            if (portfolioRef.current[i].company.t !== "") {
              earliestOwned = i;
              break;
            }
          }
          if (earliestOwned === -1 || snake.length <= 1) break;

          const soldEntry = portfolioRef.current[earliestOwned];
          const soldPrice = prices.get(soldEntry.company.t) ?? soldEntry.company.p;
          walletRef.current += soldPrice;
          portfolioRef.current.splice(earliestOwned, 1);
          snake.splice(earliestOwned, 1);
          sellCountRef.current++;
        }

        portfolioRef.current.unshift({ company: eatenFood.company, costBasis: livePrice });
        walletRef.current -= livePrice;
        buyCountRef.current++;
      } else {
        snake.pop();

        let sellIndex = -1;
        for (let i = portfolioRef.current.length - 1; i >= 1; i--) {
          if (portfolioRef.current[i].company.t === eatenFood.company.t) {
            sellIndex = i;
            break;
          }
        }

        if (sellIndex !== -1 && snake.length > 1) {
          portfolioRef.current.splice(sellIndex, 1);
          snake.splice(sellIndex, 1);
          walletRef.current += livePrice;
          sellCountRef.current++;
        }
      }

      setWallet(walletRef.current);
      recomputePortfolio();
      setBuyCount(buyCountRef.current);
      setSellCount(sellCountRef.current);

      scoreRef.current++;
      setScore(scoreRef.current);

      replenishFoods();
    } else {
      snake.pop();
    }

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, cs, cs);
    drawGrid(ctx, cs, ts);
    drawFoods(ctx, foodsRef.current, logoCacheRef.current, ts);
    drawSnake(
      ctx,
      snakeRef.current,
      portfolioRef.current,
      logoCacheRef.current,
      ts
    );
  };

  const handleStartGame = () => {
    snakeRef.current = [
      { x: 5, y: 10 },
      { x: 4, y: 10 },
      { x: 3, y: 10 },
    ];
    portfolioRef.current = [EMPTY_BLOCK, EMPTY_BLOCK, EMPTY_BLOCK];
    directionRef.current = { x: 1, y: 0 };
    nextDirectionRef.current = { x: 1, y: 0 };
    scoreRef.current = 0;
    buyCountRef.current = 0;
    sellCountRef.current = 0;
    walletRef.current = STARTING_WALLET;
    spawnCountRef.current = 0;
    companyIndexRef.current = 1;
    foodsRef.current = [];
    isRunningRef.current = true;

    initPrices();

    setScore(0);
    setBuyCount(0);
    setSellCount(0);
    setWallet(STARTING_WALLET);
    setCurrentValue(0);
    setReturns(0);
    setGameState("playing");

    replenishFoods();
    startLoop();
    startPriceTick();
  };

  const handleInput = useCallback((key: string) => {
    if (!isRunningRef.current) return;

    const dir = directionRef.current;
    switch (key) {
      case "UP":
        if (dir.y === 0) nextDirectionRef.current = { x: 0, y: -1 };
        break;
      case "DOWN":
        if (dir.y === 0) nextDirectionRef.current = { x: 0, y: 1 };
        break;
      case "LEFT":
        if (dir.x === 0) nextDirectionRef.current = { x: -1, y: 0 };
        break;
      case "RIGHT":
        if (dir.x === 0) nextDirectionRef.current = { x: 1, y: 0 };
        break;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (arrowKeys.includes(e.code)) {
        e.preventDefault();
      }

      switch (e.key) {
        case "ArrowUp":
          handleInput("UP");
          break;
        case "ArrowDown":
          handleInput("DOWN");
          break;
        case "ArrowLeft":
          handleInput("LEFT");
          break;
        case "ArrowRight":
          handleInput("RIGHT");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleInput]);

  useEffect(() => {
    return () => {
      clearLoop();
      clearPriceTick();
    };
  }, []);

  return (
    <main className="h-screen w-screen flex overflow-hidden">
      {/* Canvas Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="canvas-container relative">
          <canvas
            ref={canvasRef}
            aria-label="Nifty 50 Snake game board"
            tabIndex={0}
            role="img"
            style={{ width: canvasSize, height: canvasSize }}
          />

          {/* Start Screen */}
          {gameState === "idle" && (
            <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center rounded-md z-50">
              <div className="text-6xl mb-4" aria-hidden="true">
                📈
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">
                Market Open
              </h2>
              <p className="text-sm text-slate-400 mb-6 text-center max-w-[300px]">
                Navigate the market. Acquire companies. Avoid bankruptcy (walls).
              </p>
              <div className="w-full max-w-[280px] mb-8">
                <label
                  htmlFor="player-name"
                  className="block text-[10px] text-slate-500 uppercase tracking-widest mb-2"
                >
                  Your Name
                </label>
                <input
                  id="player-name"
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && playerName.trim()) {
                      handleStartGame();
                    }
                  }}
                  placeholder="Enter your name..."
                  maxLength={20}
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-4 py-3 text-white text-sm placeholder:text-slate-600 outline-none transition"
                  aria-label="Enter your name to start the game"
                  tabIndex={0}
                />
              </div>
              <button
                onClick={handleStartGame}
                disabled={!playerName.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white px-10 py-4 rounded-lg text-sm font-bold uppercase tracking-wider transition hover:scale-105 active:scale-95 shadow-lg shadow-blue-900/50 disabled:shadow-none disabled:hover:scale-100"
                aria-label="Start trading game"
                tabIndex={0}
              >
                Start Trading
              </button>
            </div>
          )}

          {/* Game Over Screen */}
          {gameState === "gameOver" && (
            <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center rounded-md z-50">
              <div className="text-6xl mb-4" aria-hidden="true">
                📉
              </div>
              <h2 className="text-4xl font-bold text-red-500 mb-2">CRASHED</h2>
              <p className="text-slate-400 text-sm mb-8">
                Market correction triggered.
              </p>
              <div className="bg-slate-800 p-6 rounded-lg mb-8 text-center w-64 space-y-3">
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">
                    Total Worth
                  </p>
                  <p className="text-3xl font-bold text-white">
                    ₹{(currentValue + wallet).toLocaleString("en-IN")}
                  </p>
                  <p className={`text-sm font-semibold mt-1 ${currentValue + wallet >= STARTING_WALLET ? "text-green-400" : "text-red-400"}`}>
                    {currentValue + wallet >= STARTING_WALLET ? "+" : ""}₹{(currentValue + wallet - STARTING_WALLET).toLocaleString("en-IN")} from start
                  </p>
                </div>
                <div className="border-t border-slate-700 pt-3 flex gap-4 justify-center">
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 uppercase mb-1">
                      Bought
                    </p>
                    <p className="text-2xl font-bold text-green-400">
                      {buyCount}
                    </p>
                  </div>
                  <div className="w-px bg-slate-700" />
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 uppercase mb-1">
                      Sold
                    </p>
                    <p className="text-2xl font-bold text-red-400">
                      {sellCount}
                    </p>
                  </div>
                </div>
                <div className="border-t border-slate-700 pt-3 flex gap-4 justify-center">
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 uppercase mb-1">
                      Portfolio
                    </p>
                    <p className="text-base font-bold text-blue-400">
                      ₹{currentValue.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="w-px bg-slate-700" />
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 uppercase mb-1">
                      Wallet
                    </p>
                    <p className="text-base font-bold text-green-400">
                      ₹{wallet.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
                <div className="border-t border-slate-700 pt-3">
                  <p className="text-xs text-slate-500 uppercase mb-1">
                    Returns
                  </p>
                  <p className={`text-base font-bold ${returns >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {returns >= 0 ? "+" : ""}₹{returns.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPlayerName("");
                  setGameState("idle");
                }}
                className="bg-white text-slate-900 hover:bg-slate-200 px-10 py-4 rounded-lg text-sm font-bold uppercase tracking-wider transition hover:scale-105 active:scale-95"
                aria-label="Re-invest and play again"
                tabIndex={0}
              >
                Re-Invest
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <aside className="w-64 h-screen bg-slate-900/80 border-l border-slate-700/50 flex flex-col p-6 gap-8 shrink-0">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter">
            <span className="text-blue-400">NIFTY</span>
            <span className="text-white">50</span>
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
            Market Simulator
          </p>
        </div>

        {/* Wallet */}
        <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-lg">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
            Wallet
          </p>
          <p className={`text-3xl font-bold ${wallet >= 0 ? "text-green-400" : "text-red-400"}`}>
            ₹{wallet.toLocaleString("en-IN")}
          </p>
        </div>

        {/* Portfolio */}
        <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-lg space-y-3">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
              {playerName.trim() ? `${playerName.trim()}'s Portfolio` : "Current Value"}
            </p>
            <p className="text-3xl font-bold text-blue-400">
              ₹{currentValue.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="border-t border-slate-700/50 pt-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">
              Returns
            </p>
            <p className={`text-xl font-bold ${returns >= 0 ? "text-green-400" : "text-red-400"}`}>
              {returns >= 0 ? "+" : ""}₹{returns.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        {/* New Listing Panel */}
        <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-lg">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
            New Listing
          </p>
          <div className="flex items-center gap-3">
            {currentTarget?.logo ? (
              <img
                src={`/logos/${currentTarget.logo}`}
                alt={currentTarget.n}
                className="w-10 h-10 rounded-md object-contain bg-white p-1 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-md bg-slate-700 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-base font-bold text-white leading-none">
                {currentTarget?.t ?? "---"}
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {currentTarget?.n ?? "Waiting for market..."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1" />

        {/* Mobile D-Pad */}
        <div
          className="grid grid-cols-3 gap-2 md:hidden"
          role="group"
          aria-label="Directional controls"
        >
          <div />
          <button
            onClick={() => handleInput("UP")}
            onKeyDown={(e) => e.key === "Enter" && handleInput("UP")}
            className="bg-slate-800 border border-slate-700 rounded-lg h-12 flex items-center justify-center text-xl text-slate-400 active:bg-blue-500 active:text-white active:border-blue-400 active:translate-y-0.5 transition-all select-none"
            aria-label="Move up"
            tabIndex={0}
          >
            ▲
          </button>
          <div />
          <button
            onClick={() => handleInput("LEFT")}
            onKeyDown={(e) => e.key === "Enter" && handleInput("LEFT")}
            className="bg-slate-800 border border-slate-700 rounded-lg h-12 flex items-center justify-center text-xl text-slate-400 active:bg-blue-500 active:text-white active:border-blue-400 active:translate-y-0.5 transition-all select-none"
            aria-label="Move left"
            tabIndex={0}
          >
            ◀
          </button>
          <button
            onClick={() => handleInput("DOWN")}
            onKeyDown={(e) => e.key === "Enter" && handleInput("DOWN")}
            className="bg-slate-800 border border-slate-700 rounded-lg h-12 flex items-center justify-center text-xl text-slate-400 active:bg-blue-500 active:text-white active:border-blue-400 active:translate-y-0.5 transition-all select-none"
            aria-label="Move down"
            tabIndex={0}
          >
            ▼
          </button>
          <button
            onClick={() => handleInput("RIGHT")}
            onKeyDown={(e) => e.key === "Enter" && handleInput("RIGHT")}
            className="bg-slate-800 border border-slate-700 rounded-lg h-12 flex items-center justify-center text-xl text-slate-400 active:bg-blue-500 active:text-white active:border-blue-400 active:translate-y-0.5 transition-all select-none"
            aria-label="Move right"
            tabIndex={0}
          >
            ▶
          </button>
        </div>

        {/* Desktop Hint */}
        <div className="hidden md:block text-xs text-slate-600 text-center">
          Use{" "}
          <kbd className="bg-slate-800 px-2 py-1 rounded text-slate-400 text-[11px]">
            Arrow Keys
          </kbd>{" "}
          to move
        </div>
      </aside>
    </main>
  );
};
