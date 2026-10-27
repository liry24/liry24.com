import { editorialModel } from '../../editorial-model'

export default defineEventHandler(() => ({
    calls: editorialModel.doGenerateCalls.length,
    prompts: editorialModel.doGenerateCalls.map((call) => JSON.stringify(call.prompt)),
    tools: editorialModel.doGenerateCalls.map((call) => call.tools ?? []),
}))
