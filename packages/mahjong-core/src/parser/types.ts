import { SeatIndex } from '@mahjong-sensei/types'

export interface MajsoulPlayerInfo {
    readonly accountId: number
    readonly nickname: string
    readonly seat: SeatIndex
    readonly level: number
}

export interface MajsoulRecordNewRound {
    readonly type: 'RecordNewRound'
    readonly chang: number // 0: 동, 1: 남, 2: 서, 3: 북
    readonly ju: number    // 0: 1국, 1: 2국 ...
    readonly ben: number   // 본장 (honba)
    readonly liqi: number  // 리치봉 수
    readonly scores: readonly [number, number, number, number]
    readonly dora: string  // 도라 표시패 (e.g. '5m')
    readonly hands: readonly [
        readonly string[],
        readonly string[],
        readonly string[],
        readonly string[]
    ]
}

export interface MajsoulRecordDealTile {
    readonly type: 'RecordDealTile'
    readonly seat: SeatIndex
    readonly tile: string
    readonly doras?: readonly string[]
}

export interface MajsoulRecordDiscardTile {
    readonly type: 'RecordDiscardTile'
    readonly seat: SeatIndex
    readonly tile: string
    readonly isMoqie: boolean // 모기리(쯔모기리) 여부
    readonly isLiqi: boolean  // 리치 선언 여부
    readonly doras?: readonly string[]
}

export interface MajsoulRecordChiPengGang {
    readonly type: 'RecordChiPengGang'
    readonly seat: SeatIndex
    readonly meldType: 'chi' | 'pon' | 'daiminkan'
    readonly tiles: readonly string[]
    readonly fromSeat: SeatIndex
}

export interface MajsoulRecordAnGangAddGang {
    readonly type: 'RecordAnGangAddGang'
    readonly seat: SeatIndex
    readonly gangType: 'ankan' | 'kakan'
    readonly tiles: readonly string[]
}

export interface MajsoulHuleItem {
    readonly seat: SeatIndex
    readonly deltaScores: readonly [number, number, number, number]
    readonly handScore: number
    readonly fan: number
    readonly fu: number
    readonly yaku: readonly string[]
    readonly uradoras?: readonly string[]
}

export interface MajsoulRecordHule {
    readonly type: 'RecordHule'
    readonly hules: readonly MajsoulHuleItem[]
}

export interface MajsoulRecordNoTile {
    readonly type: 'RecordNoTile'
    readonly tenpaiSeats: readonly SeatIndex[]
    readonly deltaScores: readonly [number, number, number, number]
}

export type MajsoulRoundAction =
    | MajsoulRecordDealTile
    | MajsoulRecordDiscardTile
    | MajsoulRecordChiPengGang
    | MajsoulRecordAnGangAddGang
    | MajsoulRecordHule
    | MajsoulRecordNoTile

export interface MajsoulRoundRecord {
    readonly header: MajsoulRecordNewRound
    readonly actions: readonly MajsoulRoundAction[]
}

export interface MajsoulGameRecord {
    readonly uuid: string
    readonly roomType: string
    readonly timestamp: number
    readonly players: readonly MajsoulPlayerInfo[]
    readonly rounds: readonly MajsoulRoundRecord[]
}
