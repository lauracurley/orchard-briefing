import { Button as BaseButton } from '@base-ui/react/button';
import type { ComponentProps } from 'react';

type ButtonProps = ComponentProps<typeof BaseButton>;

// Project-owned component, following the shadcn/ui open-code pattern.
// Existing Orchard variants remain in globals.css while the shared base is adopted.
export function Button({ className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <BaseButton
      type={type}
      className={`ui-button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  );
}
