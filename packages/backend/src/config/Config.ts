import { LogLevel } from '@l2beat/common'
import { Layer2TransactionApiV2 } from '@l2beat/config'
import { UnixTime } from '@l2beat/types'
import { Knex } from 'knex'

import { Project, Token } from '../model'

export interface Config {
  readonly name: string
  readonly projects: Project[]
  readonly syncEnabled: boolean
  readonly logger: LoggerConfig
  readonly clock: ClockConfig
  readonly database: DatabaseConfig | false
  readonly api: ApiConfig | false
  readonly health: HealthConfig
  readonly tvl: TvlConfig | false
  readonly activity: ActivityConfig | false
  readonly activityV2: ActivityV2Config | false
  readonly discovery: DiscoveryConfig | false
}

export interface LoggerConfig {
  readonly logLevel: LogLevel
  readonly format: 'pretty' | 'json'
}

export interface ApiConfig {
  readonly port: number
}

export interface DatabaseConfig {
  readonly connection: Knex.Config['connection']
  readonly freshStart: boolean
}

export interface ClockConfig {
  readonly minBlockTimestamp: UnixTime
  readonly safeTimeOffsetSeconds: number
}

export interface TvlConfig {
  readonly tokens: Token[]
  readonly alchemyApiKey: string
  readonly etherscanApiKey: string
  readonly coingeckoApiKey: string | undefined
}

export interface HealthConfig {
  readonly releasedAt?: string
  readonly startedAt: string
  readonly commitSha: string
}

export interface ActivityConfig {
  readonly starkexApiKey: string
  readonly starkexApiDelayHours: number
  readonly zkSyncWorkQueueWorkers: number
  readonly aztecWorkQueueWorkers: number
  readonly starkexWorkQueueWorkers: number
  readonly loopringWorkQueueWorkers: number
  readonly loopringCallsPerMinute: number
  readonly starkexCallsPerMinute: number
  readonly rpc: {
    workQueueLimit: number
    workQueueWorkers: number
    projects: Record<
      string,
      | {
          callsPerMinute?: number
          url: string
        }
      | undefined
    >
  }
}

export interface ActivityV2Config {
  readonly starkexApiKey: string
  readonly starkexApiDelayHours: number
  readonly starkexCallsPerMinute: number
  readonly allowedProjectIds?: string[]
  readonly projects: Record<string, Layer2TransactionApiV2 | undefined>
}

export interface DiscoveryConfig {
  readonly project: string
  readonly blockNumber?: number
  readonly alchemyApiKey: string
  readonly etherscanApiKey: string
}
