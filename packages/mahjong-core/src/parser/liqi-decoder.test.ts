import test from 'node:test'
import assert from 'node:assert'
import {
    LiqiBinaryDecoder,
    Varint64Result,
    VarintResult,
    ProtoRawField
} from './liqi-decoder'
import {
    MajsoulGameRecord,
    MajsoulRoundRecord,
    MajsoulRoundAction,
    MajsoulRecordNewRound,
    MajsoulRecordDealTile,
    MajsoulRecordDiscardTile,
    MajsoulRecordChiPengGang,
    MajsoulRecordAnGangAddGang,
    MajsoulRecordBaBei,
    MajsoulRecordHule,
    MajsoulRecordNoTile,
    MajsoulPlayerInfo
} from './types'
import { PaipuParser } from './paipu-parser'
import { SAMPLE_MAJSOUL_GAME } from '../sample-data/sample-paipu'

/*_ GEMINI THINKING _*/
class MockLiqiBinaryDecoder extends LiqiBinaryDecoder {
    public testXorTransform(data: Uint8Array): Uint8Array {
        return this.xorTransform(data)
    }

    public testDeobfuscate(data: Uint8Array): Uint8Array {
        return this.deobfuscate(data)
    }

    public testObfuscate(data: Uint8Array): Uint8Array {
        return this.obfuscate(data)
    }

    public testReadVarint64(buffer: Uint8Array, offset: number): Varint64Result {
        return this.readVarint64(buffer, offset)
    }

    public testReadVarint(buffer: Uint8Array, offset: number): VarintResult {
        return this.readVarint(buffer, offset)
    }

    public testWriteVarint(val: number | bigint): Uint8Array {
        return this.writeVarint(val)
    }

    public testDecodeSignedVarint(val: bigint): number {
        return this.decodeSignedVarint(val)
    }

    public testEncodeSignedVarint(val: number): Uint8Array {
        return this.encodeSignedVarint(val)
    }

    public testReadPackedVarints(buffer: Uint8Array): readonly number[] {
        return this.readPackedVarints(buffer)
    }

    public testWritePackedVarints(fieldNumber: number, values: readonly number[]): Uint8Array {
        return this.writePackedVarints(fieldNumber, values)
    }

    public testReadPackedSignedVarints(buffer: Uint8Array): readonly number[] {
        return this.readPackedSignedVarints(buffer)
    }

    public testWritePackedSignedVarints(fieldNumber: number, values: readonly number[]): Uint8Array {
        return this.writePackedSignedVarints(fieldNumber, values)
    }

    public testReadString(buffer: Uint8Array, offset: number, length: number): string {
        return this.readString(buffer, offset, length)
    }

    public testWriteString(str: string): Uint8Array {
        return this.writeString(str)
    }

    public testWriteLengthDelimited(fieldNumber: number, data: Uint8Array): Uint8Array {
        return this.writeLengthDelimited(fieldNumber, data)
    }

    public testParseProtoFields(buffer: Uint8Array): readonly ProtoRawField[] {
        return this.parseProtoFields(buffer)
    }

    public testNormalizeActionName(name: string): string {
        return this.normalizeActionName(name)
    }

    public testDecodeRecordNewRound(data: Uint8Array): MajsoulRecordNewRound {
        return this.decodeRecordNewRound(data)
    }

    public testEncodeRecordNewRound(record: MajsoulRecordNewRound): Uint8Array {
        return this.encodeRecordNewRound(record)
    }

    public testDecodeRecordDealTile(data: Uint8Array): MajsoulRecordDealTile {
        return this.decodeRecordDealTile(data)
    }

    public testEncodeRecordDealTile(record: MajsoulRecordDealTile): Uint8Array {
        return this.encodeRecordDealTile(record)
    }

    public testDecodeRecordDiscardTile(data: Uint8Array): MajsoulRecordDiscardTile {
        return this.decodeRecordDiscardTile(data)
    }

    public testEncodeRecordDiscardTile(record: MajsoulRecordDiscardTile): Uint8Array {
        return this.encodeRecordDiscardTile(record)
    }

