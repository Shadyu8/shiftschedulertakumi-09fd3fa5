import React, { useEffect, useId, useRef } from "react";
import { useMascot } from "@/contexts/MascotContext";

interface MascotSpotProps {
  children: React.ReactNode;
}

/**
 * Wrap any UI element to register it as a potential "hiding spot" for the mascot.
 * The cat can hide behind, peek out from, or wander near these elements.
 */
const MascotSpot: React.FC<MascotSpotProps> = ({ children }) => {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const { registerSpot, unregisterSpot } = useMascot();

  useEffect(() => {
    registerSpot({
      id,
      getRect: () => ref.current?.getBoundingClientRect() ?? null,
    });
    return () => unregisterSpot(id);
  }, [id, registerSpot, unregisterSpot]);

  return (
    <div ref={ref} data-mascot-spot={id} style={{ display: "contents" }}>
      {children}
    </div>
  );
};

export default MascotSpot;
