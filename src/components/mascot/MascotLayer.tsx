import React from "react";
import { createPortal } from "react-dom";
import { useMascot } from "@/contexts/MascotContext";
import CatSprite from "./CatSprite";

/**
 * Fixed-position overlay that renders the mascot.
 * pointer-events: none so it never blocks user interactions.
 */
const MascotLayer: React.FC = () => {
  const { state, position, direction } = useMascot();

  return createPortal(
    <div
      data-testid="mascot-layer"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      <div
        data-testid="mascot-container"
        style={{
          position: "absolute",
          left: position.x,
          top: position.y,
          willChange: "transform, left, top",
          transition: state === "run" ? "none" : "left 0.05s linear, top 0.05s linear",
        }}
      >
        <CatSprite state={state} direction={direction} />
      </div>
    </div>,
    document.body
  );
};

export default React.memo(MascotLayer);
