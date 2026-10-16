import { Controller, Post, Query } from '@nestjs/common'
import { AmaeKoromoService, SyncPlayerResult } from './amae-koromo.service'
import { GameMode } from '@mahjong-sensei/types'

@Controller('sync')
export class SyncController {
    public constructor(private readonly syncService: AmaeKoromoService) {}

    @Post('player')
    public async syncPlayer(
        @Query('nickname') nickname: string,
        @Query('mode') mode: GameMode = '4p'
    ): Promise<SyncPlayerResult> {
        const validMode: GameMode = mode === '3p' ? '3p' : '4p'
        return await this.syncService.syncPlayerByNickname(nickname, validMode)
    }
}
