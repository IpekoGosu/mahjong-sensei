/*_ GEMINI THINKING _*/
import { Controller, Get, Param, Query, ParseIntPipe, ParseFloatPipe, DefaultValuePipe, Header } from '@nestjs/common'
import { AnalysisService } from './analysis.service'
import { TierBenchmarkService, TierComparisonResult } from './tier-benchmark.service'
import { RollingQueryDto } from './dto/rolling-query.dto'
import { GameMode, RollingWindowSize, RollingWindowStats, GameCoachingReport } from '@mahjong-sensei/types'

@Controller('analysis')
export class AnalysisController {
    public constructor(
        private readonly analysisService: AnalysisService,
        private readonly tierBenchmarkService: TierBenchmarkService
    ) {}

    @Get('rolling')
    public async getRolling(
        @Query('accountId', new DefaultValuePipe(10001), ParseIntPipe) accountId: number,
        @Query('window') windowParam?: string | number,
        @Query('limit') limitParam?: string | number,
        @Query('mode') mode: GameMode = '3p'
    ): Promise<RollingWindowStats> {
        const rawWindow = (windowParam !== undefined && windowParam !== null && windowParam !== '')
            ? windowParam
            : limitParam
        const validWindow: RollingWindowSize = RollingQueryDto.parseWindow(rawWindow)
        const validMode: GameMode = RollingQueryDto.parseMode(mode)
        return await this.analysisService.getRollingStats(accountId, validWindow, validMode)
    }

    @Get('benchmarks')
    public getBenchmarks(
        @Query('mode') mode: GameMode = '4p',
        @Query('tier', new DefaultValuePipe('EXPERT')) tier: string,
        @Query('luckScore', new DefaultValuePipe(50), ParseFloatPipe) luckScore: number,
        @Query('skillScore', new DefaultValuePipe(50), ParseFloatPipe) skillScore: number
    ): TierComparisonResult {
        const validMode: GameMode = mode === '3p' ? '3p' : '4p'
        return this.tierBenchmarkService.getTierComparison(validMode, tier, luckScore, skillScore)
    }

    @Get('share-card')
    @Header('Content-Type', 'image/svg+xml')
    public getShareCard(
        @Query('nickname', new DefaultValuePipe('마작선수')) nickname: string,
        @Query('mode') mode: GameMode = '4p',
        @Query('tierLabel', new DefaultValuePipe('작걸 (Expert)')) tierLabel: string,
        @Query('luckScore', new DefaultValuePipe(50), ParseFloatPipe) luckScore: number,
        @Query('skillScore', new DefaultValuePipe(50), ParseFloatPipe) skillScore: number,
        @Query('winRate', new DefaultValuePipe(22.0), ParseFloatPipe) winRate: number,
        @Query('dealInRate', new DefaultValuePipe(13.0), ParseFloatPipe) dealInRate: number,
        @Query('quadrant') quadrant?: string
    ): string {
        const validMode: GameMode = mode === '3p' ? '3p' : '4p'
        return this.tierBenchmarkService.generateShareCardSvg({
            nickname,
            mode: validMode,
            tierLabel,
            luckScore,
            skillScore,
            winRate,
            dealInRate,
            quadrant
        })
    }

    @Get('coaching/:gameId')
    public async getCoaching(
        @Param('gameId') gameId: string,
        @Query('accountId', new ParseIntPipe({ optional: true })) accountId?: number
    ): Promise<GameCoachingReport> {
        return await this.analysisService.getCoachingReport(gameId, accountId)
    }
}


