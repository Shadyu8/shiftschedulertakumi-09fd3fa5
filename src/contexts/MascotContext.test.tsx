import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import { MascotProvider, useMascot } from "@/contexts/MascotContext";

// Helper component to read context values
function MascotConsumer() {
  const { state, position, direction } = useMascot();
  return (
    <div>
      <span data-testid="mascot-state">{state}</span>
      <span data-testid="mascot-x">{position.x}</span>
      <span data-testid="mascot-y">{position.y}</span>
      <span data-testid="mascot-dir">{direction}</span>
    </div>
  );
}

describe("MascotContext", () => {
  it("provides default state to consumers", () => {
    render(
      <MascotProvider>
        <MascotConsumer />
      </MascotProvider>
    );
    expect(screen.getByTestId("mascot-state").textContent).toBe("idle");
    expect(screen.getByTestId("mascot-dir").textContent).toBe("1");
  });

  it("throws when useMascot is used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<MascotConsumer />)).toThrow(
      "useMascot must be used inside MascotProvider"
    );
    spy.mockRestore();
  });

  it("provides position within valid bounds", () => {
    render(
      <MascotProvider>
        <MascotConsumer />
      </MascotProvider>
    );
    const x = Number(screen.getByTestId("mascot-x").textContent);
    const y = Number(screen.getByTestId("mascot-y").textContent);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
  });

  it("accepts custom config", () => {
    render(
      <MascotProvider config={{ hideChance: 0.5, runChance: 0.2 }}>
        <MascotConsumer />
      </MascotProvider>
    );
    expect(screen.getByTestId("mascot-state").textContent).toBe("idle");
  });
});
