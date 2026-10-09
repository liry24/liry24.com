import type { RequestEvent } from 'nuxt/server'

type CloudflareContext = { env: Record<string, unknown> }

export const getCloudflareEnvironment = <Environment>(
    event?: Pick<RequestEvent, 'context'>,
    platformContext?: object,
) => {
    const context = (event?.context ?? platformContext) as Record<string, unknown> | undefined
    const cloudflare = context?.cloudflare as CloudflareContext | undefined
    const platform = context?._platform as { cloudflare?: CloudflareContext } | undefined

    // The module-worker entry exposes bindings through `process.env`. Prefer the
    // request context when it is available so local development stays compatible.
    return (cloudflare?.env ??
        platform?.cloudflare?.env ??
        context?.env ??
        process.env) as Environment
}
