import {
    SeatIndex,
    PaipuDetail,
    PlayerSummary,
    PaipuRound,
    PaipuAction,
    PaipuRoundResult,
    PaipuRoundMetricSummary
} from '@mahjong-sensei/types'
import {
    MajsoulGameRecord,
    MajsoulRoundRecord,
    MajsoulRecordHule,
    MajsoulRecordNoTile
} from './types'
import { LuckEvaluator } from '../metrics/luck-evaluator'
import { SkillEvaluator } from '../metrics/skill-evaluator'

export interface ParsedGameResult {
    readonly detail: PaipuDetail
    readonly roundMetrics: readonly {
        readonly roundIndex: number
        readonly seat: SeatIndex
        readonly luckScore: number
        readonly skillScore: number
        readonly startShanten: number
        readonly startDoraCount: number
        readonly drawLuckRatio: number
        readonly uradoraHits: number
        readonly dealInScore: number
        readonly tsumoLossScore: number
        readonly tileEfficiency: number
        readonly isWin: boolean
        readonly isRiichi: boolean
        readonly isFuro: boolean
        readonly isDamaten: boolean
        readonly isInitiative: boolean
    }[]
}

export class PaipuParser {
    private readonly luckEvaluator: LuckEvaluator = new LuckEvaluator()
    private readonly skillEvaluator: SkillEvaluator = new SkillEvaluator()

