import test from 'node:test'
import assert from 'node:assert'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { PaipuController } from './paipu.controller'
import { PaipuService, GameWithDetailRelations } from './paipu.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ImportPaipuDto, ImportPaipuPipe } from './dto/import-paipu.dto'
import { ImportBatchPaipuDto, ImportBatchPaipuPipe } from './dto/import-batch-paipu.dto'
import { ImportBatchAsyncDto, ImportBatchAsyncPipe } from './dto/import-batch-async.dto'
import { UploadPaipuDto, UploadPaipuPipe } from './dto/upload-paipu.dto'
import { SAMPLE_MAJSOUL_GAME, LiqiBinaryDecoder, MajsoulGameRecord, PaipuParser } from '@mahjong-sensei/mahjong-core'
import {
    BatchImportPaipuResult,
    BatchPaipuJobStatus,
    BatchAsyncImportResponse
} from '@mahjong-sensei/types'

class MockPrismaService extends PrismaService {
    public constructor() {
        super()
    }
}

class MockPaipuService extends PaipuService {
    public mockGame: GameWithDetailRelations | null = null

    public constructor() {
        super(new MockPrismaService())
    }

    protected override async fetchGameForDetail(_gameId: string): Promise<GameWithDetailRelations | null> {
        return this.mockGame
    }

    public testGenerateSyntheticStartingHands(
        metrics: readonly { seat: number; startShanten: number; startDoraCount: number }[],
        is3P: boolean
    ): readonly (readonly string[])[] {
        return this.generateSyntheticStartingHands(metrics, is3P)
    }

    public override async importPaipu(urlOrUuid: string): Promise<{
        readonly success: boolean
        readonly gameId: string
    }> {
        return { success: true, gameId: urlOrUuid }
    }

    public override async importRawPaipu(
        _content: string,
        _format: 'json' | 'protobuf' | 'base64' = 'json'
    ): Promise<{
        readonly success: boolean
        readonly gameId: string
    }> {
        return { success: true, gameId: 'uploaded-game-uuid' }
    }

    public override async importBatch(inputs: readonly string[]): Promise<BatchImportPaipuResult> {
        return {
            total: inputs.length,
            imported: inputs.length,
            existing: 0,
            failed: 0,
            gameIds: inputs
        }
    }

    public override async startBatchAsync(urls: readonly string[]): Promise<BatchAsyncImportResponse> {
        return {
            jobId: 'mock-async-job-123',
            total: urls.length
        }
    }

    public override getBatchStatus(jobId: string): BatchPaipuJobStatus {
        return {
            jobId,
            total: 3,
            completed: 2,
            failed: 1,
            progressPercent: 100,
            isFinished: true,
            errors: ['Mock error'],
            gameIds: ['uuid-1', 'uuid-2']
        }
    }
}


test('ImportPaipuDto - runtime validation', () => {
    /*_ GEMINI THINKING _*/
    // Should reject non-object or null/undefined
    assert.throws(() => ImportPaipuDto.validate(null), BadRequestException)
    assert.throws(() => ImportPaipuDto.validate(undefined), BadRequestException)
    assert.throws(() => ImportPaipuDto.validate('invalid-string'), BadRequestException)
    assert.throws(() => ImportPaipuDto.validate([]), BadRequestException)

    // Should reject missing urlOrUuid
    assert.throws(() => ImportPaipuDto.validate({}), BadRequestException)

    // Should reject non-string urlOrUuid
    assert.throws(() => ImportPaipuDto.validate({ urlOrUuid: 123 }), BadRequestException)
    assert.throws(() => ImportPaipuDto.validate({ urlOrUuid: true }), BadRequestException)

    // Should reject empty or whitespace urlOrUuid
    assert.throws(() => ImportPaipuDto.validate({ urlOrUuid: '' }), BadRequestException)
    assert.throws(() => ImportPaipuDto.validate({ urlOrUuid: '   ' }), BadRequestException)

    // Should reject string longer than 500 characters
    const tooLong = 'a'.repeat(501)
    assert.throws(() => ImportPaipuDto.validate({ urlOrUuid: tooLong }), BadRequestException)

    // Should reject padded string with trimmed length exceeding 500 characters
    const paddedInvalid = '   ' + 'a'.repeat(501) + '   '
    assert.throws(() => ImportPaipuDto.validate({ urlOrUuid: paddedInvalid }), BadRequestException)

    // Should accept valid urlOrUuid and trim it
    const valid = ImportPaipuDto.validate({ urlOrUuid: '  20240101-uuid-1234  ' })
    assert.strictEqual(valid.urlOrUuid, '20240101-uuid-1234')

    // Should accept padded string with trimmed length up to 500 characters
    const paddedValid = '   ' + 'a'.repeat(500) + '   '
    const validPadded = ImportPaipuDto.validate({ urlOrUuid: paddedValid })
    assert.strictEqual(validPadded.urlOrUuid.length, 500)

    // Fast-path: passing an already constructed instance returns the same instance
    assert.strictEqual(ImportPaipuDto.validate(valid), valid)
    assert.strictEqual(ImportPaipuDto.validate(validPadded), validPadded)

    // Pipe should also validate correctly
    const pipe = new ImportPaipuPipe()
    const pipeResult = pipe.transform({ urlOrUuid: 'sample-uuid' })
    assert.strictEqual(pipeResult.urlOrUuid, 'sample-uuid')
    assert.throws(() => pipe.transform({ urlOrUuid: '' }), BadRequestException)
})

