import { z, ZodSchema } from "zod"
import { error, Result, SerializableResult, success } from "./types"

export const exists = <T>(value: T | undefined): value is T => value !== undefined

export const unwrap = <T>(result: SerializableResult<T> | undefined, defaultValue: T): T => {
    if (result === undefined) {
        return defaultValue
    }

    if (result.status === "error") {
        console.error(result.message, result.error)
        return defaultValue
    }

    return result.data
}

export const tryCatch = <T>(fn: () => T, errorMessage?: string): SerializableResult<T> => {
    const errMessage = errorMessage ?? "An error occurred"
    try {
        return success(fn())
    } catch (e) {
        if (e instanceof Error) {
            return error<T>(errMessage, e)
        }
        return error<T>(errMessage)
    }
}

export const tryCatchAsync = async <T>(fn: () => Promise<T>, errorMessage?: string): Promise<SerializableResult<T>> => {
    const errMessage = errorMessage ?? "An error occurred"
    try {
        return success(await fn())
    } catch (e) {
        if (e instanceof Error) {
            return error<T>(errMessage, e)
        }
        return error<T>(errMessage)
    }
}

export const parseSchema = <T extends ZodSchema>(object: unknown, schema: T): SerializableResult<z.infer<T>> =>
    tryCatch(() => schema.parse(object), "Failed to parse schema")

export const stringify = (data: unknown): SerializableResult<string> => tryCatch(() => JSON.stringify(data, null, 2))

export const parse = (data: string): SerializableResult<unknown> => tryCatch(() => JSON.parse(data))

export const flattenErrors = <T>(results: SerializableResult<T>[]): SerializableResult<T[]> => {
    const errors = results.filter(result => result.status !== "success")
    if (errors.length > 0) {
        return error(
            errors.map(error => error.message).join(", "),
            new Error(errors.map(error => error.error?.stack ?? error.error?.message ?? error.message).join("\n"))
        )
    }
    return success(results.map(result => (result.status === "success" ? result.data : undefined)).filter(exists))
}

export const deserializeResult = <T>(result: SerializableResult<T>): Result<T> => {
    if (result.status === "success") return success(result.data, result.message)
    return error(result.message, result.error, result.errorType)
}
