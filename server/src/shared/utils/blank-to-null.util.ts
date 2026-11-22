import { TransformFnParams } from 'class-transformer';

/**
 * For optional free-text DTO fields, used as `@Transform(blankToNull)`.
 *
 * A form field the user emptied arrives as "" (or spaces). Stored as-is it
 * reads as a real value: on a unique column the second blank one collides
 * ("already exists"), and the UI shows an empty cell instead of "-". Trimmed
 * to nothing it becomes NULL, which on PATCH also means "clear this field".
 */
export const blankToNull = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() || null : value;