test('ImportBatchPaipuDto - runtime validation', () => {
    /*_ GEMINI THINKING _*/
    // Should reject non-object or null/undefined
    assert.throws(() => ImportBatchPaipuDto.validate(null), BadRequestException)
    assert.throws(() => ImportBatchPaipuDto.validate(undefined), BadRequestException)
    assert.throws(() => ImportBatchPaipuDto.validate('not-an-object'), BadRequestException)
    assert.throws(() => ImportBatchPaipuDto.validate([]), BadRequestException)

    // Should reject missing inputs
    assert.throws(() => ImportBatchPaipuDto.validate({}), BadRequestException)

    // Should reject non-array inputs
    assert.throws(() => ImportBatchPaipuDto.validate({ inputs: 'not-array' }), BadRequestException)

    // Should reject empty array (length < 1)
    assert.throws(() => ImportBatchPaipuDto.validate({ inputs: [] }), BadRequestException)

    // Should reject array with more than 100 items
    const tooMany = Array.from({ length: 101 }, (_v, i) => `game-${i}`)
    assert.throws(() => ImportBatchPaipuDto.validate({ inputs: tooMany }), BadRequestException)

    // Should reject non-string items
    assert.throws(() => ImportBatchPaipuDto.validate({ inputs: [123] }), BadRequestException)

    // Should reject empty string or whitespace items
    assert.throws(() => ImportBatchPaipuDto.validate({ inputs: ['valid-1', '', 'valid-2'] }), BadRequestException)
    assert.throws(() => ImportBatchPaipuDto.validate({ inputs: ['valid-1', '   '] }), BadRequestException)

    // Should reject item longer than 500 characters
    assert.throws(() => ImportBatchPaipuDto.validate({ inputs: ['a'.repeat(501)] }), BadRequestException)

    // Should reject padded item with trimmed length exceeding 500 characters
    const paddedInvalid = '   ' + 'a'.repeat(501) + '   '
    assert.throws(() => ImportBatchPaipuDto.validate({ inputs: [paddedInvalid] }), BadRequestException)

    // Should accept valid array of 1..100 items
    const validInputs = ['game-1', '  game-2  ', 'game-3']
    const validBatch = ImportBatchPaipuDto.validate({ inputs: validInputs })
    assert.strictEqual(validBatch.inputs.length, 3)
    assert.strictEqual(validBatch.inputs[0], 'game-1')
    assert.strictEqual(validBatch.inputs[1], 'game-2')
    assert.strictEqual(validBatch.inputs[2], 'game-3')

    // Should accept padded item with trimmed length up to 500 characters consistently
    const paddedValid = '   ' + 'a'.repeat(500) + '   '
    const validBatchPadded = ImportBatchPaipuDto.validate({ inputs: [paddedValid] })
    const firstPaddedInput = validBatchPadded.inputs[0]
    if (firstPaddedInput === undefined) {
        assert.fail('firstPaddedInput must be defined')
    }
    assert.strictEqual(firstPaddedInput.length, 500)

    // Fast-path: passing an already constructed instance returns the same instance
    assert.strictEqual(ImportBatchPaipuDto.validate(validBatch), validBatch)
    assert.strictEqual(ImportBatchPaipuDto.validate(validBatchPadded), validBatchPadded)

    // Pipe should also validate correctly
    const pipe = new ImportBatchPaipuPipe()
    const pipeResult = pipe.transform({ inputs: ['valid-batch-uuid'] })
    assert.strictEqual(pipeResult.inputs.length, 1)
    assert.strictEqual(pipeResult.inputs[0], 'valid-batch-uuid')
    assert.throws(() => pipe.transform({ inputs: [] }), BadRequestException)
})

