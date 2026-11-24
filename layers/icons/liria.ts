export interface LiriaIconData {
    body: string
    width?: number
    height?: number
}

export interface LiriaIconInfo {
    name: string
    total: number
    samples: Array<string>
    palette: boolean
    author: { name: string }
    license: { title: string; spdx: string }
}

export interface LiriaIconCollection {
    prefix: string
    info: LiriaIconInfo
    lastModified: number
    width: number
    height: number
    icons: Record<string, LiriaIconData>
}

export const liriaIconCollection: LiriaIconCollection = {
    prefix: 'liria',
    info: {
        name: 'Liria',
        total: 4,
        samples: ['avatio', 'booth', 'liria'],
        palette: false,
        author: { name: 'Custom' },
        license: { title: 'MIT', spdx: 'MIT' },
    },
    lastModified: 1_779_237_667,
    width: 32,
    height: 32,
    icons: {
        avatio: {
            body: '<path fill="currentColor" d="M.723 18.66a15.6 15.6 0 01-.229-2.663C.494 7.441 7.441.495 15.997.495S31.499 7.44 31.499 15.997c0 4.671-2.07 8.863-5.343 11.706l.017-15.65a7.806 7.806 0 00-13.33-5.526zm19.411 12.28c-1.317.365-2.705.56-4.137.56-5.326 0-10.027-2.691-12.819-6.786l13.428-13.428a2.067 2.067 0 013.528 1.461z"/>',
        },
        booth: {
            body: '<path fill="currentColor" d="M58.183 19.707v4.927L64 29.75v12.194h-5.817V64h-5.67v-4.102c0-10.07-8.74-18.237-19.525-18.244h-.017l-.075.002c-6.593.04-11.926 5.04-11.926 11.208l-.002 11.13-7.765.006V39.414H9.4a3.584 3.584 0 01-3.583-3.583V13.526H0V5.801h5.817V3.583h7.61v25.082L24.614 2.238l3.694.007 6.601 13.879L41.623 0h4.251z"/>',
            width: 64,
            height: 64,
        },
        liria: {
            body: '<path fill="currentColor" stroke="currentColor" stroke-width=".027" d="m17.518 13.042-5.34-5.34-3.422 3.422 5.37 5.369-7.282 7.281 6.825.018 7.3-7.3-.011-.01 3.04-3.04-3.44-3.44zM6.844 11.098l3.098-3.099-3.421-3.422L0 11.097l8.7 8.7 3.421-3.42zm7.472-7.452-3.44-3.44-3.439 3.439 3.44 3.44z"/>',
            width: 24,
            height: 24,
        },
        presocial: {
            body: '<g fill="currentColor"><circle cx="10" cy="22" r="7"/><circle cx="22" cy="10" r="7"/></g>',
        },
    },
}
