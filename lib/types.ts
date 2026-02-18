export type Position = {
  x: number;
  y: number;
};

export type Company = {
  t: string;
  n: string;
  c: string;
  logo: string;
};

export type Food = Position & {
  company: Company;
};

export type GameState = "idle" | "playing" | "gameOver";
