import test from 'node:test'
import assert from 'node:assert'
import { BadRequestException } from '@nestjs/common'
import { PaipuController } from './paipu.controller'
import { PaipuService } from './paipu.service'
import { PrismaService } from '../../prisma/prisma.service'
import { ImportPaipuDto, ImportPaipuPipe } from './dto/import-paipu.dto'
import { ImportBatchPaipuDto, ImportBatchPaipuPipe } from './dto/import-batch-paipu.dto'
import { UploadPaipuDto, UploadPaipuPipe } from './dto/upload-paipu.dto'

class MockPrismaService extends PrismaService {
    public constructor() {
        super()
    }
}

class MockPaipuService extends PaipuService {
    public constructor() {
        super(new MockPrismaService())
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

    // Controller upload validation
    await assert.rejects(
        async () => await controller.upload({ content: '' }),
        BadRequestException
    )

    const uploadRes = await controller.upload({ content: '{"uuid":"test"}', format: 'json' })
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

