import { recordSchema } from '@litijs/model/records/schema'

import { games, gameStats, ranks, socials } from '../models/records.js'

export const tables = recordSchema([games, gameStats, ranks, socials])
