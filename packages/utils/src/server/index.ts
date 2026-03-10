import { destr } from 'destr'
import sanitizeHtml from 'sanitize-html'
import type { z } from 'zod'

export { getReasonPhrase, StatusCodes } from 'http-status-codes'

export const sanitizeObject = <T>(obj: T): T => {
    if (typeof obj === 'string')
        return sanitizeHtml(obj, {
            allowedTags: [
                'span',
                'div',
                'ul',
                'ol',
                'li',
                'p',
                'br',
                'b',
                'strong',
                'em',
                'u',
                'h1',
                'h2',
                'h3',
                'h4',
                'h5',
                'h6',
                'ul',
                'ol',
                'li',
                'blockquote',
                'a',
                'img',
                'code',
                'pre',
                'table',
                'thead',
                'tbody',
                'tr',
                'th',
                'td',
            ],
            allowedAttributes: {
                a: ['href', 'target'],
                img: ['src', 'alt', 'title', 'width', 'height'],
            },
            allowedSchemes: ['http', 'https', 'mailto'],
            disallowedTagsMode: 'discard',
        }) as T

    if (Array.isArray(obj)) return obj.map((item) => sanitizeObject(item)) as T

    if (obj && typeof obj === 'object' && obj !== null) {
        const sanitizedObj = {} as Record<string, unknown>
        for (const [key, value] of Object.entries(obj)) sanitizedObj[key] = sanitizeObject(value)

        return sanitizedObj as T
    }

    return obj
}

export const validateBody = async <T extends z.ZodTypeAny>(
    schema: T,
    options?: { sanitize?: boolean }
): Promise<z.infer<T>> => {
    const result = await readValidatedBody(useEvent(), (body) => {
        if (options?.sanitize) body = sanitizeObject(body)

        return schema.safeParse(body)
    })

    if (!result.success) {
        if (import.meta.dev) console.error(result.error)
        throw createError({
            status: 400,
            statusText: 'Validation Error',
        })
    }

    return result.data
}

export const validateFormData = async <T extends z.ZodTypeAny>(schema: T): Promise<z.infer<T>> => {
    const formData = await readFormData(useEvent())

    const dataToValidate: Record<string, unknown> = {}
    for (const [key, value] of formData.entries()) {
        dataToValidate[key] = destr(value)
    }

    const result = schema.safeParse(dataToValidate)

    if (!result.success) {
        if (import.meta.dev) console.error(result.error)
        throw createError({
            status: 400,
            statusText: 'Validation Error',
        })
    }

    return result.data
}

export const validateParams = async <T extends z.ZodTypeAny>(schema: T): Promise<z.infer<T>> => {
    const result = await getValidatedRouterParams(useEvent(), (body) => schema.safeParse(body))

    if (!result.success) {
        if (import.meta.dev) console.error(result.error)
        throw createError({
            status: 400,
            statusText: 'Validation Error',
        })
    }

    return result.data
}

export const validateQuery = async <T extends z.ZodTypeAny>(schema: T): Promise<z.infer<T>> => {
    const result = await getValidatedQuery(useEvent(), (query) => schema.safeParse(query))

    if (!result.success) {
        if (import.meta.dev) console.error(result.error)
        throw createError({
            status: 400,
            statusText: 'Validation Error',
        })
    }

    return result.data
}
