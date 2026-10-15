import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'
import { PaipuModule } from './modules/paipu/paipu.module'
import { AnalysisModule } from './modules/analysis/analysis.module'

@Module({
    imports: [
        PrismaModule,
        PaipuModule,
        AnalysisModule
    ]
})
export class AppModule {}
