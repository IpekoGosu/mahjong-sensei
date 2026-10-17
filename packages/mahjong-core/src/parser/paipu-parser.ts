import {
    SeatIndex,
    PaipuDetail,
    PlayerSummary,
    PaipuRound,
    PaipuAction
} from '@mahjong-sensei/types'
import { MajsoulGameRecord, MajsoulRoundRecord } from './types'
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

            for (let seat = 0; seat < playerCount; seat++) {
                const s = seat as SeatIndex
                const luckMetric = this.luckEvaluator.evaluateRound(round, s)
                const skillMetric = this.skillEvaluator.evaluateRound(round, s)

                playerTotalLuck[s] = (playerTotalLuck[s] ?? 0) + luckMetric.luckScore
                playerTotalSkill[s] = (playerTotalSkill[s] ?? 0) + skillMetric.skillScore

                roundMetrics.push({
                    roundIndex: rIdx,
                    seat: s,
                    luckScore: luckMetric.luckScore,
                    skillScore: skillMetric.skillScore,
                    startShanten: luckMetric.startingShanten,
                    startDoraCount: luckMetric.startingDoraCount,
                    drawLuckRatio: luckMetric.drawEfficiencyRatio,
                    uradoraHits: luckMetric.uradoraCount,
                    dealInScore: skillMetric.dealInMistakeRate > 0 ? 8000 : 0,
                    tsumoLossScore: luckMetric.unavoidableDamage,
                    tileEfficiency: skillMetric.tileEfficiencyRate,
                    isWin: luckMetric.isWin ?? false
                })
            }

            parsedRounds.push(this.transformRound(round, rIdx))
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

    private transformRound(round: MajsoulRoundRecord, roundIndex: number): PaipuRound {
        const roundNames = ['동1국', '동2국', '동3국', '동4국', '남1국', '남2국', '남3국', '남4국']
        const name = roundNames[round.header.ju] ?? `동${round.header.ju + 1}국`

        let step = 0
        const actions: PaipuAction[] = []

        for (const action of round.actions) {
            step++
            if (action.type === 'RecordDealTile') {
                actions.push({
                    step,
                    seat: action.seat,
                    type: 'tsumo',
                    tile: action.tile
                })
            } else if (action.type === 'RecordDiscardTile') {
                actions.push({
                    step,
                    seat: action.seat,
                    type: 'dahai',
                    tile: action.tile,
                    isRiichi: action.isLiqi
                })
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
            } else if (action.type === 'RecordHule') {
                for (const h of action.hules) {
                    actions.push({
                        step,
                        seat: h.seat,
                        type: 'hora'
                    })
                }
            } else if (action.type === 'RecordNoTile') {
                actions.push({
                    step,
                    seat: 0,
                    type: 'ryukyoku'
                })
            }
        }

        return {
            roundIndex,
            roundName: name,
            honba: round.header.ben,
            riichiSticks: round.header.liqi,
            initialScores: round.header.scores,
            doraIndicators: [round.header.dora],
            startingHands: round.header.hands,
            actions
        }
    }
}
