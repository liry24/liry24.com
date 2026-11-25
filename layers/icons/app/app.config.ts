export default defineAppConfig({
    icon: {
        size: '1.15ic',
        class: 'icon ui-icon-ic',
        cssLayer: 'base',
    },
    ui: {
        icons: {
            loading: 'svg-spinners:ring-resize',
            arrowDown: 'mingcute:arrow-down-line',
            arrowLeft: 'mingcute:arrow-left-line',
            arrowRight: 'mingcute:arrow-right-line',
            arrowUp: 'mingcute:arrow-up-line',
            caution: 'mingcute:warning-fill',
            check: 'mingcute:check-line',
            chevronDoubleLeft: 'mingcute:arrows-left-line',
            chevronDoubleRight: 'mingcute:arrows-right-line',
            chevronDown: 'mingcute:down-line',
            chevronLeft: 'mingcute:left-line',
            chevronRight: 'mingcute:right-line',
            chevronUp: 'mingcute:up-line',
            close: 'mingcute:close-line',
            copy: 'mingcute:copy-2-line',
            copyCheck: 'mingcute:copy-2-fill',
            dark: 'mingcute:moon-fill',
            drag: 'mingcute:dots-line',
            ellipsis: 'mingcute:more-1-line',
            error: 'mingcute:close-circle-fill',
            external: 'mingcute:arrow-right-up-line',
            eye: 'mingcute:eye-2-fill',
            eyeOff: 'mingcute:eye-close-line',
            file: 'mingcute:file-fill',
            folder: 'mingcute:folder-fill',
            folderOpen: 'mingcute:folder-open-fill',
            hash: 'mingcute:hashtag-line',
            info: 'mingcute:information-fill',
            light: 'mingcute:sun-fill',
            menu: 'mingcute:menu-line',
            minus: 'mingcute:minimize-line',
            panelClose: 'mingcute:layout-leftbar-close-fill',
            panelOpen: 'mingcute:layout-leftbar-open-fill',
            plus: 'mingcute:add-line',
            reload: 'mingcute:refresh-2-line',
            search: 'mingcute:search-line',
            stop: 'mingcute:square-fill',
            success: 'mingcute:check-circle-fill',
            system: 'mingcute:monitor-fill',
            tip: 'mingcute:bulb-2-fill',
            upload: 'mingcute:upload-fill',
            warning: 'mingcute:alert-fill',
        },
        button: {
            compoundVariants: [
                {
                    loading: true,
                    leading: true,
                    class: {
                        leadingIcon: 'animate-none',
                    },
                },
                {
                    loading: true,
                    leading: false,
                    trailing: true,
                    class: {
                        trailingIcon: 'animate-none',
                    },
                },
            ],
        },
        commandPalette: {
            variants: {
                loading: {
                    true: {
                        itemLeadingIcon: 'animate-none',
                    },
                },
            },
        },
        contextMenu: {
            variants: {
                loading: {
                    true: {
                        itemLeadingIcon: 'animate-none',
                    },
                },
            },
        },
        dropdownMenu: {
            slots: { item: 'items-center' },
        },
        input: {
            compoundVariants: [
                {
                    loading: true,
                    leading: true,
                    class: {
                        leadingIcon: 'animate-none',
                    },
                },
                {
                    loading: true,
                    leading: false,
                    trailing: true,
                    class: {
                        trailingIcon: 'animate-none',
                    },
                },
            ],
        },
        inputMenu: {
            compoundVariants: [
                {
                    loading: true,
                    leading: true,
                    class: {
                        leadingIcon: 'animate-none',
                    },
                },
                {
                    loading: true,
                    leading: false,
                    trailing: true,
                    class: {
                        trailingIcon: 'animate-none',
                    },
                },
            ],
        },
        inputTags: {
            compoundVariants: [
                {
                    loading: true,
                    leading: true,
                    class: {
                        leadingIcon: 'animate-none',
                    },
                },
                {
                    loading: true,
                    leading: false,
                    trailing: true,
                    class: {
                        trailingIcon: 'animate-none',
                    },
                },
            ],
        },
        select: {
            compoundVariants: [
                {
                    loading: true,
                    leading: true,
                    class: {
                        leadingIcon: 'animate-none',
                    },
                },
                {
                    loading: true,
                    leading: false,
                    trailing: true,
                    class: {
                        trailingIcon: 'animate-none',
                    },
                },
            ],
        },
        selectMenu: {
            compoundVariants: [
                {
                    loading: true,
                    leading: true,
                    class: {
                        leadingIcon: 'animate-none',
                    },
                },
                {
                    loading: true,
                    leading: false,
                    trailing: true,
                    class: {
                        trailingIcon: 'animate-none',
                    },
                },
            ],
        },
        switch: {
            variants: {
                loading: {
                    true: {
                        icon: 'animate-none',
                    },
                },
            },
        },
        textarea: {
            compoundVariants: [
                {
                    loading: true,
                    leading: true,
                    class: {
                        leadingIcon: 'animate-none',
                    },
                },
                {
                    loading: true,
                    leading: false,
                    trailing: true,
                    class: {
                        trailingIcon: 'animate-none',
                    },
                },
            ],
        },
    },
})