    public parseGameRecord(record: MajsoulGameRecord): ParsedGameResult {
        /*_ GEMINI THINKING _*/
        const roundMetrics: {
            roundIndex: number
            seat: SeatIndex
            luckScore: number
            skillScore: number
            startShanten: number
            startDoraCount: number
            drawLuckRatio: number
            uradoraHits: number
            dealInScore: number
            tsumoLossScore: number
            tileEfficiency: number
            isWin: boolean
            isRiichi: boolean
            isFuro: boolean
            isDamaten: boolean
            isInitiative: boolean
        }[] = []

        const playerCount = (record.players.length === 3 || record.roomType.includes('3인')) ? 3 : 4
        const playerTotalLuck = [0, 0, 0, 0]
        const playerTotalSkill = [0, 0, 0, 0]
        const roundCount = record.rounds.length || 1

        const parsedRounds: PaipuRound[] = []

        for (let rIdx = 0; rIdx < record.rounds.length; rIdx++) {
            const round = record.rounds[rIdx]
            if (!round) {
                continue
            }

            const styleFlags = this.analyzeRoundStyleFlags(round)

            for (let seat = 0; seat < playerCount; seat++) {
                const s = seat as SeatIndex
                const luckMetric = this.luckEvaluator.evaluateRound(round, s)
                const skillMetric = this.skillEvaluator.evaluateRound(round, s)
                const flags = styleFlags[s]

                playerTotalLuck[s] = (playerTotalLuck[s] ?? 0) + luckMetric.luckScore
                playerTotalSkill[s] = (playerTotalSkill[s] ?? 0) + skillMetric.skillScore

                const isWin = flags.isWin || (luckMetric.isWin ?? false)
                const dealInScore = flags.dealInScore > 0 ? flags.dealInScore : (skillMetric.dealInMistakeRate > 0 ? 8000 : 0)
                const uradoraHits = flags.uradoraHits > 0 ? flags.uradoraHits : luckMetric.uradoraCount

                roundMetrics.push({
                    roundIndex: rIdx,
                    seat: s,
                    luckScore: luckMetric.luckScore,
                    skillScore: skillMetric.skillScore,
                    startShanten: luckMetric.startingShanten,
                    startDoraCount: luckMetric.startingDoraCount,
                    drawLuckRatio: luckMetric.drawEfficiencyRatio,
                    uradoraHits,
                    dealInScore,
                    tsumoLossScore: luckMetric.unavoidableDamage,
                    tileEfficiency: skillMetric.tileEfficiencyRate,
                    isWin,
                    isRiichi: flags.isRiichi,
                    isFuro: flags.isFuro,
                    isDamaten: flags.isDamaten,
                    isInitiative: flags.isInitiative
                })
            }

            const currentRoundMetrics: PaipuRoundMetricSummary[] = roundMetrics
                .filter((m) => m.roundIndex === rIdx)
                .map((m) => ({
                    seat: m.seat,
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

            parsedRounds.push(this.transformRound(round, rIdx, currentRoundMetrics))
        }

        // Calculate final scores and ranks
        const defaultScore = playerCount === 3 ? 35000 : 25000
        const lastRound = record.rounds[record.rounds.length - 1]
        const finalScores = lastRound ? [...lastRound.header.scores] : [defaultScore, defaultScore, defaultScore, defaultScore]

        // Rank determination (tie-breaking by seat order)
        const validSeats = (playerCount === 3 ? [0, 1, 2] : [0, 1, 2, 3]) as SeatIndex[]
        const rankedSeats: SeatIndex[] = validSeats.sort((a, b) => {
            const scoreA = finalScores[a] ?? defaultScore
            const scoreB = finalScores[b] ?? defaultScore
            if (scoreB !== scoreA) {
                return scoreB - scoreA
            }
            return a - b
        })

        const seatRanks = playerCount === 3 ? [1, 2, 3] : [1, 2, 3, 4]
        for (let r = 0; r < playerCount; r++) {
            const seat = rankedSeats[r]
            if (seat !== undefined) {
                seatRanks[seat] = r + 1
            }
        }

        const players: PlayerSummary[] = record.players.map((p) => {
            const seat = p.seat
            const totalLuck = playerTotalLuck[seat] ?? 50
            const totalSkill = playerTotalSkill[seat] ?? 50
            return {
                accountId: p.accountId,
                nickname: p.nickname,
                seat,
                rank: seatRanks[seat] ?? (playerCount === 3 ? 3 : 4),
                finalScore: finalScores[seat] ?? 25000,
                luckScore: Number((totalLuck / roundCount).toFixed(1)),
                skillScore: Number((totalSkill / roundCount).toFixed(1))
            }
        })

        const detail: PaipuDetail = {
            id: record.uuid,
            roomName: record.roomType,
            timestamp: record.timestamp,
            players,
            rounds: parsedRounds
        }

        return {
            detail,
            roundMetrics
        }
    }

    private transformRound(
        round: MajsoulRoundRecord,
        roundIndex: number,
        roundMetrics?: readonly PaipuRoundMetricSummary[]
    ): PaipuRound {
        /*_ GEMINI THINKING _*/
        const roundNames = ['동1국', '동2국', '동3국', '동4국', '남1국', '남2국', '남3국', '남4국']
        const name = roundNames[round.header.ju] ?? `동${round.header.ju + 1}국`

        let step = 0
        const actions: PaipuAction[] = []
        const doraIndicators: string[] = [round.header.dora]

        let huleAction: MajsoulRecordHule | null = null
        let noTileAction: MajsoulRecordNoTile | null = null

        for (const action of round.actions) {
            step++
            if (action.type === 'RecordDealTile') {
                actions.push({
                    step,
                    seat: action.seat,
                    type: 'tsumo',
                    tile: action.tile
                })
                if (action.doras) {
                    for (const d of action.doras) {
                        if (!doraIndicators.includes(d)) {
                            doraIndicators.push(d)
                        }
                    }
                }
            } else if (action.type === 'RecordDiscardTile') {
                actions.push({
                    step,
                    seat: action.seat,
                    type: 'dahai',
                    tile: action.tile,
                    isRiichi: action.isLiqi
                })
                if (action.doras) {
                    for (const d of action.doras) {
                        if (!doraIndicators.includes(d)) {
                            doraIndicators.push(d)
                        }
                    }
                }
            } else if (action.type === 'RecordChiPengGang') {
                actions.push({
                    step,
                    seat: action.seat,
                    type: action.meldType,
                    consumedTiles: action.tiles
                })
            } else if (action.type === 'RecordAnGangAddGang') {
                actions.push({
                    step,
                    seat: action.seat,
                    type: action.gangType,
                    consumedTiles: action.tiles
                })
            } else if (action.type === 'RecordBaBei') {
                if (action.doras) {
                    for (const d of action.doras) {
                        if (!doraIndicators.includes(d)) {
                            doraIndicators.push(d)
                        }
                    }
                }
            } else if (action.type === 'RecordHule') {
                huleAction = action
                for (const h of action.hules) {
                    actions.push({
                        step,
                        seat: h.seat,
                        type: 'hora'
                    })
                }
            } else if (action.type === 'RecordNoTile') {
                noTileAction = action
                actions.push({
                    step,
                    seat: 0,
                    type: 'ryukyoku'
                })
            }
        }

        let roundResult: PaipuRoundResult | undefined = undefined

        if (huleAction && huleAction.hules.length > 0) {
            const winnerSeats = huleAction.hules.map((h) => h.seat)
            const combinedYaku: string[] = []
            let totalHandScore = 0

            for (const h of huleAction.hules) {
                totalHandScore += h.handScore
                for (const y of h.yaku) {
                    if (!combinedYaku.includes(y)) {
                        combinedYaku.push(y)
                    }
                }
                if (h.uradoras && h.uradoras.length > 0) {
                    const uraName = `우라도라 ${h.uradoras.length}`
                    if (!combinedYaku.includes(uraName)) {
                        combinedYaku.push(uraName)
                    }
                }
            }

            const aggregatedDeltaScores: number[] = [0, 0, 0, 0]
            for (const h of huleAction.hules) {
                if (h.deltaScores) {
                    h.deltaScores.forEach((d, idx) => {
                        aggregatedDeltaScores[idx] = (aggregatedDeltaScores[idx] ?? 0) + d
                    })
                }
            }

            const losingSeats: SeatIndex[] = []
            for (let seat = 0; seat < 4; seat++) {
                const s = seat as SeatIndex
                if (!winnerSeats.includes(s) && (aggregatedDeltaScores[s] ?? 0) < 0) {
                    losingSeats.push(s)
                }
            }

            if (losingSeats.length === 1 && losingSeats[0] !== undefined) {
                const loserSeat = losingSeats[0]
                const winnerNames = winnerSeats.map((w) => `${w + 1}번가`).join(', ')
                roundResult = {
                    type: 'ron',
                    winnerSeats,
                    loserSeat,
                    score: totalHandScore,
                    deltaScores: aggregatedDeltaScores,
                    yakuList: combinedYaku,
                    summaryKo: `${winnerNames} 론 화료 (${loserSeat + 1}번가 방총, ${totalHandScore.toLocaleString()}점)`
                }
            } else {
                const winnerSeat = winnerSeats[0] ?? 0
                roundResult = {
                    type: 'tsumo',
                    winnerSeats,
                    score: totalHandScore,
                    deltaScores: aggregatedDeltaScores,
                    yakuList: combinedYaku,
                    summaryKo: `${winnerSeat + 1}번가 쯔모 화료 (${totalHandScore.toLocaleString()}점)`
                }
            }
        } else if (noTileAction) {
            const tenpaiList = noTileAction.tenpaiSeats.map((s) => `${s + 1}번가`).join(', ')
            const summaryKo = noTileAction.tenpaiSeats.length > 0
                ? `유국 (텐파이: ${tenpaiList})`
                : '유국 (전원 노텐)'
            roundResult = {
                type: 'ryukyoku',
                deltaScores: noTileAction.deltaScores,
                summaryKo
            }
        }

        return {
            roundIndex,
            roundName: name,
            honba: round.header.ben,
            riichiSticks: round.header.liqi,
            initialScores: round.header.scores,
            doraIndicators,
            startingHands: round.header.hands,
            actions,
            result: roundResult,
            roundMetrics
        }
    }

    /*_ GEMINI THINKING _*/
    protected analyzeRoundStyleFlags(round: MajsoulRoundRecord): Record<SeatIndex, {
        isRiichi: boolean
        isFuro: boolean
        isWin: boolean
        isDamaten: boolean
        isInitiative: boolean
        dealInScore: number
        uradoraHits: number
    }> {
        const isRiichiSeats = new Set<SeatIndex>()
        const isFuroSeats = new Set<SeatIndex>()
        const isWinSeats = new Set<SeatIndex>()
        const dealInScores: Record<SeatIndex, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
        const uradoraHitsBySeat: Record<SeatIndex, number> = { 0: 0, 1: 0, 2: 0, 3: 0 }
        let firstRiichiSeat: SeatIndex | null = null
        let ryukyokuTenpaiSeats: readonly SeatIndex[] = []

        for (const action of round.actions) {
            if (action.type === 'RecordDiscardTile' && action.isLiqi) {
                isRiichiSeats.add(action.seat)
                if (firstRiichiSeat === null) {
                    firstRiichiSeat = action.seat
                }
            } else if (action.type === 'RecordChiPengGang') {
                isFuroSeats.add(action.seat)
            } else if (action.type === 'RecordAnGangAddGang' && action.gangType === 'kakan') {
                isFuroSeats.add(action.seat)
            } else if (action.type === 'RecordHule') {
                for (const h of action.hules) {
                    isWinSeats.add(h.seat)
                    if (h.uradoras) {
                        uradoraHitsBySeat[h.seat] = (uradoraHitsBySeat[h.seat] ?? 0) + h.uradoras.length
                    }
                    const losingSeats = ([0, 1, 2, 3] as SeatIndex[]).filter((st) => (h.deltaScores[st] ?? 0) < 0)
                    if (losingSeats.length === 1 && losingSeats[0] !== undefined) {
                        const loser = losingSeats[0]
                        dealInScores[loser] = (dealInScores[loser] ?? 0) + Math.abs(h.deltaScores[loser] ?? 0)
                    }
                }
            } else if (action.type === 'RecordNoTile') {
                ryukyokuTenpaiSeats = action.tenpaiSeats
            }
        }

        const result: Record<SeatIndex, {
            isRiichi: boolean
            isFuro: boolean
            isWin: boolean
            isDamaten: boolean
            isInitiative: boolean
            dealInScore: number
            uradoraHits: number
        }> = {
            0: { isRiichi: false, isFuro: false, isWin: false, isDamaten: false, isInitiative: false, dealInScore: 0, uradoraHits: 0 },
            1: { isRiichi: false, isFuro: false, isWin: false, isDamaten: false, isInitiative: false, dealInScore: 0, uradoraHits: 0 },
            2: { isRiichi: false, isFuro: false, isWin: false, isDamaten: false, isInitiative: false, dealInScore: 0, uradoraHits: 0 },
            3: { isRiichi: false, isFuro: false, isWin: false, isDamaten: false, isInitiative: false, dealInScore: 0, uradoraHits: 0 }
        }

        for (let seat = 0; seat < 4; seat++) {
            const s = seat as SeatIndex
            const isRiichi = isRiichiSeats.has(s)
            const isFuro = isFuroSeats.has(s)
            const isWin = isWinSeats.has(s)
            const isTenpaiAtRyukyoku = ryukyokuTenpaiSeats.includes(s)
            const isDamaten = !isRiichi && !isFuro && (isWin || isTenpaiAtRyukyoku)

            const isInitiative = isRiichi && firstRiichiSeat === s

            result[s] = {
                isRiichi,
                isFuro,
                isWin,
                isDamaten,
                isInitiative,
                dealInScore: dealInScores[s] ?? 0,
                uradoraHits: uradoraHitsBySeat[s] ?? 0
            }
        }

        return result
    }
}

