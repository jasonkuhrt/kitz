/**
 * Minimal JSON value types for typing file content.
 *
 * Relocated from `@kitz/json` (the only symbol fs used was the `Json.Object`
 * type) during the `@kitz/effect` consolidation.
 */

/** JSON primitive: string, number, boolean, or null. */
export type JsonPrimitive = string | number | boolean | null

/** JSON object with string keys and JSON values. */
export type JsonObject = { [key in string]?: JsonValue }

/** Any valid JSON value: a primitive, object, or array (recursive). */
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
