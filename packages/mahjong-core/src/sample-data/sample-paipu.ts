import { MajsoulGameRecord } from '../parser/types'

export const SAMPLE_MAJSOUL_GAME: MajsoulGameRecord = {
    uuid: '230801-sample-jade-east',
    roomType: '옥탁 동풍전 (Jade East)',
    timestamp: 1722510000000,
    players: [
        { accountId: 10001, nickname: 'SenseiPlayer', seat: 0, level: 3 },
        { accountId: 10002, nickname: 'MahjongMaster', seat: 1, level: 4 },
        { accountId: 10003, nickname: 'LuckyGuy', seat: 2, level: 3 },
        { accountId: 10004, nickname: 'Tactician', seat: 3, level: 5 }
    ],
    rounds: [
        {
            header: {
                type: 'RecordNewRound',
                chang: 0,
                ju: 0,
                ben: 0,
                liqi: 0,
                scores: [25000, 25000, 25000, 25000],
                dora: '5m',
                hands: [
                    // Seat 0 (SenseiPlayer) starting hand: 123m 456p 78s 11z 222z (1-shanten)
                    ['1m', '2m', '3m', '4p', '5p', '6p', '7s', '8s', '1z', '1z', '2z', '2z', '2z'],
                    ['1p', '9p', '1s', '9s', '1z', '2z', '3z', '4z', '5z', '6z', '7z', '3m', '7m'],
                    ['2m', '4m', '6m', '8m', '2p', '4p', '6p', '8p', '2s', '4s', '6s', '8s', '5z'],
                    ['1m', '1m', '2m', '2m', '3m', '3m', '4m', '4m', '5m', '5m', '6m', '6m', '7m']
                ]
            },
            actions: [
                // Turn 1
                { type: 'RecordDealTile', seat: 0, tile: '9s' },
                { type: 'RecordDiscardTile', seat: 0, tile: '1z', isMoqie: false, isLiqi: false },
                { type: 'RecordDealTile', seat: 1, tile: '3s' },
                { type: 'RecordDiscardTile', seat: 1, tile: '3s', isMoqie: true, isLiqi: false },
                { type: 'RecordDealTile', seat: 2, tile: '1p' },
                { type: 'RecordDiscardTile', seat: 2, tile: '1p', isMoqie: true, isLiqi: false },
                { type: 'RecordDealTile', seat: 3, tile: '8s' },
                { type: 'RecordDiscardTile', seat: 3, tile: '8s', isMoqie: true, isLiqi: false },
                // Turn 2: Seat 0 draws winning tile 1z and declares Tsumo!
                { type: 'RecordDealTile', seat: 0, tile: '1z' },
                {
                    type: 'RecordHule',
                    hules: [
                        {
                            seat: 0,
                            deltaScores: [12000, -4000, -4000, -4000],
                            handScore: 12000,
                            fan: 4,
                            fu: 40,
                            yaku: ['멘젠쯔모', '자풍 동', '도라 2'],
                            uradoras: ['9s']
                        }
                    ]
                }
            ]
        },
        {
            header: {
                type: 'RecordNewRound',
                chang: 0,
                ju: 1,
                ben: 0,
                liqi: 0,
                scores: [37000, 21000, 21000, 21000],
                dora: '1p',
                hands: [
                    ['1m', '4m', '7m', '2p', '5p', '8p', '3s', '6s', '9s', '1z', '3z', '5z', '7z'],
                    ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1p', '2p', '3p', '4p'],
                    ['2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m', '1s', '2s', '3s', '4s', '5s'],
                    ['9m', '9m', '9m', '1p', '1p', '1p', '9p', '9p', '9p', '1s', '1s', '1s', '2s']
                ]
            },
            actions: [
                // Opponent Riichi
                { type: 'RecordDealTile', seat: 1, tile: '5p' },
                { type: 'RecordDiscardTile', seat: 1, tile: '5p', isMoqie: false, isLiqi: true },
                // Seat 0 defends
                { type: 'RecordDealTile', seat: 0, tile: '1z' },
                { type: 'RecordDiscardTile', seat: 0, tile: '1z', isMoqie: true, isLiqi: false },
                // Ryukyoku
                {
                    type: 'RecordNoTile',
                    tenpaiSeats: [1],
                    deltaScores: [-1000, 3000, -1000, -1000]
                }
            ]
        }
    ]
}
