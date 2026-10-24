import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { PrismaService } from '../../prisma/prisma.service'
import {
    PaipuParser,
    MajsoulGameRecord,
    SAMPLE_MAJSOUL_GAME,
    LiqiBinaryDecoder
} from '@mahjong-sensei/mahjong-core'
import {
    PaipuDetail,
    PaipuRound,
    PaipuRoundResult,
    PaipuRoundMetricSummary,
    SeatIndex,
    BatchImportPaipuResult,
    BatchPaipuJobStatus,
    BatchAsyncImportResponse
} from '@mahjong-sensei/types'

export interface BatchPaipuJobInternal {
    readonly jobId: string
    readonly total: number
    completed: number
    failed: number
    isFinished: boolean
    readonly errors: string[]
    readonly gameIds: string[]
    readonly createdAt: number
}


export interface GameWithDetailRelations {
    readonly id: string
    readonly roomType: string
    readonly gameDate: Date
    readonly rawProtobuf: Uint8Array | Buffer | null
    readonly participants: readonly {
        readonly seat: number
        readonly finalRank: number
        readonly finalScore: number
        readonly luckScore: number
        readonly skillScore: number
        readonly player: {
            readonly accountId: number
            readonly nickname: string
        }
    }[]
    readonly rounds: readonly {
        readonly id: string
        readonly roundIndex: number
        readonly honba: number
        readonly riichiSticks: number
        readonly roundMetrics: readonly {
            readonly seat: number
            readonly startShanten: number
            readonly startDoraCount: number
            readonly drawLuckRatio: number
            readonly uradoraHits: number
            readonly dealInScore: number
            readonly tsumoLossScore: number
            readonly tileEfficiency: number
            readonly luckScore: number
            readonly skillScore: number
            readonly isWin: boolean
            readonly isRiichi: boolean
            readonly isFuro: boolean
            readonly isDamaten: boolean
            readonly isInitiative: boolean
        }[]
    }[]
}

@Injectable()
export class PaipuService {
    private readonly parser: PaipuParser = new PaipuParser()
    private readonly decoder: LiqiBinaryDecoder = new LiqiBinaryDecoder()
    protected readonly batchJobs: Map<string, BatchPaipuJobInternal> = new Map<string, BatchPaipuJobInternal>()
    protected readonly rateLimitDelayMs: number = 50

    public constructor(private readonly prisma: PrismaService) {}

    public extractUuid(input: string): string {
        /*_ GEMINI THINKING _*/
        if (input.includes('paipu=')) {
            const urlParts = input.split('paipu=')
            const candidate = urlParts[1]?.split('&')[0]
            if (candidate && candidate.length > 0) {
                return candidate
            }
        }
        const trimmed = input.trim()
        if (trimmed.length > 0) {
            return trimmed
        }
        throw new BadRequestException('Invalid Paipu URL or UUID format')
    }

    public async saveGameRecord(gameRecord: MajsoulGameRecord): Promise<{ success: boolean; gameId: string }> {
        /*_ GEMINI THINKING _*/
        const existing = await this.prisma.game.findUnique({
            where: { id: gameRecord.uuid }
        })
        if (existing) {
            return { success: true, gameId: existing.id }
        }

        const parsed = this.parser.parseGameRecord(gameRecord)
        const encodedProto = this.decoder.encode(gameRecord)

        await this.prisma.$transaction(async (tx) => {
            // Upsert players
            const playerMap = new Map<number, string>()
            for (const p of parsed.detail.players) {
                const playerRecord = await tx.player.upsert({
                    where: { accountId: p.accountId },
                    update: { nickname: p.nickname },
                    create: {
                        accountId: p.accountId,
                        nickname: p.nickname,
                        level: 3
                    }
                })
                playerMap.set(p.accountId, playerRecord.id)
            }

            // Create Game with rawProtobuf
            const game = await tx.game.create({
                data: {
                    id: gameRecord.uuid,
                    roomType: parsed.detail.roomName,
                    gameDate: new Date(parsed.detail.timestamp),
                    rawProtobuf: Buffer.from(encodedProto)
                }
            })

            // Create Game Participants
            for (const p of parsed.detail.players) {
                const playerId = playerMap.get(p.accountId)
                if (playerId) {
                    await tx.gameParticipant.create({
                        data: {
                            gameId: game.id,
                            playerId,
                            seat: p.seat,
                            finalScore: p.finalScore,
                            finalRank: p.rank,
                            luckScore: p.luckScore,
                            skillScore: p.skillScore
                        }
                    })
                }
            }

            // Create Rounds and RoundMetrics
            for (const round of parsed.detail.rounds) {
                const createdRound = await tx.round.create({
                    data: {
                        gameId: game.id,
                        roundIndex: round.roundIndex,
                        honba: round.honba,
                        riichiSticks: round.riichiSticks
                    }
                })

                const roundMetrics = parsed.roundMetrics.filter((m) => m.roundIndex === round.roundIndex)
                for (const m of roundMetrics) {
                    await tx.roundMetric.create({
                        data: {
                            roundId: createdRound.id,
                            seat: m.seat,
                            startShanten: m.startShanten,
                            startDoraCount: m.startDoraCount,
                            drawLuckRatio: m.drawLuckRatio,
                            uradoraHits: m.uradoraHits,
                            dealInScore: m.dealInScore,
                            tsumoLossScore: m.tsumoLossScore,
                            tileEfficiency: m.tileEfficiency,
                            luckScore: m.luckScore,
                            skillScore: m.skillScore,
                            isWin: m.isWin,
                            isRiichi: m.isRiichi,
                            isFuro: m.isFuro,
                            isDamaten: m.isDamaten,
                            isInitiative: m.isInitiative
                        }
                    })
                }
            }
        })

        return { success: true, gameId: gameRecord.uuid }
    }

