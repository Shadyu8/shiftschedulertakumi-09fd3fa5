import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import CatSprite from "@/components/mascot/CatSprite";

describe("CatSprite", () => {
  it("renders with idle state", () => {
    render(<CatSprite state="idle" direction={1} />);
    const sprite = screen.getByTestId("cat-sprite");
    expect(sprite).toBeInTheDocument();
    expect(sprite).toHaveAttribute("data-mascot-state", "idle");
  });

  it("renders with eat state and shows ramen bowl", () => {
    const { container } = render(<CatSprite state="eat" direction={1} />);
    const sprite = screen.getByTestId("cat-sprite");
    expect(sprite).toHaveAttribute("data-mascot-state", "eat");
    // Ramen bowl should be visible (steam elements)
    const steamElements = container.querySelectorAll(".mascot-steam");
    expect(steamElements.length).toBeGreaterThan(0);
  });

  it("renders with sleep state and shows Zzz", () => {
    const { container } = render(<CatSprite state="sleep" direction={1} />);
    const sprite = screen.getByTestId("cat-sprite");
    expect(sprite).toHaveAttribute("data-mascot-state", "sleep");
    const zzz = container.querySelector(".mascot-zzz");
    expect(zzz).toBeInTheDocument();
  });

  it("flips horizontally when direction is -1", () => {
    render(<CatSprite state="idle" direction={-1} />);
    const sprite = screen.getByTestId("cat-sprite");
    expect(sprite.style.transform).toContain("scaleX(-1)");
  });

  it("applies run scale", () => {
    render(<CatSprite state="run" direction={1} />);
    const sprite = screen.getByTestId("cat-sprite");
    expect(sprite.style.transform).toContain("scale(1.1)");
  });

  it("reduces opacity when hiding", () => {
    render(<CatSprite state="hide" direction={1} />);
    const sprite = screen.getByTestId("cat-sprite");
    expect(sprite.style.opacity).toBe("0.3");
  });

  it("has accessible label on SVG", () => {
    const { container } = render(<CatSprite state="idle" direction={1} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-label", "Orange cat mascot");
  });
});
