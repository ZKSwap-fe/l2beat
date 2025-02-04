import { assert, HttpClient, Logger } from '@l2beat/common'
import { Layer2TransactionApiV2 } from '@l2beat/config'
import { ProjectId } from '@l2beat/types'

import { Config } from '../../config'
import { createAztecConnectProcessor } from '../../core/activity/processors/AztecConnectProcessor'
import { createAztecProcessor } from '../../core/activity/processors/AztecProcessor'
import { createLoopringProcessor } from '../../core/activity/processors/LoopringProcessor'
import { createRpcProcessor } from '../../core/activity/processors/RpcProcessor'
import { createStarkexProcessor } from '../../core/activity/processors/StarkexProcessor'
import { createStarknetProcessor } from '../../core/activity/processors/StarknetProcessor'
import { createZksyncProcessor } from '../../core/activity/processors/ZksyncProcessor'
import { Clock } from '../../core/Clock'
import { SequenceProcessor } from '../../core/SequenceProcessor'
import { Project } from '../../model'
import { BlockTransactionCountRepository } from '../../peripherals/database/activity-v2/BlockTransactionCountRepository'
import { StarkexTransactionCountRepository } from '../../peripherals/database/activity-v2/StarkexCountRepository'
import { SequenceProcessorRepository } from '../../peripherals/database/SequenceProcessorRepository'
import { Database } from '../../peripherals/database/shared/Database'
import { StarkexClient } from '../../peripherals/starkex'

export function createSequenceProcessors(
  config: Config,
  logger: Logger,
  http: HttpClient,
  database: Database,
  clock: Clock,
): SequenceProcessor[] {
  assert(config.activityV2)
  const {
    activityV2: {
      starkexApiKey,
      starkexCallsPerMinute,
      starkexApiDelayHours,
      projects: activityV2ConfigProjects,
      allowedProjectIds,
    },
    projects,
  } = config

  // shared clients
  const numberOfStarkexProjects =
    projects.filter((p) => p.transactionApiV2?.type === 'starkex').length || 1
  const singleStarkexCPM = starkexCallsPerMinute / numberOfStarkexProjects
  const starkexClient = new StarkexClient(starkexApiKey, http, logger, {
    callsPerMinute: singleStarkexCPM,
  })

  // shared repositories
  const blockRepository = new BlockTransactionCountRepository(database, logger)
  const starkexRepository = new StarkexTransactionCountRepository(
    database,
    logger,
  )
  const sequenceProcessorRepository = new SequenceProcessorRepository(
    database,
    logger,
  )

  // ethereum is kept separately in backend config, because it is not a layer 2 project
  const ethereumConfig = activityV2ConfigProjects.ethereum
  assert(
    ethereumConfig?.type === 'rpc',
    'Ethereum transactionApi config missing',
  )
  const ethereum = {
    projectId: ProjectId.ETHEREUM,
    transactionApiV2: {
      ...ethereumConfig,
      startBlock: 8929324,
    },
  }

  const processors = projects
    .filter(hasTransactionApiV2)
    .map(mergeWithActivityV2ConfigProjects(activityV2ConfigProjects))
    .concat([ethereum])
    .filter(isProjectAllowed(allowedProjectIds, logger))
    .map(({ projectId, transactionApiV2 }) => {
      switch (transactionApiV2.type) {
        case 'starkex':
          return createStarkexProcessor(
            projectId,
            starkexRepository,
            starkexClient,
            sequenceProcessorRepository,
            logger,
            clock,
            {
              ...transactionApiV2,
              starkexApiDelayHours,
              singleStarkexCPM,
            },
          )
        case 'aztec':
          return createAztecProcessor(
            projectId,
            blockRepository,
            http,
            sequenceProcessorRepository,
            logger,
            transactionApiV2,
          )
        case 'aztecconnect':
          return createAztecConnectProcessor(
            projectId,
            blockRepository,
            http,
            sequenceProcessorRepository,
            logger,
            transactionApiV2,
          )
        case 'starknet':
          return createStarknetProcessor(
            projectId,
            blockRepository,
            http,
            sequenceProcessorRepository,
            logger,
            clock,
            transactionApiV2,
          )
        case 'zksync':
          return createZksyncProcessor(
            projectId,
            http,
            database,
            sequenceProcessorRepository,
            logger,
            transactionApiV2,
          )
        case 'loopring':
          return createLoopringProcessor(
            projectId,
            http,
            blockRepository,
            sequenceProcessorRepository,
            logger,
            transactionApiV2,
          )
        case 'rpc':
          return createRpcProcessor(
            projectId,
            blockRepository,
            sequenceProcessorRepository,
            logger,
            clock,
            transactionApiV2,
          )
      }
    })

  return processors
}

const hasTransactionApiV2 = (
  p: Project,
): p is Project & { transactionApiV2: Layer2TransactionApiV2 } =>
  !!p.transactionApiV2

function mergeWithActivityV2ConfigProjects(
  activityV2ConfigProjects: Record<string, Layer2TransactionApiV2 | undefined>,
) {
  return ({
    projectId,
    transactionApiV2,
  }: {
    projectId: ProjectId
    transactionApiV2: Layer2TransactionApiV2
  }) => ({
    projectId,
    transactionApiV2: {
      ...transactionApiV2,
      ...activityV2ConfigProjects[projectId.toString()],
    },
  })
}

function isProjectAllowed(
  allowedProjectIds: string[] | undefined,
  logger: Logger,
) {
  return (p: { projectId: ProjectId }) => {
    const noIdsSpecified = allowedProjectIds === undefined
    const projectIncluded = allowedProjectIds?.includes(p.projectId.toString())
    if (noIdsSpecified || projectIncluded) {
      return true
    } else {
      logger.info(`Skipping ${p.projectId.toString()} processor`)
      return false
    }
  }
}