    public testDecodeRecordChiPengGang(data: Uint8Array): MajsoulRecordChiPengGang {
        return this.decodeRecordChiPengGang(data)
    }

    public testEncodeRecordChiPengGang(record: MajsoulRecordChiPengGang): Uint8Array {
        return this.encodeRecordChiPengGang(record)
    }

    public testDecodeRecordAnGangAddGang(data: Uint8Array): MajsoulRecordAnGangAddGang {
        return this.decodeRecordAnGangAddGang(data)
    }

    public testEncodeRecordAnGangAddGang(record: MajsoulRecordAnGangAddGang): Uint8Array {
        return this.encodeRecordAnGangAddGang(record)
    }

    public testDecodeRecordBaBei(data: Uint8Array): MajsoulRecordBaBei {
        return this.decodeRecordBaBei(data)
    }

    public testEncodeRecordBaBei(record: MajsoulRecordBaBei): Uint8Array {
        return this.encodeRecordBaBei(record)
    }

    public testDecodeRecordHule(data: Uint8Array): MajsoulRecordHule {
        return this.decodeRecordHule(data)
    }

    public testEncodeRecordHule(record: MajsoulRecordHule): Uint8Array {
        return this.encodeRecordHule(record)
    }

    public testDecodeRecordNoTile(data: Uint8Array): MajsoulRecordNoTile {
        return this.decodeRecordNoTile(data)
    }

    public testEncodeRecordNoTile(record: MajsoulRecordNoTile): Uint8Array {
        return this.encodeRecordNoTile(record)
    }

    public testDecodePlayerInfo(data: Uint8Array): MajsoulPlayerInfo {
        return this.decodePlayerInfo(data)
    }

    public testEncodePlayerInfo(player: MajsoulPlayerInfo): Uint8Array {
        return this.encodePlayerInfo(player)
    }

    public testPartitionActionsIntoRounds(
        records: readonly (MajsoulRecordNewRound | MajsoulRoundAction)[]
    ): readonly MajsoulRoundRecord[] {
        return this.partitionActionsIntoRounds(records)
    }
}

test('MockLiqiBinaryDecoder - XOR de-obfuscation and obfuscation symmetry', () => {
    const mock = new MockLiqiBinaryDecoder()
    const original = new Uint8Array([0x08, 0x01, 0x12, 0x02, 0x31, 0x6d, 0x18, 0x00, 0x20, 0x01])

    const obfuscated = mock.testObfuscate(original)
    assert.notDeepStrictEqual(obfuscated, original)

    // Standard Majsoul XOR key byte 0 is 0x84
    assert.strictEqual(obfuscated[0], (original[0] ?? 0) ^ 0x84)

    const deobfuscated = mock.testDeobfuscate(obfuscated)
    assert.deepStrictEqual(deobfuscated, original)
})

test('MockLiqiBinaryDecoder - Custom XOR key support', () => {
    const customKey = [0xAA, 0xBB, 0xCC]
    const mock = new MockLiqiBinaryDecoder(customKey)
    const original = new Uint8Array([1, 2, 3, 4, 5, 6])

    const transformed = mock.testXorTransform(original)
    assert.strictEqual(transformed[0], 1 ^ 0xAA)
    assert.strictEqual(transformed[1], 2 ^ 0xBB)
    assert.strictEqual(transformed[2], 3 ^ 0xCC)
    assert.strictEqual(transformed[3], 4 ^ 0xAA)

    const restored = mock.testXorTransform(transformed)
    assert.deepStrictEqual(restored, original)
})

test('MockLiqiBinaryDecoder - Varint wire format encoding and decoding', () => {
    const mock = new MockLiqiBinaryDecoder()
    const testCases: readonly number[] = [0, 1, 127, 128, 300, 16384, 2097151, 1722510000000]

    let idx = 0
    while (idx < testCases.length) {
        const val = testCases[idx] ?? 0
        const encoded = mock.testWriteVarint(val)
        const decoded = mock.testReadVarint(encoded, 0)
        assert.strictEqual(decoded.value, val)
        assert.strictEqual(decoded.bytesRead, encoded.length)
        idx++
    }
})

