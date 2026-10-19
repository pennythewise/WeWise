import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppIcon } from './AppIcon';

type Side = 'left' | 'right' | 'bottom';

const SIDE_CLASS: Record<Side, string> = {
  left: 'left-0 top-0 h-dvh w-[min(86vw,320px)] data-[state=open]:animate-in-left data-[state=closed]:animate-out-left',
  right: 'right-0 top-0 h-dvh w-[min(100vw,var(--inspector-width))] data-[state=open]:animate-in-right data-[state=closed]:animate-out-right',
  bottom:
    'bottom-0 left-0 right-0 mx-auto w-full max-w-[640px] rounded-t-shell transition-[height] duration-200 data-[state=open]:animate-in-bottom data-[state=closed]:animate-out-bottom',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: Side;
  title: string;
  /** Visually hide the title (a heading is already inside children). */
  hideTitle?: boolean;
  /** Bottom sheets only: CSS height. */
  height?: string;
  /** Extra header content (e.g. snap handle) rendered above the title row. */
  top?: ReactNode;
  children: ReactNode;
}

/** Radix Dialog presented as a side/bottom sheet: focus trap, Esc to close, restored focus. */
export function Sheet({ open, onOpenChange, side, title, hideTitle, height, top, children }: Props) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
        <Dialog.Content
          aria-describedby={undefined}
          style={side === 'bottom' ? { height } : undefined}
          className={`fixed z-50 flex flex-col bg-white shadow-card outline-none ${SIDE_CLASS[side]}`}
        >
          {top}
          <div className="flex min-h-[56px] shrink-0 items-center justify-between border-b border-cardline pl-5 pr-2">
            <Dialog.Title className={hideTitle ? 'sr-only' : 'text-[17px] font-semibold text-ink'}>{title}</Dialog.Title>
            <Dialog.Close className="icon-btn ml-auto" aria-label={t('nav.close')}>
              <AppIcon name="close" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
