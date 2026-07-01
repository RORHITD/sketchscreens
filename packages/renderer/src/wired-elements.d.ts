import type { DetailedHTMLProps, HTMLAttributes } from "react";

/**
 * Minimal JSX typings for the wired-elements Web Components we use. React 19
 * renders custom elements natively; these declarations just let TSX accept the
 * tags and their handful of attributes without `any`.
 */
type WiredProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  elevation?: number | string;
  disabled?: boolean;
  // wired-elements are custom elements; `class` maps straight to the attribute.
  class?: string;
};

type WiredInputProps = WiredProps & { placeholder?: string; value?: string; type?: string };
type WiredCheckboxProps = WiredProps & { checked?: boolean; text?: string };
type WiredComboProps = WiredProps & { value?: string; selected?: string };

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "wired-card": WiredProps;
      "wired-input": WiredInputProps;
      "wired-textarea": WiredInputProps & { rows?: number };
      "wired-button": WiredProps;
      "wired-checkbox": WiredCheckboxProps;
      "wired-radio": WiredCheckboxProps & { name?: string };
      "wired-toggle": WiredProps & { checked?: boolean };
      "wired-combo": WiredComboProps;
      "wired-listbox": WiredComboProps;
      "wired-item": WiredProps & { value?: string };
      "wired-divider": WiredProps;
      "wired-image": WiredProps & { src?: string; width?: number; height?: number };
    }
  }
}
