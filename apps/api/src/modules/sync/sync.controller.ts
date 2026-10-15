import { Controller, Post, Query } from '@nestjs/common'
import { AmaeKoromoService } from './amae-koromo.service'

@Controller('sync')
export class SyncController {
    public constructor(private readonly syncService: AmaeKoromoService) {}

    @Post('player')
    public async syncPlayer(@Query('nickname') nickname: string): Promise<{
        success: boolean
        accountId: number
        nickname: string
        totalGames: number
        avgRank: number
        winRate: number
        dealInRate: number
        luckScore: number
        skillScore: number
    }> {
        return await this.syncService.syncPlayerByNickname(nickname)
    }
}
