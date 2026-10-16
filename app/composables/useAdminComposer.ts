import type { ComposerPlan } from '~~/shared/utils/adminComposer'

export function useAdminComposer() {
    const { user } = useUserSession()
    const { locale } = useI18n()
    const scope = computed(() => `${user.value?.id ?? ''}:${locale.value}`)
    const open = useState('admin-composer-open', () => false)
    const busy = useState('admin-composer-busy', () => false)
    const prompt = useState('admin-composer-prompt', () => '')
    const post = useState<{
        scope: string
        values: ComposerPlan['values']
        publishAt: string
    } | null>('admin-composer-post', () => null)
    const emptyPreparation = () => ({
        values: { title: '', tags: [] } as ComposerPlan['values'],
        publishAt: '',
        baseline: { title: '', tags: [], publishAt: '' } as Record<string, unknown>,
    })
    const preparation = useState('admin-composer-preparation', emptyPreparation)
    const owner = useState('admin-composer-owner', () => '')
    watch(
        scope,
        (value) => {
            if (owner.value === value) return
            owner.value = value
            open.value = false
            busy.value = false
            prompt.value = ''
            post.value = null
            preparation.value = emptyPreparation()
        },
        { flush: 'sync', immediate: true },
    )
    function preparePost(values: ComposerPlan['values'], publishAt: string) {
        post.value = { scope: scope.value, values: structuredClone(toRaw(values)), publishAt }
        preparation.value = emptyPreparation()
        prompt.value = ''
        open.value = false
        return navigateTo('/admin/posts/new')
    }
    return { open, busy, prompt, post, preparation, scope, preparePost }
}