test('MockLiqiBinaryDecoder - Signed varint two-s complement encoding and decoding', () => {
    const mock = new MockLiqiBinaryDecoder()
    const testValues: readonly number[] = [12000, -4000, -1000, 3000, -8000, 0]

    let idx = 0
    while (idx < testValues.length) {
        const val = testValues[idx] ?? 0
        const encoded = mock.testEncodeSignedVarint(val)
        const readVarint = mock.testReadVarint64(encoded, 0)
        const decoded = mock.testDecodeSignedVarint(readVarint.value)
        assert.strictEqual(decoded, val)
        idx++
    }
})

test('MockLiqiBinaryDecoder - Packed varints and packed signed varints', () => {
    const mock = new MockLiqiBinaryDecoder()
    const scores: readonly number[] = [25000, 25000, 25000, 25000]
    const packed = mock.testWritePackedVarints(6, scores)

    const fields = mock.testParseProtoFields(packed)
    assert.strictEqual(fields.length, 1)
    const firstField = fields[0]
    assert.ok(firstField !== undefined)
    assert.strictEqual(firstField.fieldNumber, 6)
    assert.ok(firstField.data !== undefined)

    const decodedScores = mock.testReadPackedVarints(firstField.data)
    assert.deepStrictEqual(decodedScores, scores)

    const deltas: readonly number[] = [12000, -4000, -4000, -4000]
    const packedDeltas = mock.testWritePackedSignedVarints(2, deltas)
    const deltaFields = mock.testParseProtoFields(packedDeltas)
    assert.strictEqual(deltaFields.length, 1)
    const firstDelta = deltaFields[0]
    assert.ok(firstDelta !== undefined)
    assert.ok(firstDelta.data !== undefined)

    const decodedDeltas = mock.testReadPackedSignedVarints(firstDelta.data)
    assert.deepStrictEqual(decodedDeltas, deltas)
})

test('MockLiqiBinaryDecoder - Action name normalization', () => {
    const mock = new MockLiqiBinaryDecoder()
    assert.strictEqual(mock.testNormalizeActionName('.lq.RecordDealTile'), 'RecordDealTile')
    assert.strictEqual(mock.testNormalizeActionName('lq.RecordDealTile'), 'RecordDealTile')
    assert.strictEqual(mock.testNormalizeActionName('RecordDealTile'), 'RecordDealTile')
    assert.strictEqual(mock.testNormalizeActionName('.lq.ActionDealTile'), 'RecordDealTile')
    assert.strictEqual(mock.testNormalizeActionName('ActionNewRound'), 'RecordNewRound')
})

test('MockLiqiBinaryDecoder - RecordNewRound round-trip', () => {
    const mock = new MockLiqiBinaryDecoder()
    const original: MajsoulRecordNewRound = {
        type: 'RecordNewRound',
        chang: 0,
        ju: 1,
        ben: 2,
        liqi: 1,
        scores: [26000, 24000, 25000, 25000],
        dora: '5m',
        hands: [
            ['1m', '2m', '3m', '4p', '5p', '6p', '7s', '8s', '1z', '1z', '2z', '2z', '2z'],
            ['1p', '9p', '1s', '9s', '1z', '2z', '3z', '4z', '5z', '6z', '7z', '3m', '7m'],
            ['2m', '4m', '6m', '8m', '2p', '4p', '6p', '8p', '2s', '4s', '6s', '8s', '5z'],
            ['1m', '1m', '2m', '2m', '3m', '3m', '4m', '4m', '5m', '5m', '6m', '6m', '7m']
        ]
    }

    const encoded = mock.testEncodeRecordNewRound(original)
    const decoded = mock.testDecodeRecordNewRound(encoded)
    assert.deepStrictEqual(decoded, original)
})

test('MockLiqiBinaryDecoder - RecordDealTile round-trip with and without doras', () => {
    const mock = new MockLiqiBinaryDecoder()
    const deal1: MajsoulRecordDealTile = {
        type: 'RecordDealTile',
        seat: 0,
        tile: '9s'
    }
    const enc1 = mock.testEncodeRecordDealTile(deal1)
    const dec1 = mock.testDecodeRecordDealTile(enc1)
    assert.deepStrictEqual(dec1, deal1)

    const deal2: MajsoulRecordDealTile = {
        type: 'RecordDealTile',
        seat: 1,
        tile: '5p',
        doras: ['1m', '9m']
    }
    const enc2 = mock.testEncodeRecordDealTile(deal2)
    const dec2 = mock.testDecodeRecordDealTile(enc2)
    assert.deepStrictEqual(dec2, deal2)
})

