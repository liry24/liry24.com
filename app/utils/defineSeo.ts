import { defineOgImage } from '#imports'

type OgImageInput = {
    component: Parameters<typeof defineOgImage>[0]
    props?: Parameters<typeof defineOgImage>[1]
    options?: Parameters<typeof defineOgImage>[2]
}

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
        meta: [{ property: 'og:type', content: type || 'website' }],
        link: [{ rel: 'icon', href: '/favicon.ico' }],
    })
    if (image) defineOgImage(image.component, image.props, image.options)
}
