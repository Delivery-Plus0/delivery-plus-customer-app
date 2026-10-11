import { useCallback, useRef, useState, type ReactNode } from 'react';

import { Dialog } from '@/components/ui/dialog';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Ids: `<testID>`, `<testID>-confirm`, `<testID>-cancel`. */
  testID?: string;
};

/**
 * Promise-based confirmation through the kit Dialog (#155): `const ok = await confirm({...})`. Render the
 * returned element once in the screen. Replaces the native Alert / window.confirm, which looked different
 * on each platform and couldn't be reached by screen readers or E2E flows.
 */
export function useConfirm(): [ReactNode, (options: ConfirmOptions) => Promise<boolean>] {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    // A second request answers the first one "no" rather than leaving it pending.
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const answer = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  };

  const element = options ? (
    <Dialog
      visible
      title={options.title}
      message={options.message}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      destructive={options.destructive}
      onConfirm={() => answer(true)}
      onCancel={() => answer(false)}
      testID={options.testID ?? 'confirm-dialog'}
    />
  ) : null;

  return [element, confirm];
}
