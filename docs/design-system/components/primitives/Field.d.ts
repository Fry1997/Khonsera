import * as React from 'react';

/**
 * The one text input. Crisp 4px card-stock well with a gold focus ring. Pass an
 * `Icon` to tuck a leading glyph inside, a mono `label` above, and a `hint`
 * below. Spreads native input attributes (value, onChange, placeholder, type…).
 *
 * @example
 * <Field label="Booking reference" placeholder="e.g. KH-4XQ2" />
 * <Field icon={<Icon name="pin" size={15} />} placeholder="Search a place" />
 */
export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Uppercase mono eyebrow rendered above the field. */
  label?: string;
  /** Leading glyph tucked inside the well, e.g. <Icon name="pin" />. */
  icon?: React.ReactNode;
  /** Helper text below the field. */
  hint?: React.ReactNode;
}

export declare function Field(props: FieldProps): JSX.Element;
