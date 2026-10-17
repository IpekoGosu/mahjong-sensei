import { Module } from '@nestjs/common'
import { AnalysisController } from './analysis.controller'
import { AnalysisService } from './analysis.service'
import { TierBenchmarkService } from './tier-benchmark.service'

@Module({
    controllers: [AnalysisController],
    providers: [AnalysisService, TierBenchmarkService],
    exports: [AnalysisService, TierBenchmarkService]
})
export class AnalysisModule {}

