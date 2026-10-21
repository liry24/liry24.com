import { resolveLitiConfig } from 'liti'
import { createLitiDescriptor } from 'liti/adapter'

import config from '../../liti.config'

export const adminModels = Object.entries(
    createLitiDescriptor(resolveLitiConfig(config, [])).models,
).map(([name, model]) => ({
    name,
    meta: model.meta ?? { label: name, plural: name },
    fields: model.fields,
    displayFields: model.displayFields,
    features: {
        publishing: model.publishing,
        scheduling: model.scheduling,
        revisions: model.revisions,
        sortable: model.sortable,
    },
}))
