export type MascotState = "idle" | "walk" | "run" | "hide" | "peek" | "eat" | "sleep";

export interface MascotPosition {
  x: number;
  y: number;
}

export interface MascotConfig {
  hideChance: number;
  runChance: number;
  eatIntervalMin: number;
  eatIntervalMax: number;
  eatDurationMin: number;
  eatDurationMax: number;
  walkSpeed: number;
  runSpeed: number;
  navbarPadding: number;
  footerPadding: number;
  formAvoidance: number;
}

export const defaultConfig: MascotConfig = {
  hideChance: 0.3,
  runChance: 0.1,
  eatIntervalMin: 30000,
  eatIntervalMax: 90000,
  eatDurationMin: 6000,
  eatDurationMax: 12000,
  walkSpeed: 1.5,
  runSpeed: 4,
  navbarPadding: 64,
  footerPadding: 32,
  formAvoidance: 100,
};

export function getNextEatInterval(config: MascotConfig): number {
  return (
    config.eatIntervalMin +
    Math.random() * (config.eatIntervalMax - config.eatIntervalMin)
  );
}

export function getEatDuration(config: MascotConfig): number {
  return (
    config.eatDurationMin +
    Math.random() * (config.eatDurationMax - config.eatDurationMin)
  );
}

export function clampPosition(
  pos: MascotPosition,
  catSize: number,
  config: MascotConfig
): MascotPosition {
  const maxX = window.innerWidth - catSize;
  const maxY = window.innerHeight - catSize - config.footerPadding;
  const minY = config.navbarPadding;
  return {
    x: Math.max(0, Math.min(pos.x, maxX)),
    y: Math.max(minY, Math.min(pos.y, maxY)),
  };
}

export function getRandomIdlePosition(
  catSize: number,
  config: MascotConfig
): MascotPosition {
  return clampPosition(
    {
      x: Math.random() * (window.innerWidth - catSize),
      y: window.innerHeight - catSize - config.footerPadding - 20,
    },
    catSize,
    config
  );
}

export function moveToward(
  current: MascotPosition,
  target: MascotPosition,
  speed: number
): { position: MascotPosition; arrived: boolean; direction: number } {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < speed * 2) {
    return { position: target, arrived: true, direction: dx >= 0 ? 1 : -1 };
  }
  const nx = dx / dist;
  const ny = dy / dist;
  return {
    position: { x: current.x + nx * speed, y: current.y + ny * speed },
    arrived: false,
    direction: dx >= 0 ? 1 : -1,
  };
}
