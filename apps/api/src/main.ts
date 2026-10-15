import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule)

    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true
    })

    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000
    await app.listen(port)
    console.log(`[Mahjong Sensei API] Server running on port ${port}`)
}

void bootstrap()