test('PaipuController - controller level validation', async () => {
    /*_ GEMINI THINKING _*/
    const mockService = new MockPaipuService()
    const controller = new PaipuController(mockService)

    // Controller import validation
    await assert.rejects(
        async () => await controller.import({ urlOrUuid: '' }),
        BadRequestException
    )
    await assert.rejects(
        async () => await controller.import({ urlOrUuid: 'a'.repeat(501) }),
        BadRequestException
    )

    const importRes = await controller.import({ urlOrUuid: '  uuid-999  ' })
    assert.strictEqual(importRes.success, true)
    assert.strictEqual(importRes.gameId, 'uuid-999')

    // Fast-path when controller receives already-instantiated DTO
    const preValidatedDto = new ImportPaipuDto('uuid-fast-path')
    const fastPathImportRes = await controller.import(preValidatedDto)
    assert.strictEqual(fastPathImportRes.success, true)
    assert.strictEqual(fastPathImportRes.gameId, 'uuid-fast-path')

    // Controller import-batch validation
    await assert.rejects(
        async () => await controller.importBatch({ inputs: [] }),
        BadRequestException
    )
    await assert.rejects(
        async () => await controller.importBatch({ inputs: [''] }),
        BadRequestException
    )

    const batchRes = await controller.importBatch({ inputs: ['  batch-uuid-1  '] })
    assert.strictEqual(batchRes.total, 1)
    assert.strictEqual(batchRes.gameIds[0], 'batch-uuid-1')

    // Fast-path when controller receives already-instantiated Batch DTO
    const preValidatedBatchDto = new ImportBatchPaipuDto(['batch-uuid-fast-path'])
    const fastPathBatchRes = await controller.importBatch(preValidatedBatchDto)
    assert.strictEqual(fastPathBatchRes.total, 1)
    assert.strictEqual(fastPathBatchRes.gameIds[0], 'batch-uuid-fast-path')

    // Controller batch-async validation
    await assert.rejects(
        async () => await controller.importBatchAsync({ urls: [] }),
        BadRequestException
    )
    await assert.rejects(
        async () => await controller.importBatchAsync({ urls: [''] }),
        BadRequestException
    )

    const asyncRes = await controller.importBatchAsync({ urls: ['  https://game.maj-soul.com/1/?paipu=async-uuid-1  '] })
    assert.strictEqual(asyncRes.jobId, 'mock-async-job-123')
    assert.strictEqual(asyncRes.total, 1)

    // Fast-path when controller receives already-instantiated ImportBatchAsyncDto
    const preValidatedAsyncDto = new ImportBatchAsyncDto(['https://game.maj-soul.com/1/?paipu=fast-path'])
    const fastPathAsyncRes = await controller.importBatchAsync(preValidatedAsyncDto)
    assert.strictEqual(fastPathAsyncRes.jobId, 'mock-async-job-123')
    assert.strictEqual(fastPathAsyncRes.total, 1)

    // Controller batch-status retrieval
    const statusRes = controller.getBatchStatus('mock-async-job-123')
    assert.strictEqual(statusRes.jobId, 'mock-async-job-123')
    assert.strictEqual(statusRes.total, 3)
    assert.strictEqual(statusRes.completed, 2)
    assert.strictEqual(statusRes.isFinished, true)

    // Controller upload validation via UploadPaipuPipe
    const uploadPipe = new UploadPaipuPipe()
    assert.throws(
        () => uploadPipe.transform({ content: '' }),
        BadRequestException
    )

    const validUploadDto = uploadPipe.transform({ content: '{"uuid":"test"}', format: 'json' })
    const uploadRes = await controller.upload(validUploadDto)
    assert.strictEqual(uploadRes.success, true)
    assert.strictEqual(uploadRes.gameId, 'uploaded-game-uuid')
})

