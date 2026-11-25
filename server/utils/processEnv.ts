export function readProcessEnv(key: string): string | undefined {
    const runtimeProcess: unknown = process
    if (
        typeof runtimeProcess !== 'object' ||
        runtimeProcess === null ||
        !('env' in runtimeProcess)
    ) {
        return undefined
    }

    const { env } = runtimeProcess
    if (typeof env !== 'object' || env === null) {
        return undefined
    }

    const value: unknown = Object.getOwnPropertyDescriptor(env, key)?.value
    return typeof value === 'string' ? value : undefined
}
