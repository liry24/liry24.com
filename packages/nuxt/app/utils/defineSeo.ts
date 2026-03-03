import type { OgImageComponents } from '#og-image/components'

type OgImageInput = {
    [T in keyof OgImageComponents]: {
        component: T
        props?: Parameters<typeof defineOgImage<T>>[1]
        options?: Parameters<typeof defineOgImage<T>>[2]
    }
}[keyof OgImageComponents]

export default ({
    title,
    titleTemplate,
    description,
    image,
    type,
    twitterCard,
}: {
    title?: string
    titleTemplate?: string
    description?: string
    image?: OgImageInput
    type?: 'website' | 'article'
    twitterCard?: 'summary' | 'summary_large_image'
}) => {
    useSeoMeta({
        title: title,
        ogTitle: title,
        titleTemplate: titleTemplate,
        description: description,
        ogDescription: description,
        twitterTitle: title,
        twitterDescription: description,
        twitterCard: twitterCard || 'summary_large_image',
    })
    useHead({
        meta: [{ property: 'og:type', content: type || 'article' }],
        link: [{ rel: 'icon', href: '/favicon.ico' }],
    })
    if (image) defineOgImage(image.component, image.props, image.options)
}
