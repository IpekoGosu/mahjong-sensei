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

export interface PaipuRound {
    readonly roundIndex: number
    readonly roundName: string
    readonly honba: number
    readonly riichiSticks: number
    readonly initialScores: readonly [number, number, number, number]
    readonly doraIndicators: readonly string[]
    readonly startingHands: readonly [
        readonly string[],
        readonly string[],
        readonly string[],
        readonly string[]
    ]
    readonly actions: readonly PaipuAction[]
}

export interface PaipuDetail {
    readonly id: string
    readonly roomName: string
    readonly timestamp: number
    readonly players: readonly PlayerSummary[]
    readonly rounds: readonly PaipuRound[]
}
