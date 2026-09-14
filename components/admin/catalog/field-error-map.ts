export type FieldErrors = Record<string, string>;

export function fieldErrorMap(
  errors?: Array<{ field: string; message: string }>,
): FieldErrors {
  const map: FieldErrors = {};
  errors?.forEach((error) => {
    if (!map[error.field]) {
      map[error.field] = error.message;
    }
  });
  return map;
}
