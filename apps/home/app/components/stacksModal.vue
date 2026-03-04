<script setup lang="ts">
const colorMode = useColorMode()
const isLight = computed(() => colorMode.preference === 'light')

const logos = [
    {
        name: 'TypeScript',
        logo: 'typescript',
        href: 'https://typescriptlang.org',
    },
    {
        name: 'Node.js',
        logo: 'nodejs',
        href: 'https://nodejs.org',
    },
    {
        name: 'Bun',
        logo: 'bun',
        href: 'https://bun.sh',
    },
    {
        name: 'Vite',
        logo: 'vite',
        href: 'https://vitejs.dev',
    },
    {
        name: 'Rolldown',
        logo: 'rolldown',
        href: 'https://rolldown.rs',
    },
    {
        name: 'Oxc',
        logo: 'oxc',
        href: 'https://oxc.rs',
    },
    {
        name: 'Nuxt',
        logo: 'nuxt',
        href: 'https://nuxt.com',
    },
    {
        name: 'Vue',
        logo: 'vue',
        href: 'https://vuejs.org',
    },
    {
        name: 'VueUse',
        logo: 'vueuse',
        href: 'https://vueuse.org',
    },
    {
        name: 'Tailwind CSS',
        logo: 'tailwindcss',
        href: 'https://tailwindcss.com',
    },
    {
        name: 'Motion',
        logo: isLight.value ? 'motion' : 'motion_dark',
        href: 'https://motion.dev',
    },
    {
        name: 'Turso',
        logo: isLight.value ? 'turso-light' : 'turso-dark',
        href: 'https://turso.tech',
    },
    {
        name: 'Drizzle ORM',
        logo: isLight.value ? 'drizzle-orm_light' : 'drizzle-orm_dark',
        href: 'https://orm.drizzle.team',
    },
    {
        name: 'Better Auth',
        logo: isLight.value ? 'better-auth_light' : 'better-auth_dark',
        href: 'https://better-auth.com',
    },
    {
        name: 'Zod',
        logo: 'zod',
        href: 'https://zod.dev',
    },
    {
        name: 'GitHub',
        logo: isLight.value ? 'github_light' : 'github_dark',
        href: 'https://github.com',
    },
    {
        name: 'Vercel',
        logo: isLight.value ? 'vercel' : 'vercel_dark',
        href: 'https://vercel.com',
    },
    {
        name: 'Turborepo',
        logo: isLight.value ? 'turborepo-icon-light' : 'turborepo-icon-dark',
        href: 'https://turborepo.com',
    },
    {
        name: 'Visual Studio Code',
        logo: 'vscode',
        href: 'https://code.visualstudio.com',
    },
    {
        name: 'Antigravity',
        logo: 'antigravity',
        href: 'https://antigravity.google',
    },
    {
        name: 'Raycast',
        logo: 'raycast',
        href: 'https://raycast.com',
    },
    {
        name: 'svgl',
        logo: 'svgl',
        href: 'https://svgl.app',
    },
]
</script>

<template>
    <UModal :ui="{ content: 'py-8 px-12 flex flex-col gap-8 divide-y-0 items-center' }">
        <slot />

        <template #content>
            <span class="font-[Special_Gothic_Expanded_One] text-3xl leading-none text-nowrap">
                stacks
            </span>

            <div class="flex flex-wrap items-center justify-center gap-8">
                <UTooltip
                    v-for="logo in logos"
                    :key="logo.logo"
                    :text="logo.name"
                    :delay-duration="50"
                >
                    <NuxtLink :to="logo.href" target="_blank">
                        <NuxtImg
                            :src="`https://svgl.app/library/${logo.logo}.svg`"
                            alt=""
                            class="size-9"
                        />
                    </NuxtLink>
                </UTooltip>
            </div>

            <span class="text-muted text-sm">with ❤️</span>
        </template>
    </UModal>
</template>
