import { describe, it, expect } from "vitest";
import {
  clampPosition,
  moveToward,
  defaultConfig,
} from "@/components/mascot/mascotStateMachine";

describe("mascotStateMachine", () => {
  describe("clampPosition", () => {
    it("should clamp x to minimum 0", () => {
      const result = clampPosition({ x: -10, y: 200 }, 64, defaultConfig);
      expect(result.x).toBe(0);
    });

    it("should clamp y to minimum navbarPadding", () => {
      const result = clampPosition({ x: 100, y: 0 }, 64, defaultConfig);
      expect(result.y).toBe(defaultConfig.navbarPadding);
    });

    it("should clamp x to max window width minus catSize", () => {
      const result = clampPosition({ x: 99999, y: 200 }, 64, defaultConfig);
      expect(result.x).toBeLessThanOrEqual(window.innerWidth - 64);
    });

    it("should allow valid positions unchanged", () => {
      const result = clampPosition({ x: 200, y: 200 }, 64, defaultConfig);
      expect(result.x).toBe(200);
      expect(result.y).toBe(200);
    });
  });

  describe("moveToward", () => {
    it("should arrive when close to target", () => {
      const result = moveToward({ x: 100, y: 100 }, { x: 101, y: 100 }, 3);
      expect(result.arrived).toBe(true);
      expect(result.position).toEqual({ x: 101, y: 100 });
    });

    it("should move toward target when far away", () => {
      const result = moveToward({ x: 0, y: 0 }, { x: 100, y: 0 }, 2);
      expect(result.arrived).toBe(false);
      expect(result.position.x).toBeGreaterThan(0);
      expect(result.direction).toBe(1);
    });

    it("should return direction -1 when moving left", () => {
      const result = moveToward({ x: 100, y: 0 }, { x: 0, y: 0 }, 2);
      expect(result.direction).toBe(-1);
    });
  });
});