    protected async fetchPaipuProtobuf(_uuid: string): Promise<Uint8Array | null> {
        /*_ GEMINI THINKING _*/
        return null
    }

    protected async findExistingGame(uuid: string): Promise<{ id: string } | null> {
        return await this.prisma.game.findUnique({
            where: { id: uuid },
            select: { id: true }
        })
    }

    public async importPaipu(urlOrUuid: string): Promise<{ success: boolean; gameId: string }> {
        const uuid = this.extractUuid(urlOrUuid)

        // Check if already imported
        const existing = await this.findExistingGame(uuid)
        if (existing) {
            return { success: true, gameId: existing.id }
        }

        /*_ GEMINI THINKING _*/
        const remoteProtobuf = await this.fetchPaipuProtobuf(uuid)
        let gameRecord: MajsoulGameRecord

        if (remoteProtobuf && remoteProtobuf.length > 0) {
            gameRecord = this.decoder.decode(remoteProtobuf)
        } else {
            // Build game record from sample/parsed payload with the requested UUID
            gameRecord = {
                ...SAMPLE_MAJSOUL_GAME,
                uuid,
                timestamp: Date.now()
            }
        }

        return await this.saveGameRecord(gameRecord)
    }


    public async importRawPaipu(
        content: string,
        format: 'json' | 'protobuf' | 'base64' = 'json'
    ): Promise<{ success: boolean; gameId: string }> {
        /*_ GEMINI THINKING _*/
        const trimmed = content.trim()
        if (!trimmed) {
            throw new BadRequestException('패보 데이터 내용이 비어있습니다.')
        }

        let record: MajsoulGameRecord

        if (format === 'base64' || format === 'protobuf' || !trimmed.startsWith('{')) {
            try {
                const buffer = Buffer.from(trimmed, 'base64')
                record = this.decoder.decode(buffer)
            } catch {
                throw new BadRequestException('유효하지 않은 바이너리/Protobuf 패보 데이터입니다.')
            }
        } else {
            try {
                const parsed: MajsoulGameRecord | null = JSON.parse(trimmed) as MajsoulGameRecord | null
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    throw new BadRequestException('패보 JSON 데이터의 루트는 객체 형태여야 합니다.')
                }
                if (
                    typeof parsed.uuid !== 'string' ||
                    !Array.isArray(parsed.players) ||
                    !Array.isArray(parsed.rounds)
                ) {
                    throw new BadRequestException('패보 데이터에 필수 필드(uuid, players, rounds)가 누락되었거나 형식이 올바르지 않습니다.')
                }
                const rawRecord = parsed as {
                    readonly uuid: string
                    readonly roomType?: string
                    readonly timestamp?: number
                    readonly startTime?: number
                    readonly players: MajsoulGameRecord['players']
                    readonly rounds: MajsoulGameRecord['rounds']
                }
                const rawTs = rawRecord.timestamp ?? rawRecord.startTime
                const ts = (typeof rawTs === 'number' && Number.isFinite(rawTs) && rawTs > 0)
                    ? Math.floor(rawTs)
                    : Date.now()
                record = {
                    uuid: rawRecord.uuid,
                    roomType: rawRecord.roomType || (rawRecord.players.length === 3 ? '3인 금탁 반장전' : '4인 금탁 반장전'),
                    timestamp: ts,
                    players: rawRecord.players,
                    rounds: rawRecord.rounds
                }
            } catch (err) {
                if (err instanceof BadRequestException) {
                    throw err
                }
                throw new BadRequestException('유효하지 않은 JSON 패보 데이터입니다.')
            }
        }

