import { Controller, Post, Body } from '@nestjs/common'
import { PaipuService } from './paipu.service'
import { ImportPaipuDto } from './dto/import-paipu.dto'

@Controller('paipu')
export class PaipuController {
    public constructor(private readonly paipuService: PaipuService) {}

    @Post('import')
    public async import(@Body() dto: ImportPaipuDto): Promise<{ success: boolean; gameId: string }> {
        return await this.paipuService.importPaipu(dto.urlOrUuid)
    }
}
