import * as content from '../../server/models/content'
import * as records from '../../server/models/records'

export const adminModels = [...Object.values(content), ...Object.values(records)]
