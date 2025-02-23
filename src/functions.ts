import { z, ZodSchema } from "zod"
import { error, Result, SerializableResult, success } from "./types"

export const exists = <T>(value: T | undefined): value is T => value !== undefined

/** @deprecated Unwraps the result, returning the value if it is a success, or the default value if it is an error.
 * This should not be used unless you really don't care about a potential error state */
export const unwrap = <T>(result: SerializableResult<T> | undefined, defaultValue: T): T => {
    if (result === undefined) {
        return defaultValue
    }

    if (result.status === "error") {
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
            return error<T>(errMessage, e.stack)
        }
        return error<T>(errMessage)
    }
}

export const tryCatchAsync = async <T>(fn: () => Promise<T>, errorMessage?: string): Promise<SerializableResult<T>> => {
    const defaultErrorMessage = "An error occurred"
    try {
        return success(await fn())
    } catch (e) {
        if (e instanceof Error) {
            return error<T>(errorMessage ?? e.message ?? defaultErrorMessage, e.stack)
        }
        return error<T>(errorMessage ?? defaultErrorMessage)
    }
}

export const parseSchema = <T extends ZodSchema>(object: unknown, schema: T, errorMessage: string = "Failed to parse schema"): SerializableResult<z.infer<T>> =>
    tryCatch(() => schema.parse(object), errorMessage)

export const stringify = (data: unknown): SerializableResult<string> => tryCatch(() => JSON.stringify(data, null, 2))

export const parse = (data: string): SerializableResult<unknown> => tryCatch(() => JSON.parse(data))

export const flattenErrors = <T>(results: SerializableResult<T>[]): SerializableResult<T[]> => {
    const errors = results.filter(result => result.status !== "success")
    if (errors.length > 0) {
        return error(
            errors.map(error => error.message).join("; "),
            errors.map(error => error.stackTrace ?? "No trace").join(";\n")
        )
    }
    return success(results.map(result => (result.status === "success" ? result.data : undefined)).filter(exists))
}

export const deserializeResult = <T>(result: SerializableResult<T>): Result<T> => {
    if (result.status === "success") return success(result.data, result.message)
    return error(result.message, result.stackTrace, result.errorType)
}
