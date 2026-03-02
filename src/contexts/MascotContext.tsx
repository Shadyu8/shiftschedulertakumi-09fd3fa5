import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type MascotState,
  type MascotPosition,
  type MascotConfig,
  defaultConfig,
  clampPosition,
  moveToward,
  getNextEatInterval,
  getEatDuration,
} from "@/components/mascot/mascotStateMachine";

const CAT_SIZE = 64;

interface HidingSpot {
  id: string;
  getRect: () => DOMRect | null;
}

interface MascotContextValue {
  state: MascotState;
  position: MascotPosition;
  direction: number;
  registerSpot: (spot: HidingSpot) => void;
  unregisterSpot: (id: string) => void;
  config: MascotConfig;
}

const MascotContext = createContext<MascotContextValue | null>(null);

export function useMascot() {
  const ctx = useContext(MascotContext);
  if (!ctx) throw new Error("useMascot must be used inside MascotProvider");
  return ctx;
}

export const MascotProvider: React.FC<{
  children: React.ReactNode;
  config?: Partial<MascotConfig>;
}> = ({ children, config: userConfig }) => {
  const cfg = { ...defaultConfig, ...userConfig };
  const configRef = useRef(cfg);
  configRef.current = cfg;

  const [state, setState] = useState<MascotState>("idle");
  const [position, setPosition] = useState<MascotPosition>(() => ({
    x: 40,
    y: typeof window !== "undefined" ? window.innerHeight - CAT_SIZE - cfg.footerPadding - 20 : 400,
  }));
  const [direction, setDirection] = useState(1);

  const spotsRef = useRef<Map<string, HidingSpot>>(new Map());
  const targetRef = useRef<MascotPosition | null>(null);
  const stateRef = useRef<MascotState>("idle");
  const posRef = useRef(position);
  const animFrameRef = useRef<number>(0);
  const lastInteractionRef = useRef<MascotPosition | null>(null);
  const eatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  stateRef.current = state;
  posRef.current = position;

  // Helper to create tracked timeouts that are cleaned up on unmount
  const safeTimeout = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      pendingTimersRef.current.delete(id);
      fn();
    }, delay);
    pendingTimersRef.current.add(id);
    return id;
  }, []);

  const registerSpot = useCallback((spot: HidingSpot) => {
    spotsRef.current.set(spot.id, spot);
  }, []);

  const unregisterSpot = useCallback((id: string) => {
    spotsRef.current.delete(id);
  }, []);

  // Schedule periodic eating
  const scheduleEat = useCallback(() => {
    if (eatTimerRef.current) clearTimeout(eatTimerRef.current);
    eatTimerRef.current = safeTimeout(() => {
      if (stateRef.current === "idle" || stateRef.current === "walk") {
        setState("eat");
        const duration = getEatDuration(configRef.current);
        safeTimeout(() => {
          if (stateRef.current === "eat") {
            setState("idle");
          }
          scheduleEat();
        }, duration);
      } else {
        scheduleEat();
      }
    }, getNextEatInterval(configRef.current));
  }, [safeTimeout]);

  // Movement loop using requestAnimationFrame
  useEffect(() => {
    let running = true;

    const tick = () => {
      if (!running) return;
      const s = stateRef.current;
      const target = targetRef.current;

      if (target && (s === "walk" || s === "run")) {
        const speed =
          s === "run" ? configRef.current.runSpeed : configRef.current.walkSpeed;
        const result = moveToward(posRef.current, target, speed);
        const clamped = clampPosition(result.position, CAT_SIZE, configRef.current);
        posRef.current = clamped;
        setPosition(clamped);
        setDirection(result.direction);

        if (result.arrived) {
          targetRef.current = null;
          setState("idle");
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Track user interactions for "follow" behavior
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Avoid overlapping form inputs
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        return;
      }

      lastInteractionRef.current = { x: e.clientX, y: e.clientY };

      // Run across screen chance on CTA button click
      if (
        target.tagName === "BUTTON" ||
        target.closest("button") ||
        target.closest("a")
      ) {
        if (Math.random() < configRef.current.runChance) {
          setState("run");
          targetRef.current = clampPosition(
            {
              x: Math.random() * (window.innerWidth - CAT_SIZE),
              y: window.innerHeight - CAT_SIZE - configRef.current.footerPadding - 20,
            },
            CAT_SIZE,
            configRef.current
          );
          return;
        }
      }

      // Wander toward interaction region after delay
      if (stateRef.current === "idle") {
        safeTimeout(() => {
          if (stateRef.current !== "eat" && stateRef.current !== "sleep") {
            const offset = 60 + Math.random() * 80;
            targetRef.current = clampPosition(
              {
                x: e.clientX + (Math.random() > 0.5 ? offset : -offset),
                y: window.innerHeight - CAT_SIZE - configRef.current.footerPadding - 20,
              },
              CAT_SIZE,
              configRef.current
            );
            setState("walk");
          }
        }, 800 + Math.random() * 1200);
      }
    };

    const handleHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "BUTTON" ||
        target.closest("button") ||
        target.closest("a") ||
        target.closest("[data-mascot-spot]")
      ) {
        if (
          stateRef.current === "idle" &&
          Math.random() < configRef.current.hideChance
        ) {
          setState("hide");
          const rect =
            (target.closest("[data-mascot-spot]") || target).getBoundingClientRect();
          targetRef.current = clampPosition(
            {
              x: rect.left - CAT_SIZE / 2,
              y: rect.bottom - CAT_SIZE,
            },
            CAT_SIZE,
            configRef.current
          );
          setState("walk");

          // Peek after arriving
          safeTimeout(() => {
            if (stateRef.current === "idle" || stateRef.current === "hide") {
              setState("peek");
              safeTimeout(() => {
                if (stateRef.current === "peek") {
                  setState("idle");
                }
              }, 2000);
            }
          }, 3000);
        }
      }
    };

    const handleScroll = () => {
      if (stateRef.current === "idle") {
        safeTimeout(() => {
          if (stateRef.current === "idle") {
            targetRef.current = clampPosition(
              {
                x: Math.random() * (window.innerWidth - CAT_SIZE),
                y: window.innerHeight - CAT_SIZE - configRef.current.footerPadding - 20,
              },
              CAT_SIZE,
              configRef.current
            );
            setState("walk");
          }
        }, 500 + Math.random() * 1000);
      }
    };

    window.addEventListener("click", handleClick, { passive: true });
    window.addEventListener("mouseover", handleHover, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("mouseover", handleHover);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [safeTimeout]);

  // Schedule eating on mount
  useEffect(() => {
    scheduleEat();
    return () => {
      if (eatTimerRef.current) clearTimeout(eatTimerRef.current);
      pendingTimersRef.current.forEach((id) => clearTimeout(id));
      pendingTimersRef.current.clear();
    };
  }, [scheduleEat]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => clampPosition(prev, CAT_SIZE, configRef.current));
    };
    window.addEventListener("resize", handleResize, { passive: true });
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <MascotContext.Provider
      value={{ state, position, direction, registerSpot, unregisterSpot, config: cfg }}
    >
      {children}
    </MascotContext.Provider>
  );
};
