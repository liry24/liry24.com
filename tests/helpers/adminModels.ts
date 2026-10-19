import { createAdminClient } from '@liria24/site-admin/internal/admin-client'
import { createSiteAdminManagementClient } from '@liria24/site-admin/internal/client'
import { createSiteAdminDescriptor } from '@liria24/site-admin/internal/descriptor'

import config from '../../site-admin.config'

export const adminModels = await createAdminClient(
    createSiteAdminManagementClient({
        fetch: async () => Response.json(createSiteAdminDescriptor(config)),
    }),
).models()
