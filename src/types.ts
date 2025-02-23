type ErrorType = "unexpected" | "user-validation" | "unauthorized" | "not-found"

export const statusFromErrorType: Record<ErrorType, number> = {
    unexpected: 503,
    "user-validation": 400,
    unauthorized: 401,
    "not-found": 404
} as const

export type SerializableResult<T> =
    | {
          status: "success"
          message?: string
          data: T
          requestId?: string
      }
    | {
          status: "error"
          errorType: ErrorType
          message: string
          stackTrace?: string
          requestId?: string
      }

type ResultFunctions<T> = {
    map: <TAfter>(fn: (value: T) => TAfter) => Result<TAfter>
    mapAsync: <TAfter>(fn: (value: T) => Promise<TAfter>) => Promise<Result<TAfter>>
    flatMap: <TAfter>(fn: (value: T) => Result<TAfter>) => Result<TAfter>
    flatMapAsync: <TAfter>(fn: (value: T) => Promise<Result<TAfter>>) => Promise<Result<TAfter>>
    catch: (fn: (value: Extract<Result<T>, { type: "error" }>) => Result<T>) => Result<T>
    fold: <TAfter>(foldFn: { onSuccess: (value: T) => TAfter; onError: (error: ErrorSerializableResult<T>) => TAfter }) => TAfter
    serialize: () => SerializableResult<T>
}

export type Result<T> = SerializableResult<T> & ResultFunctions<T>

export type ErrorResult<T> = Extract<Result<T>, { status: "error" }>
export type ErrorSerializableResult<T> = Extract<SerializableResult<T>, { status: "error" }>
export type SuccessResult<T> = Extract<Result<T>, { status: "success" }>
export type SuccessSerializableResult<T> = Extract<SerializableResult<T>, { status: "success" }>

export const error = <T>(message: string, stackTrace?: string, errorType: ErrorType = "unexpected"): ErrorResult<T> => {
    const obj: ErrorSerializableResult<T> = {
        status: "error",
        errorType,
        message,
        stackTrace: stackTrace ?? new Error().stack
    }
    return {
        ...obj,
        ...buildFunctions(obj)
    }
}

export const userValidationError = <T>(message: string, e?: Error): ErrorResult<T> => error(message, e?.stack, "user-validation")

export const unauthorizedError = <T>(): ErrorResult<T> => error("Unauthorized", undefined, "unauthorized")

export const notFoundError = <T>(subject: string): ErrorResult<T> => error(`${subject} not found`, undefined, "not-found")

export const success = <T>(data: T, message?: string): SuccessResult<T> => {
    const obj: SuccessSerializableResult<T> = {
        status: "success",
        message,
        data
    }
    return {
        ...obj,
        ...buildFunctions(obj)
    }
}

const buildFunctions = <T>(result: SerializableResult<T>): ResultFunctions<T> => ({
    map: fn => map(result, fn),
    mapAsync: fn => mapAsync(result, fn),
    flatMap: fn => flatMap(result, fn),
    flatMapAsync: fn => flatMapAsync(result, fn),
    fold: foldFn => fold(result, foldFn),
    serialize: () => result,
    catch: fn => catchResult(result, fn)
})

/** @deprecated Unwraps the result, returning the value if it is a success, or the default value if it is an error.
 * This should not be used unless you really don't care about a potential error state */
export const unwrap = <T, TUnwrap extends T>(result: SerializableResult<T> | undefined, defaultValue: TUnwrap): T => {
    if (result !== undefined && result.status === "success") return result.data
    return defaultValue
}

const map = <TBefore, TAfter>(result: SerializableResult<TBefore>, fn: (value: TBefore) => TAfter): Result<TAfter> => {
    if (result.status === "success") {
        return success(fn(result.data))
    }
    return error(result.message, )
}

const mapAsync = async <TBefore, TAfter>(result: SerializableResult<TBefore>, fn: (value: TBefore) => Promise<TAfter>): Promise<Result<TAfter>> => {
    if (result.status === "success") {
        const res = await fn(result.data)
        return success(res)
    }
    return Promise.resolve(error<TAfter>(result.message, result.stackTrace))
}

const flatMap = <TBefore, TAfter>(result: SerializableResult<TBefore>, fn: (value: TBefore) => Result<TAfter>): Result<TAfter> => {
    if (result.status === "success") {
        return fn(result.data)
    }
    return error<TAfter>(result.message, result.stackTrace, result.errorType)
}

const flatMapAsync = <TBefore, TAfter>(result: SerializableResult<TBefore>, fn: (value: TBefore) => Promise<Result<TAfter>>): Promise<Result<TAfter>> => {
    if (result.status === "success") {
        return fn(result.data)
    }
    return Promise.resolve(error<TAfter>(result.message, result.stackTrace, result.errorType))
}

const catchResult = <TBefore>(
    result: SerializableResult<TBefore>,
    fn: (value: Extract<Result<TBefore>, { status: "error" }>) => Result<TBefore>
): Result<TBefore> => {
    if (result.status === "error") {
        return fn(error(result.message, result.stackTrace, result.errorType))
    }
    return success(result.data, result.message)
}

const fold = <TSuccess, TFinal>(
    result: SerializableResult<TSuccess>,
    foldFn: {
        onSuccess: (value: TSuccess) => TFinal
        onError: (err: ErrorSerializableResult<TSuccess>) => TFinal
    }
): TFinal => {
    if (result.status === "success") {
        return foldFn.onSuccess(result.data)
    }
    return foldFn.onError(result)
}
