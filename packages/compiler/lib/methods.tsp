namespace TypeSpec.ValueMethods;

interface Array<TElementType> {
  someOf(cb: Private.BooleanReturnCb<TElementType>): boolean;
  allOf(cb: Private.BooleanReturnCb<TElementType>): boolean;
  noneOf(cb: Private.BooleanReturnCb<TElementType>): boolean;
  find(cb: Private.BooleanReturnCb<TElementType>): TElementType | void;
  contains(value: TElementType): boolean;
  first(n: numeric): TElementType[];
  last(n: numeric): TElementType[];
  sum(cb?: Private.NumericReturnCb<TElementType>): numeric;

  /**
   * Return the minimum value in the array. Optionally pass a callback to select the value to compare.
   */
  min(cb?: Private.NumericReturnCb<TElementType>): numeric;

  /**
   * Return the maximum value in the array. Optionally pass a callback to select the value to compare.
   */
  max(cb?: Private.NumericReturnCb<TElementType>): numeric;
  distinct(): TElementType[];
  length(): numeric;
}

interface String {
  contains(value: string): boolean;
  startsWith(value: string): boolean;
  endsWith(value: string): boolean;
  slice(start: numeric, end?: numeric, unit?: StringUnit = StringUnit.utf16CodeUnit): string;
  concat(value: string): string;
  length(unit?: StringUnit = StringUnit.utf16CodeUnit): numeric;
}

enum StringUnit {
  codePoint,
  utf16CodeUnit,
  utf8CodeUnit,
  graphemeCluster,
}

namespace Private {
  op BooleanReturnCb<T>(value: T): boolean;
  op NumericReturnCb<T>(value: T): numeric;
}
