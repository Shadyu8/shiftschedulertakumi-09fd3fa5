import React from "react";
import type { MascotState } from "./mascotStateMachine";

interface CatSpriteProps {
  state: MascotState;
  direction: number; // 1 = right, -1 = left
  size?: number;
}

/**
 * SVG orange tabby cat mascot with blue headband.
 * Structured for easy asset swap (replace SVG with sprite-sheet or Lottie).
 */
const CatSprite: React.FC<CatSpriteProps> = ({
  state,
  direction,
  size = 64,
}) => {
  const isRunning = state === "run";
  const isHiding = state === "hide";
  const isPeeking = state === "peek";
  const isEating = state === "eat";
  const isSleeping = state === "sleep";
  const isWalking = state === "walk";

  const scaleX = direction === -1 ? -1 : 1;
  const scale = isRunning ? 1.1 : 1;

  // Tail animation offset based on state
  const tailWag = isWalking || isRunning ? "mascot-tail-wag" : "";
  const eatBob = isEating ? "mascot-eat-bob" : "";
  const sleepPulse = isSleeping ? "mascot-sleep-pulse" : "";
  const walkBob = isWalking ? "mascot-walk-bob" : "";

  return (
    <div
      data-testid="cat-sprite"
      data-mascot-state={state}
      className={`${eatBob} ${sleepPulse} ${walkBob}`}
      style={{
        width: size,
        height: size,
        transform: `scaleX(${scaleX}) scale(${scale})`,
        transition: "transform 0.2s ease",
        filter: isRunning
          ? "drop-shadow(2px 4px 4px rgba(0,0,0,0.3))"
          : "drop-shadow(1px 2px 2px rgba(0,0,0,0.15))",
        opacity: isHiding ? 0.3 : isPeeking ? 0.7 : 1,
      }}
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Orange cat mascot"
      >
        {/* Tail */}
        <g className={tailWag}>
          <path
            d="M12 42 C6 36, 2 28, 8 24 C12 22, 14 26, 16 32"
            fill="none"
            stroke="#E8820C"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Tail stripes */}
          <path
            d="M10 34 C9 32, 9 30, 10 28"
            fill="none"
            stroke="#C46A00"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>

        {/* Body */}
        <ellipse cx="32" cy="44" rx="16" ry="12" fill="#F5A623" />
        {/* Body stripes */}
        <path
          d="M24 38 Q32 36 40 38"
          fill="none"
          stroke="#D4880E"
          strokeWidth="1.5"
        />
        <path
          d="M22 44 Q32 42 42 44"
          fill="none"
          stroke="#D4880E"
          strokeWidth="1.5"
        />

        {/* Head */}
        <circle cx="32" cy="26" r="14" fill="#F5A623" />

        {/* Ears */}
        <polygon points="20,16 16,4 26,14" fill="#F5A623" />
        <polygon points="44,16 48,4 38,14" fill="#F5A623" />
        {/* Inner ears */}
        <polygon points="21,15 18,7 25,14" fill="#FBBF6E" />
        <polygon points="43,15 46,7 39,14" fill="#FBBF6E" />

        {/* Forehead stripes (tabby markings) */}
        <path
          d="M28 18 L32 14 L36 18"
          fill="none"
          stroke="#C46A00"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M26 20 L32 16 L38 20"
          fill="none"
          stroke="#C46A00"
          strokeWidth="1"
          strokeLinecap="round"
        />

        {/* Blue headband */}
        <path
          d="M18 19 Q32 15 46 19"
          fill="none"
          stroke="#4A90D9"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Headband knot */}
        <circle cx="46" cy="19" r="2.5" fill="#4A90D9" />
        <path
          d="M47 17 L51 13"
          stroke="#4A90D9"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M47 21 L50 24"
          stroke="#4A90D9"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Muzzle (white area) */}
        <ellipse cx="32" cy="30" rx="7" ry="5" fill="#FFF5E6" />

        {/* Eyes */}
        {isSleeping ? (
          <>
            {/* Closed eyes for sleep */}
            <path
              d="M25 25 Q27 27 29 25"
              fill="none"
              stroke="#3D2B1F"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M35 25 Q37 27 39 25"
              fill="none"
              stroke="#3D2B1F"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            {/* Big mascot-style eyes */}
            <ellipse cx="27" cy="25" rx="3.5" ry="4" fill="white" />
            <ellipse cx="37" cy="25" rx="3.5" ry="4" fill="white" />
            <ellipse cx="27.5" cy="25.5" rx="2" ry="2.5" fill="#3D2B1F" />
            <ellipse cx="37.5" cy="25.5" rx="2" ry="2.5" fill="#3D2B1F" />
            {/* Eye shine */}
            <circle cx="28.5" cy="24" r="1" fill="white" />
            <circle cx="38.5" cy="24" r="1" fill="white" />
          </>
        )}

        {/* Nose */}
        <ellipse cx="32" cy="29" rx="1.5" ry="1" fill="#FF8A9E" />

        {/* Mouth */}
        <path
          d="M30 31 Q32 33 34 31"
          fill="none"
          stroke="#3D2B1F"
          strokeWidth="0.8"
          strokeLinecap="round"
        />

        {/* Whiskers */}
        <line
          x1="18"
          y1="28"
          x2="25"
          y2="29"
          stroke="#D4880E"
          strokeWidth="0.7"
        />
        <line
          x1="18"
          y1="31"
          x2="25"
          y2="31"
          stroke="#D4880E"
          strokeWidth="0.7"
        />
        <line
          x1="39"
          y1="29"
          x2="46"
          y2="28"
          stroke="#D4880E"
          strokeWidth="0.7"
        />
        <line
          x1="39"
          y1="31"
          x2="46"
          y2="31"
          stroke="#D4880E"
          strokeWidth="0.7"
        />

        {/* Front paws */}
        <ellipse cx="25" cy="54" rx="4" ry="3" fill="#F5A623" />
        <ellipse cx="39" cy="54" rx="4" ry="3" fill="#F5A623" />

        {/* Ramen bowl (only when eating) */}
        {isEating && (
          <g role="presentation" aria-label="Ramen bowl">
            <ellipse cx="32" cy="56" rx="10" ry="4" fill="#FFF" stroke="#E8820C" strokeWidth="1" />
            <path
              d="M24 54 Q28 48 32 54 Q36 48 40 54"
              fill="none"
              stroke="#D4880E"
              strokeWidth="1"
              opacity="0.6"
            />
            {/* Steam */}
            <path
              d="M28 48 Q29 44 28 40"
              fill="none"
              stroke="#ccc"
              strokeWidth="0.8"
              opacity="0.5"
              className="mascot-steam"
            />
            <path
              d="M34 47 Q35 43 34 39"
              fill="none"
              stroke="#ccc"
              strokeWidth="0.8"
              opacity="0.5"
              className="mascot-steam"
              style={{ animationDelay: "0.5s" }}
            />
          </g>
        )}

        {/* Sleep Zzz */}
        {isSleeping && (
          <g className="mascot-zzz">
            <text x="42" y="16" fontSize="8" fill="#4A90D9" fontWeight="bold">
              z
            </text>
            <text x="48" y="10" fontSize="6" fill="#4A90D9" fontWeight="bold">
              z
            </text>
            <text x="52" y="5" fontSize="5" fill="#4A90D9" fontWeight="bold">
              z
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export default React.memo(CatSprite);
