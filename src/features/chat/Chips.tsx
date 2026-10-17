import type { Chip } from '@/engine/types';
import { useTx } from '@/i18n/useTx';
import { useAgentStore } from '@/agentStore';

/** Quick replies under the last assistant message. Always at least three, so the demo never dead-ends. */
export function Chips({ chips, disabled }: { chips: Chip[]; disabled?: boolean }) {
  const { tx } = useTx();
  return (
    <div className="flex flex-wrap gap-2 pl-10" role="group">
      {chips.map((c, i) => (
        <button
          key={i} type="button" disabled={disabled}
          onClick={() => void useAgentStore.getState().send(tx(c.send))}
          className="min-h-[40px] rounded-full border border-secline bg-white px-3.5 text-[13px] font-medium text-primary hover:bg-bluewash disabled:opacity-50"
        >
          {tx(c.label)}
        </button>
      ))}
    </div>
  );
}
