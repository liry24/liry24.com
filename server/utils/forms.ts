import { createError } from 'nuxt/server'
import { useAuth } from 'vite-hub/auth/server'

import { isAdminUser } from './auth.js'

const documentIdPattern = /^[a-zA-Z0-9_-]{1,120}$/

export async function authorizeAdminForm({ request }: { request: Request }): Promise<boolean> {
    const session = await useAuth(request).api.getSession({ headers: request.headers })
    return Boolean(session?.user && isAdminUser(session.user))
}

export function normalizeDocumentId(raw: string | undefined, fallback: string): string {
    if (typeof raw === 'string' && raw.trim().length > 0) {
        const trimmed = raw.trim()
        if (!documentIdPattern.test(trimmed)) {
            throw createError({
                status: 400,
                statusText: 'Invalid document ID',
                message: 'Document ID may only contain letters, numbers, underscores, and hyphens.',
            })
        }
        return trimmed
    }

    const sanitized = fallback
        .trim()
        .toLowerCase()
        .replaceAll(/[^a-z0-9_-]+/gu, '-')
        .replaceAll(/^-+|-+$/gu, '')
        .slice(0, 100)

    return sanitized || crypto.randomUUID()
}

function extractErrorStatus(error: unknown): number {
    if (error && typeof error === 'object') {
        if ('code' in error && error.code === 'WORKSPACE_CONFLICT') return 409

        if ('status' in error && typeof error.status === 'number') return error.status

        if ('statusCode' in error && typeof error.statusCode === 'number') return error.statusCode
    }
    return 500
}

function extractErrorMessage(error: unknown): string {
    if (error && typeof error === 'object') {
        if ('data' in error && error.data && typeof error.data === 'object') {
            if ('message' in error.data && typeof error.data.message === 'string')
                return error.data.message
        }
        if ('statusText' in error && typeof error.statusText === 'string' && error.statusText)
            return error.statusText

        if ('message' in error && typeof error.message === 'string' && error.message)
            return error.message
    }
    return 'Could not save content.'
}

export function handleFormDomainError(error: unknown): Response {
    const status = extractErrorStatus(error)
    const message = extractErrorMessage(error)
    if (status >= 400 && status < 500) {
        return Response.json(
            {
                message,
                issues: [{ message, path: [] }],
            },
            { status },
        )
    }
    return Response.json({ message }, { status: 500 })
}