test('MockLiqiBinaryDecoder - RecordDiscardTile round-trip', () => {
    const mock = new MockLiqiBinaryDecoder()
    const discard: MajsoulRecordDiscardTile = {
        type: 'RecordDiscardTile',
        seat: 2,
        tile: '1z',
        isMoqie: true,
        isLiqi: true,
        doras: ['5s']
    }
    const enc = mock.testEncodeRecordDiscardTile(discard)
    const dec = mock.testDecodeRecordDiscardTile(enc)
    assert.deepStrictEqual(dec, discard)
})

test('MockLiqiBinaryDecoder - RecordChiPengGang round-trip for chi, pon, daiminkan', () => {
    const mock = new MockLiqiBinaryDecoder()
    const meldTypes: readonly ('chi' | 'pon' | 'daiminkan')[] = ['chi', 'pon', 'daiminkan']

    let idx = 0
    while (idx < meldTypes.length) {
        const meldType = meldTypes[idx] ?? 'chi'
        const meld: MajsoulRecordChiPengGang = {
            type: 'RecordChiPengGang',
            seat: 1,
            meldType,
            tiles: ['2m', '3m', '4m'],
            fromSeat: 0
        }
        const enc = mock.testEncodeRecordChiPengGang(meld)
        const dec = mock.testDecodeRecordChiPengGang(enc)
        assert.deepStrictEqual(dec, meld)
        idx++
    }
})

test('MockLiqiBinaryDecoder - RecordAnGangAddGang round-trip for ankan and kakan', () => {
    const mock = new MockLiqiBinaryDecoder()
    const gangTypes: readonly ('ankan' | 'kakan')[] = ['ankan', 'kakan']

    let idx = 0
    while (idx < gangTypes.length) {
        const gangType = gangTypes[idx] ?? 'ankan'
        const gang: MajsoulRecordAnGangAddGang = {
            type: 'RecordAnGangAddGang',
            seat: 3,
            gangType,
            tiles: ['1z', '1z', '1z', '1z']
        }
        const enc = mock.testEncodeRecordAnGangAddGang(gang)
        const dec = mock.testDecodeRecordAnGangAddGang(enc)
        assert.deepStrictEqual(dec, gang)
        idx++
    }
})

test('MockLiqiBinaryDecoder - RecordBaBei (3P Kita) round-trip', () => {
    const mock = new MockLiqiBinaryDecoder()
    const kita: MajsoulRecordBaBei = {
        type: 'RecordBaBei',
        seat: 1,
        isMoqie: false,
        doras: ['4z']
    }
    const enc = mock.testEncodeRecordBaBei(kita)
    const dec = mock.testDecodeRecordBaBei(enc)
    assert.deepStrictEqual(dec, kita)
})

test('MockLiqiBinaryDecoder - RecordHule round-trip with multiple winners and negative deltas', () => {
    const mock = new MockLiqiBinaryDecoder()
    const hule: MajsoulRecordHule = {
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
            },
            {
                seat: 2,
                deltaScores: [-2000, -2000, 8000, -4000],
                handScore: 8000,
                fan: 3,
                fu: 30,
                yaku: ['리치', '핑후', '탕야오']
            }
        ]
    }
    const enc = mock.testEncodeRecordHule(hule)
    const dec = mock.testDecodeRecordHule(enc)
    assert.deepStrictEqual(dec, hule)
})

test('MockLiqiBinaryDecoder - RecordNoTile round-trip', () => {
    const mock = new MockLiqiBinaryDecoder()
    const noTile: MajsoulRecordNoTile = {
        type: 'RecordNoTile',
        tenpaiSeats: [1, 2],
        deltaScores: [-1500, 1500, 1500, -1500]
    }
    const enc = mock.testEncodeRecordNoTile(noTile)
    const dec = mock.testDecodeRecordNoTile(enc)
    assert.deepStrictEqual(dec, noTile)
})