test('UploadPaipuDto - runtime validation', () => {
    /*_ GEMINI THINKING _*/
    // Should reject non-object or null/undefined
    assert.throws(() => UploadPaipuDto.validate(null), BadRequestException)
    assert.throws(() => UploadPaipuDto.validate(undefined), BadRequestException)
    assert.throws(() => UploadPaipuDto.validate(''), BadRequestException)

    // Should reject missing content
    assert.throws(() => UploadPaipuDto.validate({}), BadRequestException)
    assert.throws(() => UploadPaipuDto.validate({ content: '' }), BadRequestException)
    assert.throws(() => UploadPaipuDto.validate({ content: 123 }), BadRequestException)

    // Should reject invalid format
    assert.throws(() => UploadPaipuDto.validate({ content: 'valid', format: 'xml' }), BadRequestException)

    // Valid inputs
    const validJson = UploadPaipuDto.validate({ content: '{"uuid":"123"}', format: 'json' })
    assert.strictEqual(validJson.format, 'json')
    assert.strictEqual(validJson.content, '{"uuid":"123"}')

    const autoBase64 = UploadPaipuDto.validate({ content: 'rawbase64string' })
    assert.strictEqual(autoBase64.format, 'base64')

    const pipe = new UploadPaipuPipe()
    const piped = pipe.transform({ content: 'valid' })
    assert.strictEqual(piped.content, 'valid')
})

test('PaipuService - generateSyntheticStartingHands generates 3P and 4P hands with dora replacements', () => {
    /*_ GEMINI THINKING _*/
    const service = new MockPaipuService()

    // 4P mode
    const hands4P = service.testGenerateSyntheticStartingHands([
        { seat: 0, startShanten: 1, startDoraCount: 1 },
        { seat: 1, startShanten: 2, startDoraCount: 2 },
        { seat: 2, startShanten: 3, startDoraCount: 3 },
        { seat: 3, startShanten: 2, startDoraCount: 0 }
    ], false)

    assert.strictEqual(hands4P.length, 4)
    assert.strictEqual(hands4P[0]?.length, 13)
    assert.ok(hands4P[0]?.includes('0p'))
    assert.ok(hands4P[1]?.includes('0p'))
    assert.ok(hands4P[1]?.includes('0s'))
    assert.ok(hands4P[2]?.includes('0p'))
    assert.ok(hands4P[2]?.includes('0s'))
    assert.ok(hands4P[2]?.includes('0m'))
    assert.strictEqual(hands4P[3]?.includes('0p'), false)

    // 3P mode
    const hands3P = service.testGenerateSyntheticStartingHands([
        { seat: 0, startShanten: 1, startDoraCount: 0 },
        { seat: 1, startShanten: 2, startDoraCount: 1 },
        { seat: 2, startShanten: 3, startDoraCount: 3 }
    ], true)

    assert.strictEqual(hands3P.length, 3)
    assert.strictEqual(hands3P[0]?.length, 13)
    assert.strictEqual(hands3P[1]?.length, 13)
    assert.ok(hands3P[1]?.includes('0p'))
    // 3P dora 3 uses 4z (North/Kita), never 0m or 2m-8m
    assert.ok(hands3P[2]?.includes('4z'))
    assert.strictEqual(hands3P[2]?.includes('0m'), false)
    for (const hand of hands3P) {
        assert.strictEqual(
            hand?.some((t) => ['2m', '3m', '4m', '5m', '6m', '7m', '8m', '0m'].includes(t)),
            false
        )
    }
})

test('PaipuService - getPaipuDetail throws NotFoundException when game is missing', async () => {
    /*_ GEMINI THINKING _*/
    const service = new MockPaipuService()
    service.mockGame = null

    await assert.rejects(
        async () => await service.getPaipuDetail('non-existent-game'),
        NotFoundException
    )
})

test('PaipuService - getPaipuDetail decodes rawProtobuf when present and populates rounds, doraIndicators, and results', async () => {
    /*_ GEMINI THINKING _*/
    const service = new MockPaipuService()
    const decoder = new LiqiBinaryDecoder()
    const encodedProto = decoder.encode(SAMPLE_MAJSOUL_GAME)

    service.mockGame = {
        id: SAMPLE_MAJSOUL_GAME.uuid,
        roomType: SAMPLE_MAJSOUL_GAME.roomType,
        gameDate: new Date(SAMPLE_MAJSOUL_GAME.timestamp),
        rawProtobuf: Buffer.from(encodedProto),
        participants: [],
        rounds: []
    }

    const detail = await service.getPaipuDetail(SAMPLE_MAJSOUL_GAME.uuid)
    assert.strictEqual(detail.id, SAMPLE_MAJSOUL_GAME.uuid)
    assert.strictEqual(detail.rounds.length, 2)

    // Round 0 (tsumo win)
    const round0 = detail.rounds[0]
    assert.ok(round0 !== undefined)
    assert.strictEqual(round0.roundName, '동1국')
    assert.deepStrictEqual(round0.doraIndicators, ['5m'])
    assert.ok(round0.result !== undefined)
    assert.strictEqual(round0.result.type, 'tsumo')
    assert.strictEqual(round0.result.score, 12000)
    assert.ok(round0.roundMetrics !== undefined)
    assert.strictEqual(round0.roundMetrics.length, 4)

    // Round 1 (ryukyoku)
    const round1 = detail.rounds[1]
    assert.ok(round1 !== undefined)
    assert.strictEqual(round1.roundName, '동2국')
    assert.ok(round1.result !== undefined)
    assert.strictEqual(round1.result.type, 'ryukyoku')
})

