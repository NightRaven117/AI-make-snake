Game Specification: Nifty 100 Snake

Version: 1.2

Date: February 2026

Platform: Web (HTML5/Canvas)

1. Overview

Nifty 100 Snake is a stock-market-themed variation of the classic "Snake" arcade game. Players control a moving "portfolio" (snake) on a grid, attempting to "acquire" (eat) companies to grow their assets. The visual style mimics a trading terminal, and the snake itself serves as a history of the player's acquisitions.

2. Core Gameplay Mechanics

2.1 Objective

Navigate the grid to collect company tickers (food).

Avoid colliding with the walls (Bankruptcy).

Avoid colliding with your own tail (Self-cannibalization).

Maximize "Portfolio Value" (Score).

2.2 Controls

Desktop: Arrow Keys (Up, Down, Left, Right).

Mobile: On-screen D-Pad (Touch controls).

Input Handling: Buffered input (nextDirection) prevents the snake from reversing into itself within a single frame.

2.3 Growth & Movement Logic

Starting State: The snake begins with a length of 3 segments. These starting segments are "empty" (colored grey) and contain no ticker symbols.

Movement: The snake moves one grid block per "tick".

Acquisition:

When the head enters a grid cell containing a company:

Growth: The snake length increases by exactly 1 block.

Portfolio Update: The specific company acquired is added to the front of the portfolio array.

Speed: Game speed increases (tick duration decreases by 10ms) every 5 acquisitions.

Visual History: Unlike standard Snake, the "identity" of a segment (the company ticker) stays fixed relative to the body index. If you eat "TCS", the head becomes "TCS". As the snake moves, that "TCS" segment follows the path of the snake.

2.4 Market Depth (Food Spawning)

Multiple Targets: There are always 4 active companies (food items) on the board simultaneously.

Replenishment: Immediately upon consuming one company, a new one from the NIFTY 100 list spawns in a valid empty location to maintain the count of 4.

3. Visual & UI Design

3.1 Theme

Style: Dark Mode / Financial Terminal.

Font: JetBrains Mono (Monospaced).

Background: Deep Navy/Slate (#0b0f19).

3.2 Entities

The Snake (Portfolio):

Head: Dark Green (#15803d).

Body: Standard Green (#22c55e).

Empty Start Segments: Grey (#475569).

Labels: Every segment containing a company displays the first 3 letters of its Ticker Symbol (e.g., "REL", "TCS") in white text.

Companies (Food):

Displayed as colored squares based on the company's brand color.

Includes a glow effect (shadowBlur) to distinguish them from the snake.

3.3 User Interface

Header: Displays Game Title and current "Portfolio Value" (Score formatted as currency).

Sidebar:

"New Listing" Panel: Shows the metadata (Ticker, Name, Brand Color) of the most recently spawned company.

Controls: D-Pad for mobile users.

Overlays:

Start Screen: "Market Open" prompt with a Start button.

Game Over: "Crashed" screen showing final score and a Re-invest button.

4. Technical Architecture

4.1 Data Structures

The game separates spatial data from entity data to ensure visual stability.

snake Array: * Stores x, y coordinates only.

Manages collision and movement.

portfolio Array:

Stores company objects { t: "TCS", n: "TCS Ltd", c: "#hex" }.

Synced by index with the snake array.

Crucial Logic: When moving without eating, snake coordinates shift, but portfolio indices remain static. When eating, a new company unshifts into portfolio[0].

4.2 Configuration Constants

GRID_SIZE: 20x20

CANVAS_SIZE: 400px (Scaled via CSS)

GAME_SPEED_START: 150ms

TARGET_STOCK_COUNT: 4

4.3 Company Data Source

Hardcoded array of top Indian companies including:

Reliance (RIL)

TCS

HDFC Bank

Infosys (INFY)

ICICI Bank

(And others...)

5. Future Roadmap (Potential Features)

High Score LocalStorage: Save personal bests.

Sound Effects: "Ka-ching" on eat, "Alarm" on crash.

Sector Bonuses: Bonus points for collecting 3 companies from the same sector (e.g., Banking) in a row.