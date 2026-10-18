export type Wind = 'East' | 'South' | 'West' | 'North'

export type SeatIndex = 0 | 1 | 2 | 3

export type ActionType =
    | 'tsumo'
    | 'dahai'
    | 'chi'
    | 'pon'
    | 'ankan'
    | 'daiminkan'
    | 'kakan'
    | 'riichi'
    | 'hora'
    | 'ryukyoku'

export interface PlayerSummary {
    readonly accountId: number
    readonly nickname: string
    readonly seat: SeatIndex
    readonly rank: number
    readonly finalScore: number
    readonly luckScore: number
    readonly skillScore: number
}

export interface PaipuAction {
    readonly step: number
    readonly seat: SeatIndex
    readonly type: ActionType
    readonly tile?: string
    readonly consumedTiles?: readonly string[]
    readonly isRiichi?: boolean
}

export interface PaipuRoundResult {
    readonly type: 'ron' | 'tsumo' | 'ryukyoku'
    readonly winnerSeats?: readonly SeatIndex[] | undefined
    readonly loserSeat?: SeatIndex | undefined
    readonly score?: number | undefined
    readonly deltaScores?: readonly number[] | undefined
    readonly yakuList?: readonly string[] | undefined
    readonly summaryKo: string
}

export interface PaipuRoundMetricSummary {
    readonly seat: SeatIndex
    readonly startingShanten: number
    readonly startingDoraCount: number
    readonly luckScore: number
    readonly skillScore: number
    readonly tileEfficiency: number
    readonly dealInScore: number
    readonly isWin?: boolean | undefined
    readonly isRiichi?: boolean | undefined
    readonly isFuro?: boolean | undefined
    readonly isDamaten?: boolean | undefined
}

export interface PaipuRound {
    readonly roundIndex: number
    readonly roundName: string
    readonly honba: number
    readonly riichiSticks: number
    readonly initialScores: readonly [number, number, number, number] | readonly number[]
    readonly doraIndicators: readonly string[]
    readonly startingHands: readonly (readonly string[])[]
    readonly actions: readonly PaipuAction[]
    readonly result?: PaipuRoundResult | undefined
    readonly roundMetrics?: readonly PaipuRoundMetricSummary[] | undefined
}

export interface PaipuDetail {
    readonly id: string
    readonly roomName: string
    readonly timestamp: number
    readonly players: readonly PlayerSummary[]
    readonly rounds: readonly PaipuRound[]
}
