import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { PaipuModule } from './modules/paipu/paipu.module'
import { AnalysisModule } from './modules/analysis/analysis.module'
import { SyncModule } from './modules/sync/sync.module'

@Module({
    imports: [
        PrismaModule,
        PaipuModule,
        AnalysisModule,
        SyncModule
    ]
})
export class AppModule {}
