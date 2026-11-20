import type { WriteReceipt } from 'liti/types'
import type { InjectionKey } from 'vue'

const composerKey: InjectionKey<ReturnType<typeof createAdminComposer>> = Symbol('admin-composer')

export function useAdminComposer() {
    const shared = inject(composerKey, null)
    if (shared) return shared
    const composer = createAdminComposer()
    provide(composerKey, composer)
    return composer
}

function createAdminComposer() {
    const { user } = useAppSession()
    const { locale } = useI18n()
    const route = useRoute()
    const scope = computed(() => `${user.value?.id ?? ''}:${locale.value}`)
    const state = useState('admin-composer', () => ({
        owner: '',
        open: false,
        prompt: '',
        text: '',
        key: '',
        requestId: '',
        result: null as ComposerBatch | null,
        saved: {} as Record<string, boolean>,
        post: null as {
            scope: string
            itemId: string
            values: ComposerPlan['values']
            publishAt: string
        } | null,
        preparations: {} as Record<
            string,
            {
                values: ComposerPlan['values']
                publishAt: string
                baseline: Record<string, unknown>
                draft?: { data: Record<string, unknown>; receipt: WriteReceipt | null }
            }
        >,
    }))
    const { open, prompt, requestId, result, saved, post, preparations } = toRefs(state.value)
    const composing = ref(false)
    const pending = ref(false)
    const error = ref('')
    const operations = reactive<Record<string, boolean>>({})
    const busy = computed(() => Object.keys(operations).length > 0)
    let selection: ComposerItemInput[] | undefined
    const timeZone = import.meta.client ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC'
    const mounted = ref(false)
    const active = computed(
        () => mounted.value && (open.value || route.path.replace(/\/$/, '') === '/admin/data'),
    )
    const context = computed(() => {
        const model = composerModels.find((name) => route.path.split('/')[2] === name)
        const entryId =
            'id' in route.params && typeof route.params.id === 'string' && route.params.id !== 'new'
                ? route.params.id
                : undefined
        return model ? { model, entryId } : undefined
    })
    const identity = computed(() =>
        JSON.stringify([scope.value, prompt.value.trim(), timeZone, context.value]),
    )
    let controller: AbortController | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let generation = 0

    watch(
        scope,
        (value) => {
            if (state.value.owner === value) return
            state.value.owner = value
            open.value = false
            prompt.value = ''
            post.value = null
            saved.value = {}
            preparations.value = {}
            result.value = null
            composing.value = false
            for (const id of Object.keys(operations)) delete operations[id]
        },
        { flush: 'sync', immediate: true },
    )

    function cancel() {
        generation++
        clearTimeout(timer)
        controller?.abort()
        pending.value = false
    }
    async function retry() {
        cancel()
        if (!active.value || composing.value || busy.value || !prompt.value.trim()) return
        const request: ComposerRequest = {
            prompt: prompt.value.trim(),
            requestId: requestId.value,
            locale: locale.value === 'ja' ? 'ja' : 'en',
            timeZone: timeZone,
            context: context.value,
            items: selection,
        }
        const ownGeneration = generation
        controller = new AbortController()
        pending.value = true
        error.value = ''
        try {
            const batch = await $fetch<ComposerBatch>('/api/admin/compose', {
                method: 'POST',
                body: request,
                signal: controller.signal,
                retry: 0,
            })
            if (ownGeneration !== generation) return
            if (batch.requestId !== request.requestId)
                throw new Error('The response belongs to another request.')
            result.value =
                request.items && result.value?.requestId === batch.requestId
                    ? {
                          ...result.value,
                          items: result.value.items.map(
                              (item) => batch.items.find((next) => next.id === item.id) ?? item,
                          ),
                      }
                    : batch
            selection = undefined
        } catch (cause) {
            if (ownGeneration !== generation) return
            const failure = cause as {
                status?: number
                data?: { message?: string }
                message?: string
            }
            error.value =
                failure.status === 401 || failure.status === 403
                    ? 'Your session cannot access this content. Sign in again.'
                    : failure.data?.message || failure.message || 'Could not prepare the form.'
        } finally {
            if (ownGeneration === generation) pending.value = false
        }
    }
    function schedule() {
        cancel()
        if (state.value.key !== identity.value) {
            state.value.key = identity.value
            const text = prompt.value.trim()
            if (state.value.text !== text) {
                state.value.text = text
                requestId.value = text ? crypto.randomUUID() : ''
                saved.value = {}
                preparations.value = {}
            }
            result.value = null
            selection = undefined
        }
        error.value = ''
        if (!active.value || composing.value || !prompt.value.trim()) return
        if (!selection && result.value?.requestId === requestId.value) return
        pending.value = true
        timer = setTimeout(() => void retry(), 300)
    }
    watch([active, identity, composing], schedule, { flush: 'sync', immediate: true })
    onMounted(() => {
        mounted.value = true
    })
    onScopeDispose(cancel)
    const removeNavigationGuard = useRouter().beforeEach(() => !busy.value)
    onScopeDispose(removeNavigationGuard)

    function selectItem(item: ComposerItem, model?: ComposerModel, entryId?: string) {
        if (busy.value) return
        selection = [{ id: item.id, source: item.source, model, entryId }]
        schedule()
    }
    function setBusy(id: string, value: boolean) {
        if (value) operations[id] = true
        else delete operations[id]
    }
    function preparation(
        id: string,
        baseline: Record<string, unknown> = { title: '', tags: [], publishAt: '' },
    ) {
        preparations.value[id] ??= {
            values: { title: '', tags: [] },
            publishAt: '',
            baseline: structuredClone(toRaw(baseline)),
        }
        return preparations.value[id]!
    }
    function openPost(itemId: string, values: ComposerPlan['values'], publishAt: string) {
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
        prompt,
        composing,
        pending,
        busy,
        error,
        result,
        retry,
        selectItem,
        openPost,
        post,
        preparation,
        scope,
        requestId,
        saved,
        setBusy,
    }
}
