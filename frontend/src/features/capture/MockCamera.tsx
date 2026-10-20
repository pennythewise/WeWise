import wide from '@/assets/evidence/wide.jpg';
import damage from '@/assets/evidence/damage.jpg';
import plate from '@/assets/evidence/plate.jpg';
import scene from '@/assets/evidence/scene.jpg';

/** AI-generated stand-in photos for the four AR steps (fictional car, plate and street; no real person or vehicle). */
export const MOCK_SHOTS: Record<string, string> = { wide, damage, plate, scene };

/**
 * Simulated phone camera for demos without a usable camera (or with ?mockcam=1): the step's photo with a slow
 * handheld sway, and an out-of-focus, slightly off-frame view that settles into focus when the AR guide turns green.
 */
export function MockCamera({ stepId, ready }: { stepId: string; ready: boolean }) {
  const src = MOCK_SHOTS[stepId] ?? wide;
  return (
    <div className="h-full w-full motion-safe:animate-handheld" data-testid="mock-camera">
      <img
        key={stepId}
        src={src}
        alt=""
        draggable={false}
        className="h-full w-full select-none object-cover transition-[filter,transform] duration-[1200ms] ease-out"
        style={{ filter: ready ? 'blur(0px) saturate(1)' : 'blur(6px) saturate(0.9)', transform: ready ? 'scale(1.04) translate(0,0)' : 'scale(1.12) translate(2%, -2%)' }}
      />
    </div>
  );
}

/** Stand-in photo for a step, used as the shot's thumbnail when there is no real camera frame. */
export const mockShot = (stepId: string) => MOCK_SHOTS[stepId];
