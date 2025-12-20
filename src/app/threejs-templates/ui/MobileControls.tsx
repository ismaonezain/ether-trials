'use client';

import { useEffect, useRef, useState } from 'react';
import { useInput } from '../core/Input';

export function MobileControls() {
  const { device, updateInput, input, toggleMode, mode } = useInput();

  if (device !== 'touch') return null;

  return (
    <div className="pointer-events-auto absolute bottom-8 left-8 right-8 flex items-end justify-between select-none">
      {/* Left: Movement Joystick */}
      <Joystick
        onChange={(x, y) => updateInput({ moveX: x, moveY: y })}
        style={{ aspectRatio: 1 }}
        className="flex-shrink-0"
      />

      {/* Right Container: Actions Stack + Look Joystick */}
      <div className="flex flex-col items-end gap-6">
        
        {/* Action Buttons Stack (Jump, Toggle View) */}
        <div className="flex flex-col items-center gap-3 mr-2">
          <ControlButton 
            label="JUMP" 
            active={input.jump}
            onPress={(v) => updateInput({ jump: v })} 
            className="h-16 w-16 bg-blue-500/20 border-2 border-blue-400/30"
          />
           <ControlButton 
            label={mode === 'first-person' ? '3P' : '1P'} 
            onClick={toggleMode} 
            className="h-12 w-12 text-[10px] bg-white/10"
          />
        </div>

        {/* Right: Look Joystick */}
        <Joystick
          onChange={(x, y) => updateInput({ lookX: x, lookY: y })}
          style={{ aspectRatio: 1 }}
          className="flex-shrink-0"
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 COMPONENTS                                 */
/* -------------------------------------------------------------------------- */

function Joystick({ onChange, style = {}, className = "" }: { onChange: (x: number, y: number) => void; style?: React.CSSProperties; className?: string }) {
  const radius = 50;
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const origin = useRef({ x: 0, y: 0 });

  const handleStart = (e: React.PointerEvent) => {
    e.preventDefault(); // Prevent scroll
    setActive(true);
    origin.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleMove = (e: React.PointerEvent) => {
    if (!active) return;
    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(distance, radius);
    const angle = Math.atan2(dy, dx);
    
    const x = Math.cos(angle) * clampedDist;
    const y = Math.sin(angle) * clampedDist;

    setPos({ x, y });
    // Normalize -1 to 1, invert Y for "up"
    onChange(x / radius, -(y / radius));
  };

  const handleEnd = (e: React.PointerEvent) => {
    setActive(false);
    setPos({ x: 0, y: 0 });
    onChange(0, 0);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  return (
    <div
      ref={ref}
      className={`relative h-32 w-32 rounded-full bg-white/10 backdrop-blur-sm touch-none ${className}`}
      style={style}
      onPointerDown={handleStart}
      onPointerMove={handleMove}
      onPointerUp={handleEnd}
      onPointerCancel={handleEnd}
    >
      <div
        className="absolute left-1/2 top-1/2 h-12 w-12 -ml-6 -mt-6 rounded-full bg-white/50 shadow-lg transition-transform duration-75"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px)`,
        }}
      />
    </div>
  );
}

function ControlButton({ 
  label, 
  active = false, 
  onPress, 
  onClick,
  className = ""
}: { 
  label: string, 
  active?: boolean, 
  onPress?: (v: boolean) => void,
  onClick?: () => void,
  className?: string
}) {
  return (
    <button
      className={`rounded-full text-xs font-bold tracking-wider shadow-sm backdrop-blur-sm transition-all
        ${active ? 'scale-95 bg-blue-600 text-white' : 'text-white/90 active:scale-95'}
        ${className}
      `}
      onPointerDown={(e) => { e.preventDefault(); onPress?.(true); onClick?.(); }}
      onPointerUp={(e) => { e.preventDefault(); onPress?.(false); }}
      onPointerLeave={() => onPress?.(false)}
    >
      {label}
    </button>
  );
}
