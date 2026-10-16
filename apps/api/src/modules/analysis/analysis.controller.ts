import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common'
import { AnalysisService } from './analysis.service'
import { GameMode, RollingWindowSize, RollingWindowStats } from '@mahjong-sensei/types'

@Controller('analysis')
export class AnalysisController {
    public constructor(private readonly analysisService: AnalysisService) {}

    @Get('rolling')
    public async getRolling(
        @Query('accountId', new DefaultValuePipe(10001), ParseIntPipe) accountId: number,
        @Query('window', new DefaultValuePipe(10), ParseIntPipe) windowSize: number,
        @Query('mode') mode: GameMode = '3p'
    ): Promise<RollingWindowStats> {
        const validWindow: RollingWindowSize = (windowSize === 30 || windowSize === 50) ? windowSize : 10
        const validMode: GameMode = mode === '4p' ? '4p' : '3p'
        return await this.analysisService.getRollingStats(accountId, validWindow, validMode)
    }
}
