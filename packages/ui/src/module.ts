import {
    addComponent,
    addComponentsDir,
    addImports,
    createResolver,
    defineNuxtModule,
} from '@nuxt/kit'

export interface LiryUiModuleOptions {
    prefix?: string
    css?: boolean
}

export default defineNuxtModule<LiryUiModuleOptions>({
    meta: {
        name: '@liry24/ui',
        configKey: 'liryUi',
        compatibility: {
            nuxt: '>=4.0.0',
        },
    },
    defaults: {
        prefix: 'Ui',
        css: true,
    },
    setup(options, nuxt) {
        const resolver = createResolver(import.meta.url)
        const prefix = options.prefix ?? 'Ui'

        if (!nuxt.options.build.transpile.includes('@liry24/ui'))
            nuxt.options.build.transpile.push('@liry24/ui')

        if (options.css !== false) {
            const stylesheet = resolver.resolve('./runtime/assets/styles.css')
            if (!nuxt.options.css.includes(stylesheet)) nuxt.options.css.push(stylesheet)
        }

        addComponentsDir({
            path: resolver.resolve('./runtime/components'),
            prefix,
            pathPrefix: false,
            extensions: ['vue'],
        })

        addComponent({
            name: `${prefix}FileInput`,
            export: 'FileInput',
            filePath: '@ui-sdk/vue/file-input',
        })

        const shortcuts = resolver.resolve('./runtime/composables/shortcuts')
        addImports([
            { name: 'useShortcut', from: shortcuts },
            { name: 'useShortcutHint', from: shortcuts },
        ])
    },
})
