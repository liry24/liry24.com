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
        accordion: {
            slots: {
                item: 'md:py-2',
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
