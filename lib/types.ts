export type Position = {
  x: number;
  y: number;
};

export type Company = {
  t: string;
  n: string;
  c: string;
  logo: string;
  p: number;
};

export type FoodKind = "buy" | "sell";

export type Food = Position & {
  company: Company;
  kind: FoodKind;
  expiresAt: number;
};

export type PortfolioEntry = {
  company: Company;
  costBasis: number;
};

export type GameState = "idle" | "playing" | "gameOver";
