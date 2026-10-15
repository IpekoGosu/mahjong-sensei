import { Controller, Post, Get, Body, Param } from '@nestjs/common'
import { PaipuService } from './paipu.service'
import { ImportPaipuDto } from './dto/import-paipu.dto'
import { PaipuDetail } from '@mahjong-sensei/types'

@Controller('paipu')
export class PaipuController {
    public constructor(private readonly paipuService: PaipuService) {}

    @Post('import')
    public async import(@Body() dto: ImportPaipuDto): Promise<{ success: boolean; gameId: string }> {
        return await this.paipuService.importPaipu(dto.urlOrUuid)
    }

    @Get(':id')
    public async getDetail(@Param('id') id: string): Promise<PaipuDetail> {
        return await this.paipuService.getPaipuDetail(id)
    }
}