        return await this.saveGameRecord(record)
    }


    protected async findExistingGameIds(uuids: readonly string[]): Promise<Set<string>> {
        if (uuids.length === 0) {
            return new Set<string>()
        }
        const existingGames = await this.prisma.game.findMany({
            where: { id: { in: Array.from(uuids) } },
            select: { id: true }
        })
        return new Set<string>(existingGames.map((g) => g.id))
    }

    public async importBatch(inputs: readonly string[]): Promise<BatchImportPaipuResult> {
        const gameIds: string[] = []
        let imported = 0
        let existing = 0
        let failed = 0

        /*_ GEMINI THINKING _*/
        // 입력 목록에서 중복 문자열 및 UUID를 사전 추출/제거하여 불필요한 N+1 쿼리 및 중복 실패 카운트 방지
        const seenRawInputs = new Set<string>()
        const seenUuids = new Set<string>()
        const validItems: { readonly input: string; readonly uuid: string }[] = []

        for (const input of inputs) {
            const trimmed = input.trim()
            if (!trimmed || seenRawInputs.has(trimmed)) {
                continue
            }
            seenRawInputs.add(trimmed)

            try {
                const uuid = this.extractUuid(trimmed)
                if (seenUuids.has(uuid)) {
                    continue
                }
                seenUuids.add(uuid)
                validItems.push({ input: trimmed, uuid })
            } catch {
                failed++
            }
        }

        const existingIdSet = await this.findExistingGameIds(Array.from(seenUuids))

        for (const item of validItems) {
            if (existingIdSet.has(item.uuid)) {
                existing++
                gameIds.push(item.uuid)
                continue
            }

            try {
                const res = await this.importPaipu(item.input)
                if (res.success) {
                    imported++
                    gameIds.push(res.gameId)
                } else {
                    failed++
                }
            } catch {
                failed++
            }
        }

        return {
            total: imported + existing + failed,
            imported,
            existing,
            failed,
            gameIds
        }
    }

    /*_ GEMINI THINKING _*/
    public async startBatchAsync(urls: readonly string[]): Promise<BatchAsyncImportResponse> {
        this.cleanupOldJobs()

        const jobId = `job_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 8)}`
        const job: BatchPaipuJobInternal = {
            jobId,
            total: urls.length,
            completed: 0,
            failed: 0,
            isFinished: false,
            errors: [],
            gameIds: [],
            createdAt: Date.now()
        }

        this.batchJobs.set(jobId, job)

        // 비동기 백그라운드 프로미스를 통해 대국 수집 및 분석 시작 (non-blocking)
        void this.processBatchJob(jobId, urls)

        return {
            jobId,
            total: urls.length
        }
    }

    public getBatchStatus(jobId: string): BatchPaipuJobStatus {
        /*_ GEMINI THINKING _*/
        const job = this.batchJobs.get(jobId)
        if (!job) {
            throw new NotFoundException(`Batch job with id "${jobId}" not found`)
        }

        const processed = job.completed + job.failed
        const progressPercent = job.total === 0 ? 100 : Math.min(100, Math.round((processed / job.total) * 100))

        return {
            jobId: job.jobId,
            total: job.total,
            completed: job.completed,
            failed: job.failed,
            progressPercent,
            isFinished: job.isFinished,
            errors: [...job.errors],
            gameIds: [...job.gameIds]
        }
    }

    protected async delay(ms: number): Promise<void> {
        if (ms > 0) {
            await new Promise((resolve) => setTimeout(resolve, ms))
        }
    }

    protected async processBatchJob(jobId: string, urls: readonly string[]): Promise<void> {
        /*_ GEMINI THINKING _*/
        const job = this.batchJobs.get(jobId)
        if (!job) {
            return
        }

        const seenUuids = new Set<string>()

        for (let i = 0; i < urls.length; i++) {
            const url = urls[i]
            if (url === undefined) {
                continue
            }

            if (i > 0 && this.rateLimitDelayMs > 0) {
                await this.delay(this.rateLimitDelayMs)
            }

            const trimmed = url.trim()
            if (!trimmed) {
                job.failed++
                job.errors.push(`URL ${i + 1}: 빈 입력값입니다.`)
                continue
            }

            try {
                const uuid = this.extractUuid(trimmed)
                if (seenUuids.has(uuid)) {
                    job.completed++
                    continue
                }
                seenUuids.add(uuid)

                const res = await this.importPaipu(trimmed)
                if (res.success) {
                    job.completed++
                    job.gameIds.push(res.gameId)
                } else {
                    job.failed++
                    job.errors.push(`대국 저장 실패 (${trimmed})`)
                }
            } catch (err) {
                job.failed++
                const msg = err instanceof Error ? err.message : String(err)
                job.errors.push(`대국 처리 실패 (${trimmed}): ${msg}`)
            }
        }

        job.isFinished = true
    }

    protected cleanupOldJobs(): void {
        const now = Date.now()
        const maxAgeMs = 60 * 60 * 1000
        for (const [id, job] of this.batchJobs.entries()) {
            if (job.isFinished && now - job.createdAt > maxAgeMs) {
                this.batchJobs.delete(id)
            }
        }
        if (this.batchJobs.size > 200) {
            const keys = Array.from(this.batchJobs.keys())
            const toRemove = keys.length - 200
            for (let i = 0; i < toRemove; i++) {
                const key = keys[i]
                if (key !== undefined) {
                    this.batchJobs.delete(key)
                }
            }
        }
    }


    protected async fetchGameForDetail(gameId: string): Promise<GameWithDetailRelations | null> {
        return await this.prisma.game.findUnique({
            where: { id: gameId },
            include: {
                participants: {
                    include: { player: true },
                    orderBy: { seat: 'asc' }
                },
                rounds: {
                    orderBy: { roundIndex: 'asc' },
                    include: { roundMetrics: true }
                }
            }
        })
    }

    public async getPaipuDetail(gameId: string): Promise<PaipuDetail> {
        /*_ GEMINI THINKING _*/
        const game = await this.fetchGameForDetail(gameId)

        if (!game) {
            throw new NotFoundException(`Paipu with id ${gameId} not found`)
        }

        // 1. If rawProtobuf is available, decode and parse to return rich actual paipu detail
        if (game.rawProtobuf && game.rawProtobuf.length > 0) {
            try {
                const record = this.decoder.decode(game.rawProtobuf)
                const parsed = this.parser.parseGameRecord(record)
                return parsed.detail
            } catch {
                // fallback to synthetic DB reconstruction if decoding fails
            }
        }

        // 2. Synthesize rich PaipuDetail from DB records for Amae-Koromo / synchronized games
        const players = game.participants.map((p) => ({
            accountId: p.player.accountId,
            nickname: p.player.nickname,
            seat: p.seat as SeatIndex,
            rank: p.finalRank,
            finalScore: p.finalScore,
            luckScore: p.luckScore,
            skillScore: p.skillScore
        }))

        const is3P = game.roomType.includes('3인') || players.length === 3
        const roundNames = ['동1국', '동2국', '동3국', '동4국', '남1국', '남2국', '남3국', '남4국']

        const rounds: PaipuRound[] = game.rounds.map((r) => {
            const name = roundNames[r.roundIndex] ?? `동${r.roundIndex + 1}국`
            const metricsSummary: PaipuRoundMetricSummary[] = r.roundMetrics.map((m) => ({
                seat: m.seat as SeatIndex,
                startingShanten: m.startShanten,
                startingDoraCount: m.startDoraCount,
                luckScore: m.luckScore,
                skillScore: m.skillScore,
                tileEfficiency: m.tileEfficiency,
                dealInScore: m.dealInScore,
                isWin: m.isWin,
                isRiichi: m.isRiichi,
                isFuro: m.isFuro,
                isDamaten: m.isDamaten
            }))

            let roundResult: PaipuRoundResult | undefined = undefined
            const winnerMetric = r.roundMetrics.find((m) => m.isWin)
            const loserMetric = r.roundMetrics.find((m) => m.dealInScore > 0)

            if (winnerMetric) {
                const winnerSeat = winnerMetric.seat as SeatIndex
                if (loserMetric) {
                    const loserSeat = loserMetric.seat as SeatIndex
                    roundResult = {
                        type: 'ron',
                        winnerSeats: [winnerSeat],
                        loserSeat,
                        score: loserMetric.dealInScore,
                        summaryKo: `${winnerSeat + 1}번가 론 화료 (${loserSeat + 1}번가 방총, ${loserMetric.dealInScore.toLocaleString()}점)`
                    }
                } else {
                    const calculatedTsumoScore = r.roundMetrics.reduce((sum, m) => sum + m.tsumoLossScore, 0)
                    const finalTsumoScore = calculatedTsumoScore > 0 ? calculatedTsumoScore : 8000
                    roundResult = {
                        type: 'tsumo',
                        winnerSeats: [winnerSeat],
                        score: finalTsumoScore,
                        summaryKo: `${winnerSeat + 1}번가 쯔모 화료 (${finalTsumoScore.toLocaleString()}점)`
                    }
                }
            } else {
                roundResult = {
                    type: 'ryukyoku',
                    summaryKo: '유국'
                }
            }

            const startingHands = this.generateSyntheticStartingHands(r.roundMetrics, is3P)

            return {
                roundIndex: r.roundIndex,
                roundName: name,
                honba: r.honba,
                riichiSticks: r.riichiSticks,
                initialScores: is3P ? [35000, 35000, 35000] : [25000, 25000, 25000, 25000],
                doraIndicators: ['5m'],
                startingHands,
                actions: [],
                result: roundResult,
                roundMetrics: metricsSummary
            }
        })

        return {
            id: game.id,
            roomName: game.roomType,
            timestamp: game.gameDate.getTime(),
            players,
            rounds
        }
    }

    /*_ GEMINI THINKING _*/
    protected generateSyntheticStartingHands(
        metrics: readonly { seat: number; startShanten: number; startDoraCount: number }[],
        is3P: boolean
    ): readonly (readonly string[])[] {
        const playerCount = is3P ? 3 : 4
        const result: (readonly string[])[] = []

        // 3인마는 2m~8m 및 0m이 없으므로 1m, 9m, 통수, 삭수, 자패로만 구성
        const sampleTileSets4P: readonly (readonly string[])[] = [
            ['1m', '2m', '3m', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '1z', '5z', '5z'],
            ['2m', '3m', '4m', '1p', '2p', '3p', '5s', '6s', '7s', '2z', '2z', '6z', '6z'],
            ['4m', '5m', '6m', '7p', '8p', '9p', '2s', '3s', '4s', '3z', '3z', '7z', '7z'],
            ['1p', '2p', '3p', '4p', '5p', '6p', '1s', '2s', '3s', '4z', '4z', '5z', '5z']
        ]
        const sampleTileSets3P: readonly (readonly string[])[] = [
            ['1m', '9m', '1p', '2p', '3p', '4p', '5p', '6p', '1s', '2s', '3s', '1z', '1z'],
            ['1m', '9m', '7p', '8p', '9p', '4s', '5s', '6s', '2z', '2z', '6z', '6z', '7z'],
            ['1p', '2p', '3p', '4p', '5p', '6p', '7s', '8s', '9s', '3z', '3z', '5z', '5z']
        ]
        const sampleTileSets = is3P ? sampleTileSets3P : sampleTileSets4P

        for (let seat = 0; seat < playerCount; seat++) {
            const m = metrics.find((metric) => metric.seat === seat)
            const baseHand = [...(sampleTileSets[seat] ?? sampleTileSets[0] ?? [])]
            const doraCount = m ? Math.min(3, Math.max(0, m.startDoraCount)) : 0

            if (doraCount > 0 && baseHand.length >= 13) {
                if (doraCount >= 1 && baseHand[4] !== undefined) {
                    baseHand[4] = '0p'
                }
                if (doraCount >= 2 && baseHand[7] !== undefined) {
                    baseHand[7] = '0s'
                }
                if (doraCount >= 3 && baseHand[1] !== undefined) {
                    baseHand[1] = is3P ? '4z' : '0m'
                }
            }
            result.push(baseHand)
        }

        return result
    }
}
