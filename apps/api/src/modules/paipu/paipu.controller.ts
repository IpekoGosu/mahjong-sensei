import { Controller, Post, Get, Body, Param } from '@nestjs/common'
import { PaipuService } from './paipu.service'
import { ImportPaipuDto, ImportPaipuPipe } from './dto/import-paipu.dto'
import { ImportBatchPaipuDto, ImportBatchPaipuPipe } from './dto/import-batch-paipu.dto'
import { ImportBatchAsyncDto, ImportBatchAsyncPipe } from './dto/import-batch-async.dto'
import { UploadPaipuDto, UploadPaipuPipe } from './dto/upload-paipu.dto'
import {
    PaipuDetail,
    BatchImportPaipuResult,
    BatchPaipuJobStatus,
    BatchAsyncImportResponse
} from '@mahjong-sensei/types'

@Controller('paipu')
export class PaipuController {
    public constructor(private readonly paipuService: PaipuService) {}

    @Post('import')
    public async import(@Body(new ImportPaipuPipe()) dto: ImportPaipuDto): Promise<{
        readonly success: boolean
        readonly gameId: string
    }> {
        /*_ GEMINI THINKING _*/
        const validated = ImportPaipuDto.validate(dto)
        return await this.paipuService.importPaipu(validated.urlOrUuid)
    }

    @Post('upload')
    public async upload(@Body(new UploadPaipuPipe()) dto: UploadPaipuDto): Promise<{
        readonly success: boolean
        readonly gameId: string
    }> {
        /*_ GEMINI THINKING _*/
        return await this.paipuService.importRawPaipu(dto.content, dto.format)
    }

    @Post('import-batch')
    public async importBatch(@Body(new ImportBatchPaipuPipe()) dto: ImportBatchPaipuDto): Promise<BatchImportPaipuResult> {
        /*_ GEMINI THINKING _*/
        const validated = ImportBatchPaipuDto.validate(dto)
        return await this.paipuService.importBatch(validated.inputs)
    }

    @Post('batch-async')
    public async importBatchAsync(
        @Body(new ImportBatchAsyncPipe()) dto: ImportBatchAsyncDto
    ): Promise<BatchAsyncImportResponse> {
        /*_ GEMINI THINKING _*/
        const validated = ImportBatchAsyncDto.validate(dto)
        return await this.paipuService.startBatchAsync(validated.urls)
    }

    @Get('batch-status/:jobId')
    public getBatchStatus(@Param('jobId') jobId: string): BatchPaipuJobStatus {
        /*_ GEMINI THINKING _*/
        return this.paipuService.getBatchStatus(jobId)
    }

    @Get(':id')
    public async getDetail(@Param('id') id: string): Promise<PaipuDetail> {
        return await this.paipuService.getPaipuDetail(id)
    }
}


