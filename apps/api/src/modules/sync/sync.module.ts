import { Module } from '@nestjs/common'
import { SyncController } from './sync.controller'
import { AmaeKoromoService } from './amae-koromo.service'

@Module({
    controllers: [SyncController],
    providers: [AmaeKoromoService],
    exports: [AmaeKoromoService]
})
export class SyncModule {}
