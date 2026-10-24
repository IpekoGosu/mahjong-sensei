import { Controller, Post, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common'
import { AmaeKoromoService, SyncPlayerResult } from './amae-koromo.service'
import { GameMode } from '@mahjong-sensei/types'

@Controller('sync')
export class SyncController {
    public constructor(private readonly syncService: AmaeKoromoService) {}

    @Post('player')
    public async syncPlayer(
        @Query('nickname') nickname: string,
        @Query('mode') mode: GameMode = '4p',
        @Query('count', new DefaultValuePipe(100), ParseIntPipe) count: number = 100
    ): Promise<SyncPlayerResult> {
        const validMode: GameMode = mode === '3p' ? '3p' : '4p'
        const validCount = Math.min(Math.max(count, 10), 100)
        return await this.syncService.syncPlayerByNickname(nickname, validMode, validCount)
    }
}
