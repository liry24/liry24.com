import type { H3Event } from 'h3'

export const getCloudflareEnvironment = <Environment>(event?: H3Event) => {
    const cloudflare = event?.context.cloudflare ?? event?.context._platform?.cloudflare

    // The module-worker entry exposes bindings through `process.env`. Prefer the
    // request context when it is available so local development stays compatible.
    return (cloudflare?.env ?? process.env) as Environment
}
