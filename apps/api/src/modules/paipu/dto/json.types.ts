export type JsonPrimitive = string | number | boolean | null | undefined
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[]
export interface JsonObject {
    readonly [key: string]: JsonValue
}