test('MockLiqiBinaryDecoder - PlayerInfo round-trip', () => {
    const mock = new MockLiqiBinaryDecoder()
    const player: MajsoulPlayerInfo = {
        accountId: 99999,
        nickname: 'SenseiTester',
        seat: 2,
        level: 5
    }
    const enc = mock.testEncodePlayerInfo(player)
    const dec = mock.testDecodePlayerInfo(enc)
    assert.deepStrictEqual(dec, player)
})

test('LiqiBinaryDecoder - Wrapper envelope encode, decode, and obfuscation', () => {
    const decoder = new LiqiBinaryDecoder()
    const action: MajsoulRecordDealTile = {
        type: 'RecordDealTile',
        seat: 2,
        tile: '7p'
    }

    // 1. Plain wrapper
    const plainWrap = decoder.encodeAction(action, false)
    const plainWrapBytes = decoder.encodeWrapper(plainWrap.name, plainWrap.data)
    const decodedWrapper = decoder.decodeWrapper(plainWrapBytes)
    assert.strictEqual(decodedWrapper.name, '.lq.RecordDealTile')
    const decodedAction = decoder.decodeAction(decodedWrapper.name, decodedWrapper.data, false)
    assert.deepStrictEqual(decodedAction, action)

    // 2. Obfuscated wrapper
    const obfWrap = decoder.encodeAction(action, true)
    const obfWrapBytes = decoder.encodeWrapper(obfWrap.name, obfWrap.data)
    const decObfWrapper = decoder.decodeWrapper(obfWrapBytes)
    const decObfAction = decoder.decodeAction(decObfWrapper.name, decObfWrapper.data, true)
    assert.deepStrictEqual(decObfAction, action)

    // 3. Auto-detected obfuscation
    const decAutoAction = decoder.decodeAction(decObfWrapper.name, decObfWrapper.data)
    assert.deepStrictEqual(decAutoAction, action)
})

test('LiqiBinaryDecoder - 4P Game Full Round-Trip (Binary & Base64)', () => {
    const decoder = new LiqiBinaryDecoder()
    const originalGame = SAMPLE_MAJSOUL_GAME

    // Encode to Uint8Array
    const binary = decoder.encodeGameRecord(originalGame, false)
    assert.ok(binary.length > 0)

    // Decode from Uint8Array
    const decodedGame = decoder.decodeGameRecord(binary)
    assert.strictEqual(decodedGame.uuid, originalGame.uuid)
    assert.strictEqual(decodedGame.roomType, originalGame.roomType)
    assert.strictEqual(decodedGame.timestamp, originalGame.timestamp)
    assert.strictEqual(decodedGame.players.length, 4)
    assert.strictEqual(decodedGame.rounds.length, 2)
    assert.deepStrictEqual(decodedGame.players, originalGame.players)
    assert.deepStrictEqual(decodedGame.rounds, originalGame.rounds)

    // Encode to Base64 string
    const base64Str = decoder.toBase64(binary)
    assert.ok(base64Str.length > 0)

    // Decode from Base64 string
    const decodedFromBase64 = decoder.decode(base64Str)
    assert.deepStrictEqual(decodedFromBase64, originalGame)

    // Verify compatibility with downstream PaipuParser
    const parser = new PaipuParser()
    const result = parser.parseGameRecord(decodedFromBase64)
    assert.strictEqual(result.detail.id, originalGame.uuid)
    assert.strictEqual(result.detail.players.length, 4)
    assert.strictEqual(result.detail.rounds.length, 2)
    assert.strictEqual(result.roundMetrics.length, 8)
})

test('LiqiBinaryDecoder - 4P Game with XOR obfuscation full round-trip', () => {
    const decoder = new LiqiBinaryDecoder()
    const originalGame = SAMPLE_MAJSOUL_GAME

    // Obfuscated encoding
    const obfuscatedBinary = decoder.encodeGameRecord(originalGame, true)
    const decodedGame = decoder.decodeGameRecord(obfuscatedBinary, true)
    assert.deepStrictEqual(decodedGame, originalGame)

    // Auto-detect deobfuscation
    const autoDecodedGame = decoder.decodeGameRecord(obfuscatedBinary)
    assert.deepStrictEqual(autoDecodedGame, originalGame)
})