test('PaipuService - getPaipuDetail generates synthetic round detail with result and metrics when rawProtobuf is null', async () => {
    /*_ GEMINI THINKING _*/
    const service = new MockPaipuService()

    service.mockGame = {
        id: 'amae-sync-3p-10001-1',
        roomType: '3인 금탁 남풍전',
        gameDate: new Date(),
        rawProtobuf: null,
        participants: [
            {
                seat: 0,
                finalRank: 1,
                finalScore: 48000,
                luckScore: 75.0,
                skillScore: 68.0,
                player: { accountId: 10001, nickname: 'SenseiPlayer' }
            },
            {
                seat: 1,
                finalRank: 2,
                finalScore: 32000,
                luckScore: 50.0,
                skillScore: 55.0,
                player: { accountId: 10002, nickname: 'RivalPlayer' }
            },
            {
                seat: 2,
                finalRank: 3,
                finalScore: 10000,
                luckScore: 32.0,
                skillScore: 48.0,
                player: { accountId: 10003, nickname: 'ThirdPlayer' }
            }
        ],
        rounds: [
            {
                id: 'round-1',
                roundIndex: 0,
                honba: 0,
                riichiSticks: 0,
                roundMetrics: [
                    {
                        seat: 0,
                        startShanten: 1,
                        startDoraCount: 2,
                        drawLuckRatio: 0.35,
                        uradoraHits: 1,
                        dealInScore: 0,
                        tsumoLossScore: 0,
                        tileEfficiency: 0.88,
                        luckScore: 75.0,
                        skillScore: 68.0,
                        isWin: true,
                        isRiichi: true,
                        isFuro: false,
                        isDamaten: false,
                        isInitiative: true
                    },
                    {
                        seat: 1,
                        startShanten: 2,
                        startDoraCount: 1,
                        drawLuckRatio: 0.25,
                        uradoraHits: 0,
                        dealInScore: 8000,
                        tsumoLossScore: 0,
                        tileEfficiency: 0.75,
                        luckScore: 50.0,
                        skillScore: 55.0,
                        isWin: false,
                        isRiichi: false,
                        isFuro: false,
                        isDamaten: false,
                        isInitiative: false
                    },
                    {
                        seat: 2,
                        startShanten: 3,
                        startDoraCount: 0,
                        drawLuckRatio: 0.15,
                        uradoraHits: 0,
                        dealInScore: 0,
                        tsumoLossScore: 0,
                        tileEfficiency: 0.65,
                        luckScore: 32.0,
                        skillScore: 48.0,
                        isWin: false,
                        isRiichi: false,
                        isFuro: false,
                        isDamaten: false,
                        isInitiative: false
                    }
                ]
            }
        ]
    }

    const detail = await service.getPaipuDetail('amae-sync-3p-10001-1')
    assert.strictEqual(detail.id, 'amae-sync-3p-10001-1')
    assert.strictEqual(detail.players.length, 3)
    assert.strictEqual(detail.rounds.length, 1)

    const round0 = detail.rounds[0]
    assert.ok(round0 !== undefined)
    assert.strictEqual(round0.roundName, '동1국')
    assert.strictEqual(round0.startingHands.length, 3)
    assert.strictEqual(round0.startingHands[0]?.length, 13)
    assert.ok(round0.result !== undefined)
    assert.strictEqual(round0.result.type, 'ron')
    assert.deepStrictEqual(round0.result.winnerSeats, [0])
    assert.strictEqual(round0.result.loserSeat, 1)
    assert.strictEqual(round0.result.score, 8000)
    assert.ok(round0.result.summaryKo.includes('1번가 론 화료'))
    assert.ok(round0.roundMetrics !== undefined)
    assert.strictEqual(round0.roundMetrics.length, 3)
    assert.strictEqual(round0.roundMetrics[0]?.startingShanten, 1)
})

class MockBatchDeduplicationService extends PaipuService {
    public readonly importedGameIds: string[] = []
    public readonly existingDbGameIds: Set<string> = new Set<string>(['existing-game-uuid'])

    public constructor() {
        super(new MockPrismaService())
    }

    protected override async findExistingGameIds(uuids: readonly string[]): Promise<Set<string>> {
        const found = new Set<string>()
        for (const u of uuids) {
            if (this.existingDbGameIds.has(u)) {
                found.add(u)
            }
        }
        return found
    }

    public override async importPaipu(urlOrUuid: string): Promise<{ success: boolean; gameId: string }> {
        const uuid = this.extractUuid(urlOrUuid)
        if (uuid.includes('fail-import')) {
            throw new Error('Import failed')
        }
        this.importedGameIds.push(uuid)
        return { success: true, gameId: uuid }
    }
}

test('PaipuService - importBatch deduplicates inputs and categorizes new, existing, and failed', async () => {
    const service = new MockBatchDeduplicationService()

    const inputs = [
        'https://game.maj-soul.com/1/?paipu=new-game-1',
        'new-game-1', // duplicate of new-game-1
        '  existing-game-uuid  ', // existing in DB
        'https://game.maj-soul.com/1/?paipu=existing-game-uuid', // duplicate of existing
        'new-game-2',
        'fail-import-game',
        'fail-import-game', // duplicate of failing input
        '   ', // blank line, ignored by trim
        '' // empty line
    ]

    const result = await service.importBatch(inputs)

    assert.strictEqual(result.total, 4) // new-game-1, existing-game-uuid, new-game-2, fail-import-game
    assert.strictEqual(result.imported, 2) // new-game-1, new-game-2
    assert.strictEqual(result.existing, 1) // existing-game-uuid
    assert.strictEqual(result.failed, 1) // fail-import-game (deduplicated!)
    assert.deepStrictEqual(result.gameIds, ['new-game-1', 'existing-game-uuid', 'new-game-2'])
    assert.deepStrictEqual(service.importedGameIds, ['new-game-1', 'new-game-2'])
})

test('ImportBatchAsyncDto - runtime validation', () => {
    /*_ GEMINI THINKING _*/
    // Should reject non-object or null/undefined
    assert.throws(() => ImportBatchAsyncDto.validate(null), BadRequestException)
    assert.throws(() => ImportBatchAsyncDto.validate(undefined), BadRequestException)
    assert.throws(() => ImportBatchAsyncDto.validate('invalid-string'), BadRequestException)
    assert.throws(() => ImportBatchAsyncDto.validate([]), BadRequestException)

    // Should reject missing urls and missing inputs
    assert.throws(() => ImportBatchAsyncDto.validate({}), BadRequestException)

    // Should reject non-array urls
    assert.throws(() => ImportBatchAsyncDto.validate({ urls: 'not-an-array' }), BadRequestException)
    assert.throws(() => ImportBatchAsyncDto.validate({ urls: 123 }), BadRequestException)

    // Should reject empty array (< 1 item)
    assert.throws(() => ImportBatchAsyncDto.validate({ urls: [] }), BadRequestException)

    // Should reject array exceeding 100 items
    const tooManyUrls = Array.from({ length: 101 }, (_, i) => `https://game.maj-soul.com/1/?paipu=test-${i}`)
    assert.throws(() => ImportBatchAsyncDto.validate({ urls: tooManyUrls }), BadRequestException)

    // Should reject non-string items or empty trimmed items
    assert.throws(() => ImportBatchAsyncDto.validate({ urls: [123] }), BadRequestException)
    assert.throws(() => ImportBatchAsyncDto.validate({ urls: [''] }), BadRequestException)
    assert.throws(() => ImportBatchAsyncDto.validate({ urls: ['   '] }), BadRequestException)

    // Should reject item exceeding 500 characters
    const tooLongUrl = 'https://game.maj-soul.com/1/?paipu=' + 'x'.repeat(501)
    assert.throws(() => ImportBatchAsyncDto.validate({ urls: [tooLongUrl] }), BadRequestException)

    // Should accept valid urls and trim each item
    const valid = ImportBatchAsyncDto.validate({
        urls: [
            '  https://game.maj-soul.com/1/?paipu=uuid-1  ',
            'https://game.maj-soul.com/1/?paipu=uuid-2'
        ]
    })
    assert.strictEqual(valid.urls.length, 2)
    assert.strictEqual(valid.urls[0], 'https://game.maj-soul.com/1/?paipu=uuid-1')
    assert.strictEqual(valid.urls[1], 'https://game.maj-soul.com/1/?paipu=uuid-2')

    // Should accept inputs as fallback alias
    const fallback = ImportBatchAsyncDto.validate({
        inputs: ['https://game.maj-soul.com/1/?paipu=uuid-fallback']
    })
    assert.strictEqual(fallback.urls.length, 1)
    assert.strictEqual(fallback.urls[0], 'https://game.maj-soul.com/1/?paipu=uuid-fallback')

    // Fast path when already instantiated
    const alreadyDto = new ImportBatchAsyncDto(['uuid-direct'])
    assert.strictEqual(ImportBatchAsyncDto.validate(alreadyDto), alreadyDto)

    // Pipe validation
    const pipe = new ImportBatchAsyncPipe()
    const piped = pipe.transform({ urls: ['uuid-pipe'] })
    assert.strictEqual(piped.urls[0], 'uuid-pipe')
})

class MockAsyncBatchService extends PaipuService {
    public readonly processedUuids: string[] = []

    public constructor() {
        super(new MockPrismaService())
    }

    protected override readonly rateLimitDelayMs: number = 0

    protected override async delay(_ms: number): Promise<void> {
        return
    }

    public override async importPaipu(urlOrUuid: string): Promise<{ success: boolean; gameId: string }> {
        const uuid = this.extractUuid(urlOrUuid)
        if (uuid.includes('fail-import')) {
            throw new Error(`Intentional test import error for ${uuid}`)
        }
        this.processedUuids.push(uuid)
        return { success: true, gameId: uuid }
    }

    public async waitForJob(jobId: string, timeoutMs: number = 2000): Promise<BatchPaipuJobStatus> {
        const start = Date.now()
        while (Date.now() - start < timeoutMs) {
            const status = this.getBatchStatus(jobId)
            if (status.isFinished) {
                return status
            }
            await new Promise((resolve) => setTimeout(resolve, 10))
        }
        return this.getBatchStatus(jobId)
    }
}

test('PaipuService - startBatchAsync processes queue, handles deduplication, failures and status polling', async () => {
    /*_ GEMINI THINKING _*/
    const service = new MockAsyncBatchService()

    const inputUrls = [
        'https://game.maj-soul.com/1/?paipu=async-game-1',
        'async-game-1', // duplicate in batch
        'https://game.maj-soul.com/1/?paipu=fail-import-1', // failing item
        '   ' // blank item
    ]

    const init = await service.startBatchAsync(inputUrls)
    assert.ok(init.jobId.startsWith('job_'))
    assert.strictEqual(init.total, 4)

    // Poll until completion
    const finalStatus = await service.waitForJob(init.jobId)

    assert.strictEqual(finalStatus.jobId, init.jobId)
    assert.strictEqual(finalStatus.total, 4)
    assert.strictEqual(finalStatus.completed, 2) // 1 successful + 1 duplicate
    assert.strictEqual(finalStatus.failed, 2) // 1 error + 1 blank
    assert.strictEqual(finalStatus.progressPercent, 100)
    assert.strictEqual(finalStatus.isFinished, true)
    assert.strictEqual(finalStatus.errors.length, 2)
    assert.ok(finalStatus.errors.some((e) => e.includes('fail-import-1')))
    assert.ok(finalStatus.errors.some((e) => e.includes('빈 입력값')))
    assert.deepStrictEqual(finalStatus.gameIds, ['async-game-1'])

    // getBatchStatus throws NotFoundException for invalid jobId
    assert.throws(
        () => service.getBatchStatus('invalid-non-existent-job-id'),
        NotFoundException
    )
})

class MockFatalBatchService extends PaipuService {
    public constructor() {
        super(new MockPrismaService())
    }

    protected override readonly rateLimitDelayMs: number = 0

    protected override async delay(_ms: number): Promise<void> {
        throw new Error('Fatal unexpected loop failure')
    }

    public testCleanupOldJobs(): void {
        this.cleanupOldJobs()
    }

    public addMockJob(jobId: string, isFinished: boolean, createdAt: number): void {
        this.batchJobs.set(jobId, {
            jobId,
            total: 1,
            completed: isFinished ? 1 : 0,
            failed: 0,
            isFinished,
            errors: [],
            gameIds: [],
            createdAt
        })
    }

