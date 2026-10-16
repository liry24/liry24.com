import type { SiteAdminSessionDraft } from '@liria24/site-admin/internal/model'
import type { ComposerBatch, ComposerPlan } from '~~/shared/utils/adminComposer'

export function useAdminComposer() {
    const { user } = useUserSession()
    const { locale } = useI18n()
    const scope = computed(() => `${user.value?.id ?? ''}:${locale.value}`)
    const open = useState('admin-composer-open', () => false)
    const busy = useState('admin-composer-busy', () => false)
    const operations = useState<Record<string, boolean>>('admin-composer-operations', () => ({}))
    const prompt = useState('admin-composer-prompt', () => '')
    const requestText = useState('admin-composer-text', () => '')
    const requestId = useState('admin-composer-request', () => '')
    const result = useState<ComposerBatch | null>('admin-composer-result', () => null)
    const saved = useState<Record<string, boolean>>('admin-composer-saved', () => ({}))
    const drafts = useState<Record<string, SiteAdminSessionDraft>>(
        'admin-composer-drafts',
        () => ({}),
    )
    const post = useState<{
        scope: string
        itemId: string
        values: ComposerPlan['values']
        publishAt: string
    } | null>('admin-composer-post', () => null)
    const preparations = useState<
        Record<
            string,
            {
                values: ComposerPlan['values']
                publishAt: string
                baseline: Record<string, unknown>
            }
        >
    >('admin-composer-preparations', () => ({}))
    const owner = useState('admin-composer-owner', () => '')
    watch(
        scope,
        (value) => {
            if (owner.value === value) return
            owner.value = value
            open.value = false
            operations.value = {}
            busy.value = false
            prompt.value = ''
            post.value = null
        },
        { flush: 'sync', immediate: true },
    )
    watch(
        () => prompt.value.trim(),
        (value) => {
            if (requestText.value === value) return
            requestText.value = value
            requestId.value = value ? crypto.randomUUID() : ''
            result.value = null
            saved.value = {}
            drafts.value = {}
            preparations.value = {}
        },
        { flush: 'sync', immediate: true },
    )
    function setBusy(id: string, value: boolean) {
        if (value) operations.value[id] = true
        else delete operations.value[id]
        busy.value = Object.values(operations.value).some(Boolean)
    }
    function preparation(id: string) {
        preparations.value[id] ??= {
            values: { title: '', tags: [] },
            publishAt: '',
            baseline: { title: '', tags: [], publishAt: '' },
        }
        return preparations.value[id]!
    }
    function preparePost(itemId: string, values: ComposerPlan['values'], publishAt: string) {
        post.value = {
            scope: scope.value,
            itemId,
            values: structuredClone(toRaw(values)),
            publishAt,
        }
        open.value = false
        return navigateTo({ path: '/admin/posts/new', query: { composer: itemId } })
    }
    return {
        open,
        busy,
        prompt,
        post,
        preparation,
        scope,
        preparePost,
        requestId,
        result,
        saved,
        setBusy,
        drafts,
    }
}