test('LiqiBinaryDecoder - 3P (Sanma) Game Full Round-Trip with Kita (RecordBaBei)', () => {
    const decoder = new LiqiBinaryDecoder()
    const sanmaGame: MajsoulGameRecord = {
        uuid: '230801-sanma-test',
        roomType: '옥탁 3인 동풍전',
        timestamp: 1722520000000,
        players: [
            { accountId: 20001, nickname: 'SanmaEast', seat: 0, level: 4 },
            { accountId: 20002, nickname: 'SanmaSouth', seat: 1, level: 3 },
            { accountId: 20003, nickname: 'SanmaWest', seat: 2, level: 5 }
        ],
        rounds: [
            {
                header: {
                    type: 'RecordNewRound',
                    chang: 0,
                    ju: 0,
                    ben: 0,
                    liqi: 0,
                    scores: [35000, 35000, 35000, 0],
                    dora: '1p',
                    hands: [
                        ['1m', '9m', '1p', '2p', '3p', '4z', '4z', '1s', '2s', '3s', '5s', '6s', '7s'],
                        ['1p', '9p', '1s', '9s', '1z', '2z', '3z', '5z', '6z', '7z', '1m', '9m', '4z'],
                        ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '1p', '1p', '2p', '2p'],
                        []
                    ]
                },
                actions: [
                    // Seat 0 draws Kita (4z) and declares RecordBaBei
                    { type: 'RecordDealTile', seat: 0, tile: '4z' },
                    { type: 'RecordBaBei', seat: 0, isMoqie: true, doras: ['4z'] },
                    // Replacement draw
                    { type: 'RecordDealTile', seat: 0, tile: '8s' },
                    { type: 'RecordDiscardTile', seat: 0, tile: '1m', isMoqie: false, isLiqi: false },
                    // Seat 1 turn
                    { type: 'RecordDealTile', seat: 1, tile: '9p' },
                    { type: 'RecordDiscardTile', seat: 1, tile: '9p', isMoqie: true, isLiqi: false },
                    // Seat 2 Ron Win
                    {
                        type: 'RecordHule',
                        hules: [
                            {
                                seat: 2,
                                deltaScores: [0, -8000, 8000, 0],
                                handScore: 8000,
                                fan: 3,
                                fu: 40,
                                yaku: ['찬타', '산쇼쿠', '역패 백']
                            }
                        ]
                    }
                ]
            }
        ]
    }

    const binary = decoder.encodeGameRecord(sanmaGame, false)
    const decoded = decoder.decodeGameRecord(binary)
    assert.deepStrictEqual(decoded, sanmaGame)

    // With XOR obfuscation
    const obfBinary = decoder.encodeGameRecord(sanmaGame, true)
    const obfDecoded = decoder.decodeGameRecord(obfBinary, true)
    assert.deepStrictEqual(obfDecoded, sanmaGame)

    // Base64 round-trip
    const b64 = decoder.toBase64(obfBinary)
    const b64Decoded = decoder.decode(b64, true)
    assert.deepStrictEqual(b64Decoded, sanmaGame)

    // Downstream parser verification for 3P
    const parser = new PaipuParser()
    const parseResult = parser.parseGameRecord(b64Decoded)
    assert.strictEqual(parseResult.detail.players.length, 3)
    assert.strictEqual(parseResult.detail.rounds.length, 1)
    // 3 active seats * 1 round = 3 round metrics
    assert.strictEqual(parseResult.roundMetrics.length, 3)
})

test('LiqiBinaryDecoder - Single round encode and decode', () => {
    const decoder = new LiqiBinaryDecoder()
    const singleRound = SAMPLE_MAJSOUL_GAME.rounds[0]
    assert.ok(singleRound !== undefined)

    const encoded = decoder.encodeRound(singleRound)
    const decoded = decoder.decodeRound(encoded)
    assert.deepStrictEqual(decoded, singleRound)
})
