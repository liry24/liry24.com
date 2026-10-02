import type { H3Event } from 'h3'

type CloudflareRequestContext = {
    request: Request
    env: Record<string, unknown>
    context: {
        waitUntil(promise: Promise<unknown>): void
    }
}

type CloudflarePlatform = {
    cf?: unknown
    cloudflare?: CloudflareRequestContext
}

const getCloudflarePlatform = (event: H3Event) =>
    event.context._platform as CloudflarePlatform | undefined

const getEventCloudflareContext = (event: H3Event) =>
    event.context.cloudflare as CloudflareRequestContext | undefined

export const getCloudflareEnvironment = <Environment>(event: H3Event) => {
    const cloudflare = getEventCloudflareContext(event) ?? getCloudflarePlatform(event)?.cloudflare

    // The module-worker entry exposes bindings through `process.env`. Prefer the
    // request context when it is available so local development stays compatible.
    return (cloudflare?.env ?? process.env) as unknown as Environment
}

export const attachCloudflareContext = (event: H3Event) => {
    const platform = getCloudflarePlatform(event)
    const cloudflare = platform?.cloudflare
    if (!cloudflare) return

    // Nitro's module-worker entry provides bindings at `_platform.cloudflare`.
    // Keep the request context aligned with Nitro's development preset, which
    // exposes the same object at `event.context.cloudflare`.
    event.context.cf ??= platform.cf
    event.context.waitUntil ??= cloudflare.context.waitUntil.bind(cloudflare.context)
    event.context.cloudflare ??= cloudflare
}
