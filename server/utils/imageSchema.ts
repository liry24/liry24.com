import { image, type BlobReference } from '@vite-hub/blob/reference'
import { z } from 'zod'

// Compose the native image contract inside Zod arrays/objects without changing its stored form.
export const imageSchema = z.fromJSONSchema(
    image()['~standard'].jsonSchema.output({ target: 'draft-2020-12' }),
) as z.ZodType<BlobReference>
