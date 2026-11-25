export default defineAppConfig({
    app: {
        liria: {
            website: 'https://liria.me',
            x: 'https://x.com/liria_24',
            github: 'https://github.com/liria24',
            liriaGraphics: 'https://eicosapenta.booth.pm',
            avatio: 'https://avatio.me',
        },
    },
    ui: {
        prose: {
            h2: {
                slots: {
                    base: 'tracking-tighter',
                },
            },
            h3: {
                slots: {
                    base: 'tracking-tight',
                },
            },
            p: {
                base: 'text-base text-toned leading-6.5',
            },
        },
        colors: {
            neutral: 'zinc',
        },
        formField: {
            slots: {
                error: 'text-red-700 dark:text-red-400',
            },
        },
        accordion: {
            slots: {
                item: 'md:py-2',
            },
        },
        dashboardNavbar: {
            slots: {
                root: 'max-lg:h-auto max-lg:min-h-(--ui-header-height) max-lg:flex-wrap max-lg:py-2',
                right: 'max-lg:max-w-full max-lg:flex-wrap',
                toggle: 'shrink-0',
            },
        },
        dashboardPanel: {
            slots: {
                root: 'lg:not-last:border-0',
                body: 'p-0 sm:p-0',
            },
        },
    },
})
