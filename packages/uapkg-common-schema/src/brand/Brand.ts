/**
 * Nominal (branded) type utility.
 *
 * Brands a base type `T` with a unique phantom tag `B` so that
 * two structurally identical types remain incompatible at compile time.
 *
 * @example
 * type PackageName = Brand<string, 'PackageName'>;
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };
