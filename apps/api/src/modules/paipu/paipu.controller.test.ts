import test from 'node:test'
import assert from 'node:assert'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { PaipuController } from './paipu.controller'
import { PaipuService, GameWithDetailRelations } from './paipu.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ImportPaipuDto, ImportPaipuPipe } from './dto/import-paipu.dto'
import { ImportBatchPaipuDto, ImportBatchPaipuPipe } from './dto/import-batch-paipu.dto'
import { UploadPaipuDto, UploadPaipuPipe } from './dto/upload-paipu.dto'
import { SAMPLE_MAJSOUL_GAME, LiqiBinaryDecoder } from '@mahjong-sensei/mahjong-core'

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

    public override async importBatch(inputs: readonly string[]): Promise<{
        readonly total: number
        readonly imported: number
        readonly failed: number
        readonly gameIds: readonly string[]
    }> {
        return {
            total: inputs.length,
            imported: inputs.length,
            failed: 0,
            gameIds: inputs
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
        { seat: 2, startShanten: 3, startDoraCount: 0 }
    ], true)

    assert.strictEqual(hands3P.length, 3)
    assert.strictEqual(hands3P[0]?.length, 13)
    assert.strictEqual(hands3P[1]?.length, 13)
    assert.ok(hands3P[1]?.includes('0p'))
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