    public hasJob(jobId: string): boolean {
        return this.batchJobs.has(jobId)
    }

    public getJobCount(): number {
        return this.batchJobs.size
    }
}

test('PaipuService - processBatchJob guarantees isFinished=true on fatal error and cleanupOldJobs preserves active jobs', async () => {
    /*_ GEMINI THINKING _*/
    const service = new MockFatalBatchService()

    // 1. Test fatal error in processBatchJob guarantees isFinished = true
    const init = await service.startBatchAsync(['https://game.maj-soul.com/1/?paipu=fatal-1'])
    // Wait for the async processBatchJob to finish
    let attempts = 0
    let status = service.getBatchStatus(init.jobId)
    while (!status.isFinished && attempts < 20) {
        await new Promise((resolve) => setTimeout(resolve, 10))
        status = service.getBatchStatus(init.jobId)
        attempts++
    }
    assert.strictEqual(status.isFinished, true)

    // 2. Test cleanupOldJobs with > 200 jobs preserves active jobs (!isFinished)
    const activeJobId = 'active-important-job'
    service.addMockJob(activeJobId, false, Date.now()) // In-flight active job

    // Add 210 finished jobs
    for (let i = 0; i < 210; i++) {
        service.addMockJob(`finished-job-${i}`, true, Date.now())
    }

    assert.ok(service.getJobCount() > 200)
    service.testCleanupOldJobs()

    // Active job MUST still be preserved!
    assert.strictEqual(service.hasJob(activeJobId), true)
    assert.ok(service.getJobCount() <= 201)
})


class MockProtobufPipelineService extends PaipuService {
    public capturedRecord: MajsoulGameRecord | null = null
    public capturedEncodedProto: Uint8Array | null = null
    private readonly mockBuffer: Uint8Array

    public constructor(protoBuffer: Uint8Array) {
        super(new MockPrismaService())
        this.mockBuffer = protoBuffer
    }

    protected override async findExistingGame(_uuid: string): Promise<{ id: string } | null> {
        return null
    }

    protected override async fetchPaipuProtobuf(_uuid: string): Promise<Uint8Array | null> {
        return this.mockBuffer
    }

    public override async saveGameRecord(gameRecord: MajsoulGameRecord): Promise<{ success: boolean; gameId: string }> {
        this.capturedRecord = gameRecord
        this.capturedEncodedProto = new LiqiBinaryDecoder().encode(gameRecord)
        return { success: true, gameId: gameRecord.uuid }
    }
}

test('PaipuService - Protobuf decoder integration and RoundMetric rich indicator decoding', async () => {
    /*_ GEMINI THINKING _*/
    const decoder = new LiqiBinaryDecoder()
    const encodedProto = decoder.encode(SAMPLE_MAJSOUL_GAME)

    const service = new MockProtobufPipelineService(encodedProto)
    const result = await service.importPaipu('https://game.maj-soul.com/1/?paipu=' + SAMPLE_MAJSOUL_GAME.uuid)

    assert.strictEqual(result.success, true)
    assert.strictEqual(result.gameId, SAMPLE_MAJSOUL_GAME.uuid)
    assert.ok(service.capturedRecord !== null)
    assert.strictEqual(service.capturedRecord.uuid, SAMPLE_MAJSOUL_GAME.uuid)
    assert.strictEqual(service.capturedRecord.rounds.length, 2)
    assert.ok(service.capturedEncodedProto !== null)
    assert.ok(service.capturedEncodedProto.length > 0)

    // Verify round metrics rich extraction from the decoded game record
    const parser = new PaipuParser()
    const parsed = parser.parseGameRecord(service.capturedRecord)
    assert.strictEqual(parsed.detail.rounds.length, 2)
    assert.ok(parsed.roundMetrics.length > 0)

    // Check that roundMetrics has isWin, isRiichi, isFuro, isDamaten, isInitiative flags
    const firstMetric = parsed.roundMetrics[0]
    assert.ok(firstMetric !== undefined)
    assert.strictEqual(typeof firstMetric.isWin, 'boolean')
    assert.strictEqual(typeof firstMetric.isRiichi, 'boolean')
    assert.strictEqual(typeof firstMetric.isFuro, 'boolean')
    assert.strictEqual(typeof firstMetric.isDamaten, 'boolean')
    assert.strictEqual(typeof firstMetric.isInitiative, 'boolean')
})


