import { Module } from '@nestjs/common'
import { PaipuController } from './paipu.controller'
import { PaipuService } from './paipu.service'

@Module({
    controllers: [PaipuController],
    providers: [PaipuService],
    exports: [PaipuService]
})
export class PaipuModule {}
