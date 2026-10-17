import { SeatIndex } from '@mahjong-sensei/types'
import {
    MajsoulGameRecord,
    MajsoulPlayerInfo,
    MajsoulRoundRecord,
    MajsoulRoundAction,
    MajsoulRecordNewRound,
    MajsoulRecordDealTile,
    MajsoulRecordDiscardTile,
    MajsoulRecordChiPengGang,
    MajsoulRecordAnGangAddGang,
    MajsoulRecordBaBei,
    MajsoulRecordHule,
    MajsoulHuleItem,
    MajsoulRecordNoTile
} from './types'

export interface LiqiWrapper {
    readonly name: string
    readonly data: Uint8Array
}

export interface ProtoRawField {
    readonly fieldNumber: number
    readonly wireType: number
    readonly varintValue?: bigint
    readonly data?: Uint8Array
}

export interface Varint64Result {
    readonly value: bigint
    readonly bytesRead: number
}

export interface VarintResult {
    readonly value: number
    readonly bytesRead: number
}

export class LiqiBinaryDecoder {
    protected readonly xorKey: readonly number[]

    public constructor(customXorKey?: readonly number[]) {
        if (customXorKey !== undefined && customXorKey.length > 0) {
            this.xorKey = [...customXorKey]
        } else {
            this.xorKey = [0x84, 0x5e, 0x4e, 0x42, 0x39, 0xa2, 0x1f, 0x60, 0x1c]
        }
    }

    /*_ GEMINI THINKING _*/
    public decode(input: Uint8Array | string, isObfuscated?: boolean): MajsoulGameRecord {
        return this.decodeGameRecord(input, isObfuscated)
    }

    /*_ GEMINI THINKING _*/
    public encode(record: MajsoulGameRecord, obfuscate: boolean = false): Uint8Array {
        return this.encodeGameRecord(record, obfuscate)
    }

    /*_ GEMINI THINKING _*/
    public decodeGameRecord(input: Uint8Array | string, isObfuscated?: boolean): MajsoulGameRecord {
        const buffer = this.toUint8Array(input)
        const fields = this.parseProtoFields(buffer)

        let uuid = ''
        let roomType = ''
        let timestamp = 0
        const players: MajsoulPlayerInfo[] = []
        const wrapperDataList: Uint8Array[] = []

        for (const field of fields) {
            if (field.fieldNumber === 1) {
                if (field.data !== undefined) {
                    if (uuid === '') {
                        uuid = this.readString(field.data, 0, field.data.length)
                    }
                }
            } else if (field.fieldNumber === 2 && field.data !== undefined) {
                roomType = this.readString(field.data, 0, field.data.length)
            } else if (field.fieldNumber === 3 && field.varintValue !== undefined) {
                timestamp = Number(field.varintValue)
            } else if (field.fieldNumber === 4 && field.data !== undefined) {
                players.push(this.decodePlayerInfo(field.data))
            } else if (field.fieldNumber === 5 && field.data !== undefined) {
                wrapperDataList.push(field.data)
            }
        }

        // Check if input is a single Wrapper message directly (field 1 is action name string, field 2 is payload)
        const isSingleWrapper =
            wrapperDataList.length === 0 &&
            players.length === 0 &&
            timestamp === 0 &&
            (uuid.startsWith('.lq.') || uuid.startsWith('lq.') || uuid.startsWith('Record') || uuid.startsWith('Action'))

        if (isSingleWrapper) {
            const singleWrapper = this.decodeWrapper(buffer)
            if (singleWrapper.name.length > 0) {
                const singleAction = this.decodeAction(singleWrapper.name, singleWrapper.data, isObfuscated)
                const rounds = this.partitionActionsIntoRounds([singleAction])
                return {
                    uuid: 'single-wrapper-game',
                    roomType: '사총 동풍전',
                    timestamp: Date.now(),
                    players: this.generateDefaultPlayers(4),
                    rounds
                }
            }
        }

        // If field 5 records were empty, check if input was GameDetailRecords (records in field 1)
        if (wrapperDataList.length === 0) {
            for (const field of fields) {
                if (field.fieldNumber === 1 && field.data !== undefined) {
                    wrapperDataList.push(field.data)
                }
            }
            if (wrapperDataList.length > 0) {
                uuid = 'game-detail-record'
            }
        }

        const actions: (MajsoulRecordNewRound | MajsoulRoundAction)[] = []
        for (const wrapBytes of wrapperDataList) {
            const wrapper = this.decodeWrapper(wrapBytes)
            if (wrapper.name.length > 0) {
                actions.push(this.decodeAction(wrapper.name, wrapper.data, isObfuscated))
            }
        }

        const rounds = this.partitionActionsIntoRounds(actions)
        const is3P = roomType.includes('3') || players.length === 3 || this.isSanmaActions(actions)
        const playerCount = is3P ? 3 : 4

        const effectivePlayers = players.length >= playerCount
            ? players
            : this.generateDefaultPlayers(playerCount)

        const effectiveRoomType = roomType.length > 0
            ? roomType
            : (is3P ? '옥탁 3인 동풍전' : '옥탁 4인 동풍전')

        const effectiveUuid = uuid.length > 0 ? uuid : `game-${Date.now().toString()}`
        const effectiveTimestamp = timestamp > 0 ? timestamp : Date.now()

        return {
            uuid: effectiveUuid,
            roomType: effectiveRoomType,
            timestamp: effectiveTimestamp,
            players: effectivePlayers,
            rounds
        }
    }

    /*_ GEMINI THINKING _*/
    public encodeGameRecord(record: MajsoulGameRecord, obfuscate: boolean = false): Uint8Array {
        const chunks: Uint8Array[] = [
            this.writeStringField(1, record.uuid),
            this.writeStringField(2, record.roomType),
            this.writeVarintField(3, record.timestamp)
        ]

        for (const player of record.players) {
            const playerData = this.encodePlayerInfo(player)
            chunks.push(this.writeLengthDelimited(4, playerData))
        }

        for (const round of record.rounds) {
            const headerWrapper = this.encodeAction(round.header, obfuscate)
            const headerWrapBytes = this.encodeWrapper(headerWrapper.name, headerWrapper.data)
            chunks.push(this.writeLengthDelimited(5, headerWrapBytes))

            for (const action of round.actions) {
                const actWrapper = this.encodeAction(action, obfuscate)
                const actWrapBytes = this.encodeWrapper(actWrapper.name, actWrapper.data)
                chunks.push(this.writeLengthDelimited(5, actWrapBytes))
            }
        }

        return this.concatBuffers(chunks)
    }

    /*_ GEMINI THINKING _*/
    public decodeRound(input: Uint8Array | string, isObfuscated?: boolean): MajsoulRoundRecord {
        const game = this.decodeGameRecord(input, isObfuscated)
        const round = game.rounds[0]
        if (round === undefined) {
            throw new Error('No round found in payload')
        }
        return round
    }

    /*_ GEMINI THINKING _*/
    public encodeRound(round: MajsoulRoundRecord, obfuscate: boolean = false): Uint8Array {
        const chunks: Uint8Array[] = []

        const headerWrapper = this.encodeAction(round.header, obfuscate)
        const headerWrapBytes = this.encodeWrapper(headerWrapper.name, headerWrapper.data)
        chunks.push(this.writeLengthDelimited(1, headerWrapBytes))

        for (const action of round.actions) {
            const actWrapper = this.encodeAction(action, obfuscate)
            const actWrapBytes = this.encodeWrapper(actWrapper.name, actWrapper.data)
            chunks.push(this.writeLengthDelimited(1, actWrapBytes))
        }

        return this.concatBuffers(chunks)
    }

    /*_ GEMINI THINKING _*/
    public decodeWrapper(input: Uint8Array | string): LiqiWrapper {
        const buffer = this.toUint8Array(input)
        const fields = this.parseProtoFields(buffer)
        let name = ''
        let data: Uint8Array = new Uint8Array(0)

        for (const field of fields) {
            if (field.fieldNumber === 1 && field.data !== undefined) {
                name = this.readString(field.data, 0, field.data.length)
            } else if (field.fieldNumber === 2 && field.data !== undefined) {
                data = field.data
            }
        }

        return { name, data }
    }

    /*_ GEMINI THINKING _*/
    public encodeWrapper(name: string, data: Uint8Array): Uint8Array {
        const nameField = this.writeStringField(1, name)
        const dataField = this.writeLengthDelimited(2, data)
        return this.concatBuffers([nameField, dataField])
    }

    /*_ GEMINI THINKING _*/
    public decodeAction(
        name: string,
        data: Uint8Array,
        isObfuscated?: boolean
    ): MajsoulRoundAction | MajsoulRecordNewRound {
        let payload = data
        if (isObfuscated === true) {
            payload = this.deobfuscate(data)
        } else if (isObfuscated === undefined) {
            if (this.isObfuscatedPayload(data)) {
                payload = this.deobfuscate(data)
            }
        }

        const normalizedName = this.normalizeActionName(name)
        switch (normalizedName) {
            case 'RecordNewRound':
                return this.decodeRecordNewRound(payload)
            case 'RecordDealTile':
                return this.decodeRecordDealTile(payload)
            case 'RecordDiscardTile':
                return this.decodeRecordDiscardTile(payload)
            case 'RecordChiPengGang':
                return this.decodeRecordChiPengGang(payload)
            case 'RecordAnGangAddGang':
                return this.decodeRecordAnGangAddGang(payload)
            case 'RecordBaBei':
                return this.decodeRecordBaBei(payload)
            case 'RecordHule':
                return this.decodeRecordHule(payload)
            case 'RecordNoTile':
                return this.decodeRecordNoTile(payload)
            default:
                throw new Error(`Unsupported action type: ${name}`)
        }
    }

    /*_ GEMINI THINKING _*/
    public encodeAction(
        action: MajsoulRoundAction | MajsoulRecordNewRound,
        obfuscate: boolean = false
    ): LiqiWrapper {
        const name = `.lq.${action.type}`
        let rawData: Uint8Array

        switch (action.type) {
            case 'RecordNewRound':
                rawData = this.encodeRecordNewRound(action)
                break
            case 'RecordDealTile':
                rawData = this.encodeRecordDealTile(action)
                break
            case 'RecordDiscardTile':
                rawData = this.encodeRecordDiscardTile(action)
                break
            case 'RecordChiPengGang':
                rawData = this.encodeRecordChiPengGang(action)
                break
            case 'RecordAnGangAddGang':
                rawData = this.encodeRecordAnGangAddGang(action)
                break
            case 'RecordBaBei':
                rawData = this.encodeRecordBaBei(action)
                break
            case 'RecordHule':
                rawData = this.encodeRecordHule(action)
                break
            case 'RecordNoTile':
                rawData = this.encodeRecordNoTile(action)
                break
        }

        const data = obfuscate ? this.obfuscate(rawData) : rawData
        return { name, data }
    }

    /*_ GEMINI THINKING _*/
    public toBase64(bytes: Uint8Array): string {
        return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64')
    }

    // =========================================================================
    // Protected Internal Wire / XOR / Action Helpers
    // =========================================================================

    /*_ GEMINI THINKING _*/
    protected xorTransform(data: Uint8Array): Uint8Array {
        const result = new Uint8Array(data.length)
        const keyLen = this.xorKey.length
        let i = 0
        while (i < data.length) {
            const keyByte = this.xorKey[i % keyLen] ?? 0
            const dataByte = data[i] ?? 0
            result[i] = dataByte ^ keyByte
            i++
        }
        return result
    }

    /*_ GEMINI THINKING _*/
    protected deobfuscate(data: Uint8Array): Uint8Array {
        return this.xorTransform(data)
    }

    /*_ GEMINI THINKING _*/
    protected obfuscate(data: Uint8Array): Uint8Array {
        return this.xorTransform(data)
    }

    /*_ GEMINI THINKING _*/
    protected isObfuscatedPayload(data: Uint8Array): boolean {
        if (data.length === 0) {
            return false
        }
        const firstByte = data[0] ?? 0
        const keyByte = this.xorKey[0] ?? 0
        const deobfFirst = firstByte ^ keyByte

        const deobfWire = deobfFirst & 0x07
        const deobfField = deobfFirst >>> 3

        const plainWire = firstByte & 0x07
        const plainField = firstByte >>> 3

        const isDeobfValidTag = (deobfWire === 0 || deobfWire === 2) && deobfField >= 1 && deobfField <= 15
        const isPlainValidTag = (plainWire === 0 || plainWire === 2) && plainField >= 1 && plainField <= 15

        if (isDeobfValidTag && !isPlainValidTag) {
            return true
        }
        if (!isDeobfValidTag && isPlainValidTag) {
            return false
        }
        if (isDeobfValidTag && isPlainValidTag) {
            const plainFields = this.parseProtoFields(data)
            const deobfFields = this.parseProtoFields(this.deobfuscate(data))
            return deobfFields.length > plainFields.length
        }

        const plainFields = this.parseProtoFields(data)
        const deobfFields = this.parseProtoFields(this.deobfuscate(data))
        return deobfFields.length > plainFields.length
    }

    /*_ GEMINI THINKING _*/
    protected readVarint64(buffer: Uint8Array, offset: number): Varint64Result {
        let result = 0n
        let shift = 0n
        let bytesRead = 0

        while (offset + bytesRead < buffer.length) {
            const raw = buffer[offset + bytesRead] ?? 0
            const byte = BigInt(raw)
            bytesRead++
            result |= (byte & 0x7Fn) << shift
            if ((byte & 0x80n) === 0n) {
                break
            }
            shift += 7n
            if (bytesRead > 10) {
                throw new Error('Malformed varint: exceeds 10 bytes')
            }
        }

        return { value: result, bytesRead }
    }

    /*_ GEMINI THINKING _*/
    protected readVarint(buffer: Uint8Array, offset: number): VarintResult {
        const { value, bytesRead } = this.readVarint64(buffer, offset)
        return { value: Number(value), bytesRead }
    }

    /*_ GEMINI THINKING _*/
    protected writeVarint(val: number | bigint): Uint8Array {
        let v = typeof val === 'bigint' ? val : BigInt(Math.floor(val))
        if (v < 0n) {
            v = BigInt.asUintN(64, v)
        }
        const bytes: number[] = []
        while (v >= 0x80n) {
            bytes.push(Number((v & 0x7Fn) | 0x80n))
            v >>= 7n
        }
        bytes.push(Number(v & 0x7Fn))
        return new Uint8Array(bytes)
    }

    /*_ GEMINI THINKING _*/
    protected decodeSignedVarint(val: bigint): number {
        if (val >= 0x8000000000000000n) {
            return Number(BigInt.asIntN(64, val))
        }
        if (val >= 0x80000000n && val <= 0xffffffffn) {
            return Number(BigInt.asIntN(32, val))
        }
        return Number(val)
    }

    /*_ GEMINI THINKING _*/
    protected encodeSignedVarint(val: number): Uint8Array {
        const b = BigInt(val)
        if (b < 0n) {
            return this.writeVarint(BigInt.asUintN(64, b))
        }
        return this.writeVarint(b)
    }

    /*_ GEMINI THINKING _*/
    protected readPackedVarints(buffer: Uint8Array): readonly number[] {
        const values: number[] = []
        let offset = 0
        while (offset < buffer.length) {
            const { value, bytesRead } = this.readVarint(buffer, offset)
            values.push(value)
            offset += bytesRead
        }
        return values
    }

    /*_ GEMINI THINKING _*/
    protected writePackedVarints(fieldNumber: number, values: readonly number[]): Uint8Array {
        const chunks: Uint8Array[] = []
        let totalLen = 0
        for (const v of values) {
            const b = this.writeVarint(v)
            chunks.push(b)
            totalLen += b.length
        }
        const combined = new Uint8Array(totalLen)
        let offset = 0
        for (const chunk of chunks) {
            combined.set(chunk, offset)
            offset += chunk.length
        }
        return this.writeLengthDelimited(fieldNumber, combined)
    }

    /*_ GEMINI THINKING _*/
    protected readPackedSignedVarints(buffer: Uint8Array): readonly number[] {
        const values: number[] = []
        let offset = 0
        while (offset < buffer.length) {
            const { value, bytesRead } = this.readVarint64(buffer, offset)
            values.push(this.decodeSignedVarint(value))
            offset += bytesRead
        }
        return values
    }

    /*_ GEMINI THINKING _*/
    protected writePackedSignedVarints(fieldNumber: number, values: readonly number[]): Uint8Array {
        const chunks: Uint8Array[] = []
        let totalLen = 0
        for (const v of values) {
            const b = this.encodeSignedVarint(v)
            chunks.push(b)
            totalLen += b.length
        }
        const combined = new Uint8Array(totalLen)
        let offset = 0
        for (const chunk of chunks) {
            combined.set(chunk, offset)
            offset += chunk.length
        }
        return this.writeLengthDelimited(fieldNumber, combined)
    }

    /*_ GEMINI THINKING _*/
    protected readString(buffer: Uint8Array, offset: number, length: number): string {
        const slice = buffer.subarray(offset, offset + length)
        return new TextDecoder().decode(slice)
    }

    /*_ GEMINI THINKING _*/
    protected writeString(str: string): Uint8Array {
        return new TextEncoder().encode(str)
    }

    /*_ GEMINI THINKING _*/
    protected writeLengthDelimited(fieldNumber: number, data: Uint8Array): Uint8Array {
        const tag = (fieldNumber << 3) | 2
        const tagBytes = this.writeVarint(tag)
        const lenBytes = this.writeVarint(data.length)
        const result = new Uint8Array(tagBytes.length + lenBytes.length + data.length)
        result.set(tagBytes, 0)
        result.set(lenBytes, tagBytes.length)
        result.set(data, tagBytes.length + lenBytes.length)
        return result
    }

    /*_ GEMINI THINKING _*/
    protected writeVarintField(fieldNumber: number, value: number | bigint): Uint8Array {
        const tag = (fieldNumber << 3) | 0
        const tagBytes = this.writeVarint(tag)
        const valBytes = this.writeVarint(value)
        const result = new Uint8Array(tagBytes.length + valBytes.length)
        result.set(tagBytes, 0)
        result.set(valBytes, tagBytes.length)
        return result
    }

    /*_ GEMINI THINKING _*/
    protected writeStringField(fieldNumber: number, str: string): Uint8Array {
        const strBytes = this.writeString(str)
        return this.writeLengthDelimited(fieldNumber, strBytes)
    }

    /*_ GEMINI THINKING _*/
    protected parseProtoFields(buffer: Uint8Array): readonly ProtoRawField[] {
        const fields: ProtoRawField[] = []
        let offset = 0

        while (offset < buffer.length) {
            const tagResult = this.readVarint(buffer, offset)
            offset += tagResult.bytesRead
            const tag = tagResult.value
            const fieldNumber = tag >>> 3
            const wireType = tag & 0x07

            if (fieldNumber === 0) {
                break
            }

            if (wireType === 0) {
                if (offset >= buffer.length) {
                    break
                }
                const varResult = this.readVarint64(buffer, offset)
                if (varResult.bytesRead === 0) {
                    break
                }
                offset += varResult.bytesRead
                fields.push({
                    fieldNumber,
                    wireType,
                    varintValue: varResult.value
                })
            } else if (wireType === 2) {
                if (offset >= buffer.length) {
                    break
                }
                const lenResult = this.readVarint(buffer, offset)
                if (lenResult.bytesRead === 0) {
                    break
                }
                offset += lenResult.bytesRead
                const length = lenResult.value
                if (length < 0 || offset + length > buffer.length) {
                    break
                }
                const data = buffer.subarray(offset, offset + length)
                offset += length
                fields.push({
                    fieldNumber,
                    wireType,
                    data
                })
            } else if (wireType === 1) {
                if (offset + 8 > buffer.length) {
                    break
                }
                const data = buffer.subarray(offset, offset + 8)
                offset += 8
                fields.push({
                    fieldNumber,
                    wireType,
                    data
                })
            } else if (wireType === 5) {
                if (offset + 4 > buffer.length) {
                    break
                }
                const data = buffer.subarray(offset, offset + 4)
                offset += 4
                fields.push({
                    fieldNumber,
                    wireType,
                    data
                })
            } else {
                break
            }
        }

        return fields
    }

    /*_ GEMINI THINKING _*/
    protected concatBuffers(buffers: readonly Uint8Array[]): Uint8Array {
        let total = 0
        for (const b of buffers) {
            total += b.length
        }
        const res = new Uint8Array(total)
        let cur = 0
        for (const b of buffers) {
            res.set(b, cur)
            cur += b.length
        }
        return res
    }

    /*_ GEMINI THINKING _*/
    protected toUint8Array(input: Uint8Array | string): Uint8Array {
        if (typeof input === 'string') {
            const buf = Buffer.from(input, 'base64')
            return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
        }
        return input
    }

    /*_ GEMINI THINKING _*/
    protected toSeatIndex(seat: number): SeatIndex {
        if (seat === 1) {
            return 1
        }
        if (seat === 2) {
            return 2
        }
        if (seat === 3) {
            return 3
        }
        return 0
    }

    /*_ GEMINI THINKING _*/
    protected normalizeActionName(name: string): string {
        const parts = name.split('.')
        const lastPart = parts[parts.length - 1] ?? name
        if (lastPart.startsWith('Action')) {
            return `Record${lastPart.slice('Action'.length)}`
        }
        return lastPart
    }

    /*_ GEMINI THINKING _*/
    protected decodeRecordNewRound(data: Uint8Array): MajsoulRecordNewRound {
        const fields = this.parseProtoFields(data)
        let chang = 0
        let ju = 0
        let ben = 0
        let liqi = 0
        let dora = ''
        const scores: number[] = []
        const hands: [string[], string[], string[], string[]] = [[], [], [], []]

        for (const field of fields) {
            if (field.fieldNumber === 1 && field.varintValue !== undefined) {
                chang = Number(field.varintValue)
            } else if (field.fieldNumber === 2 && field.varintValue !== undefined) {
                ju = Number(field.varintValue)
            } else if (field.fieldNumber === 3 && field.varintValue !== undefined) {
                ben = Number(field.varintValue)
            } else if (field.fieldNumber === 4 && field.varintValue !== undefined) {
                liqi = Number(field.varintValue)
            } else if (field.fieldNumber === 5 && field.data !== undefined) {
                dora = this.readString(field.data, 0, field.data.length)
            } else if (field.fieldNumber === 6) {
                if (field.wireType === 0 && field.varintValue !== undefined) {
                    scores.push(Number(field.varintValue))
                } else if (field.wireType === 2 && field.data !== undefined) {
                    scores.push(...this.readPackedVarints(field.data))
                }
            } else if (field.fieldNumber === 7 && field.data !== undefined) {
                hands[0]?.push(this.readString(field.data, 0, field.data.length))
            } else if (field.fieldNumber === 8) {
                if (field.wireType === 2 && field.data !== undefined) {
                    hands[1]?.push(this.readString(field.data, 0, field.data.length))
                } else if (field.wireType === 0 && field.varintValue !== undefined && liqi === 0) {
                    liqi = Number(field.varintValue)
                }
            } else if (field.fieldNumber === 9 && field.data !== undefined) {
                hands[2]?.push(this.readString(field.data, 0, field.data.length))
            } else if (field.fieldNumber === 10 && field.data !== undefined) {
                hands[3]?.push(this.readString(field.data, 0, field.data.length))
            } else if (field.fieldNumber === 11 && field.data !== undefined && dora === '') {
                dora = this.readString(field.data, 0, field.data.length)
            }
        }

        const isSanmaRound = scores.length === 3 || ((hands[3]?.length ?? 0) === 0 && (hands[0]?.length ?? 0) > 0)
        const defaultInitialScore = isSanmaRound ? 35000 : 25000
        const defaultScores: readonly [number, number, number, number] = [
            scores[0] ?? defaultInitialScore,
            scores[1] ?? defaultInitialScore,
            scores[2] ?? defaultInitialScore,
            scores[3] ?? (isSanmaRound ? 0 : 25000)
        ]

        return {
            type: 'RecordNewRound',
            chang,
            ju,
            ben,
            liqi,
            scores: defaultScores,
            dora,
            hands: [
                hands[0] ?? [],
                hands[1] ?? [],
                hands[2] ?? [],
                hands[3] ?? []
            ]
        }
    }

    /*_ GEMINI THINKING _*/
    protected encodeRecordNewRound(record: MajsoulRecordNewRound): Uint8Array {
        const chunks: Uint8Array[] = [
            this.writeVarintField(1, record.chang),
            this.writeVarintField(2, record.ju),
            this.writeVarintField(3, record.ben),
            this.writeVarintField(4, record.liqi),
            this.writeStringField(5, record.dora),
            this.writePackedVarints(6, record.scores)
        ]

        let s = 0
        while (s < 4) {
            const hand = record.hands[s] ?? []
            const fieldNumber = 7 + s
            for (const tile of hand) {
                chunks.push(this.writeStringField(fieldNumber, tile))
            }
            s++
        }

        return this.concatBuffers(chunks)
    }

    /*_ GEMINI THINKING _*/
    protected decodeRecordDealTile(data: Uint8Array): MajsoulRecordDealTile {
        const fields = this.parseProtoFields(data)
        let seat: SeatIndex = 0
        let tile = ''
        const doras: string[] = []

        for (const field of fields) {
            if (field.fieldNumber === 1 && field.varintValue !== undefined) {
                seat = this.toSeatIndex(Number(field.varintValue))
            } else if (field.fieldNumber === 2 && field.data !== undefined) {
                tile = this.readString(field.data, 0, field.data.length)
            } else if ((field.fieldNumber === 3 || field.fieldNumber === 4) && field.data !== undefined) {
                doras.push(this.readString(field.data, 0, field.data.length))
            }
        }

        if (doras.length > 0) {
            return {
                type: 'RecordDealTile',
                seat,
                tile,
                doras
            }
        }

        return {
            type: 'RecordDealTile',
            seat,
            tile
        }
    }

    /*_ GEMINI THINKING _*/
    protected encodeRecordDealTile(record: MajsoulRecordDealTile): Uint8Array {
        const chunks: Uint8Array[] = [
            this.writeVarintField(1, record.seat),
            this.writeStringField(2, record.tile)
        ]

        if (record.doras !== undefined) {
            for (const d of record.doras) {
                chunks.push(this.writeStringField(3, d))
            }
        }

        return this.concatBuffers(chunks)
    }

    /*_ GEMINI THINKING _*/
    protected decodeRecordDiscardTile(data: Uint8Array): MajsoulRecordDiscardTile {
        const fields = this.parseProtoFields(data)
        let seat: SeatIndex = 0
        let tile = ''
        let isLiqi = false
        let isMoqie = false
        const doras: string[] = []

        for (const field of fields) {
            if (field.fieldNumber === 1 && field.varintValue !== undefined) {
                seat = this.toSeatIndex(Number(field.varintValue))
            } else if (field.fieldNumber === 2 && field.data !== undefined) {
                tile = this.readString(field.data, 0, field.data.length)
            } else if (field.fieldNumber === 3 && field.varintValue !== undefined) {
                isLiqi = Number(field.varintValue) !== 0
            } else if (field.fieldNumber === 4 && field.varintValue !== undefined) {
                isMoqie = Number(field.varintValue) !== 0
            } else if (field.fieldNumber === 5 && field.data !== undefined) {
                doras.push(this.readString(field.data, 0, field.data.length))
            }
        }

        if (doras.length > 0) {
            return {
                type: 'RecordDiscardTile',
                seat,
                tile,
                isMoqie,
                isLiqi,
                doras
            }
        }

        return {
            type: 'RecordDiscardTile',
            seat,
            tile,
            isMoqie,
            isLiqi
        }
    }

    /*_ GEMINI THINKING _*/
    protected encodeRecordDiscardTile(record: MajsoulRecordDiscardTile): Uint8Array {
        const chunks: Uint8Array[] = [
            this.writeVarintField(1, record.seat),
            this.writeStringField(2, record.tile),
            this.writeVarintField(3, record.isLiqi ? 1 : 0),
            this.writeVarintField(4, record.isMoqie ? 1 : 0)
        ]

        if (record.doras !== undefined) {
            for (const d of record.doras) {
                chunks.push(this.writeStringField(5, d))
            }
        }

        return this.concatBuffers(chunks)
    }

    /*_ GEMINI THINKING _*/
    protected decodeRecordChiPengGang(data: Uint8Array): MajsoulRecordChiPengGang {
        const fields = this.parseProtoFields(data)
        let seat: SeatIndex = 0
        let meldType: 'chi' | 'pon' | 'daiminkan' = 'chi'
        let fromSeat: SeatIndex = 0
        const tiles: string[] = []

        for (const field of fields) {
            if (field.fieldNumber === 1 && field.varintValue !== undefined) {
                seat = this.toSeatIndex(Number(field.varintValue))
            } else if (field.fieldNumber === 2) {
                if (field.wireType === 0 && field.varintValue !== undefined) {
                    const code = Number(field.varintValue)
                    meldType = code === 1 ? 'pon' : (code === 2 ? 'daiminkan' : 'chi')
                } else if (field.wireType === 2 && field.data !== undefined) {
                    const str = this.readString(field.data, 0, field.data.length)
                    if (str === 'pon' || str === 'daiminkan') {
                        meldType = str
                    } else {
                        meldType = 'chi'
                    }
                }
            } else if (field.fieldNumber === 3 && field.data !== undefined) {
                tiles.push(this.readString(field.data, 0, field.data.length))
            } else if (field.fieldNumber === 4 && field.varintValue !== undefined) {
                fromSeat = this.toSeatIndex(Number(field.varintValue))
            }
        }

        return {
            type: 'RecordChiPengGang',
            seat,
            meldType,
            tiles,
            fromSeat
        }
    }

    /*_ GEMINI THINKING _*/
    protected encodeRecordChiPengGang(record: MajsoulRecordChiPengGang): Uint8Array {
        const meldCode = record.meldType === 'pon' ? 1 : (record.meldType === 'daiminkan' ? 2 : 0)
        const chunks: Uint8Array[] = [
            this.writeVarintField(1, record.seat),
            this.writeVarintField(2, meldCode)
        ]

        for (const t of record.tiles) {
            chunks.push(this.writeStringField(3, t))
        }
        chunks.push(this.writeVarintField(4, record.fromSeat))

        return this.concatBuffers(chunks)
    }

    /*_ GEMINI THINKING _*/
    protected decodeRecordAnGangAddGang(data: Uint8Array): MajsoulRecordAnGangAddGang {
        const fields = this.parseProtoFields(data)
        let seat: SeatIndex = 0
        let gangType: 'ankan' | 'kakan' = 'ankan'
        const tiles: string[] = []

        for (const field of fields) {
            if (field.fieldNumber === 1 && field.varintValue !== undefined) {
                seat = this.toSeatIndex(Number(field.varintValue))
            } else if (field.fieldNumber === 2) {
                if (field.wireType === 0 && field.varintValue !== undefined) {
                    gangType = Number(field.varintValue) === 1 ? 'kakan' : 'ankan'
                } else if (field.wireType === 2 && field.data !== undefined) {
                    const str = this.readString(field.data, 0, field.data.length)
                    gangType = str === 'kakan' ? 'kakan' : 'ankan'
                }
            } else if (field.fieldNumber === 3 && field.data !== undefined) {
                tiles.push(this.readString(field.data, 0, field.data.length))
            }
        }

        return {
            type: 'RecordAnGangAddGang',
            seat,
            gangType,
            tiles
        }
    }

    /*_ GEMINI THINKING _*/
    protected encodeRecordAnGangAddGang(record: MajsoulRecordAnGangAddGang): Uint8Array {
        const gangCode = record.gangType === 'kakan' ? 1 : 0
        const chunks: Uint8Array[] = [
            this.writeVarintField(1, record.seat),
            this.writeVarintField(2, gangCode)
        ]

        for (const t of record.tiles) {
            chunks.push(this.writeStringField(3, t))
        }

        return this.concatBuffers(chunks)
    }

    /*_ GEMINI THINKING _*/
    protected decodeRecordBaBei(data: Uint8Array): MajsoulRecordBaBei {
        const fields = this.parseProtoFields(data)
        let seat: SeatIndex = 0
        let isMoqie = false
        const doras: string[] = []

        for (const field of fields) {
            if (field.fieldNumber === 1 && field.varintValue !== undefined) {
                seat = this.toSeatIndex(Number(field.varintValue))
            } else if (field.fieldNumber === 2 && field.varintValue !== undefined) {
                isMoqie = Number(field.varintValue) !== 0
            } else if (field.fieldNumber === 3 && field.data !== undefined) {
                doras.push(this.readString(field.data, 0, field.data.length))
            }
        }

        if (doras.length > 0) {
            return {
                type: 'RecordBaBei',
                seat,
                isMoqie,
                doras
            }
        }

        return {
            type: 'RecordBaBei',
            seat,
            isMoqie
        }
    }

    /*_ GEMINI THINKING _*/
    protected encodeRecordBaBei(record: MajsoulRecordBaBei): Uint8Array {
        const chunks: Uint8Array[] = [
            this.writeVarintField(1, record.seat),
            this.writeVarintField(2, record.isMoqie ? 1 : 0)
        ]

        if (record.doras !== undefined) {
            for (const d of record.doras) {
                chunks.push(this.writeStringField(3, d))
            }
        }

        return this.concatBuffers(chunks)
    }

    /*_ GEMINI THINKING _*/
    protected decodeHuleItem(data: Uint8Array): MajsoulHuleItem {
        const fields = this.parseProtoFields(data)
        let seat: SeatIndex = 0
        const deltaList: number[] = []
        let handScore = 0
        let fan = 0
        let fu = 0
        const yaku: string[] = []
        const uradoras: string[] = []

        for (const field of fields) {
            if (field.fieldNumber === 1 && field.varintValue !== undefined) {
                seat = this.toSeatIndex(Number(field.varintValue))
            } else if (field.fieldNumber === 2) {
                if (field.wireType === 0 && field.varintValue !== undefined) {
                    deltaList.push(this.decodeSignedVarint(field.varintValue))
                } else if (field.wireType === 2 && field.data !== undefined) {
                    deltaList.push(...this.readPackedSignedVarints(field.data))
                }
            } else if (field.fieldNumber === 3 && field.varintValue !== undefined) {
                handScore = Number(field.varintValue)
            } else if (field.fieldNumber === 4 && field.varintValue !== undefined) {
                fan = Number(field.varintValue)
            } else if (field.fieldNumber === 5 && field.varintValue !== undefined) {
                fu = Number(field.varintValue)
            } else if (field.fieldNumber === 6 && field.data !== undefined) {
                yaku.push(this.readString(field.data, 0, field.data.length))
            } else if (field.fieldNumber === 7 && field.data !== undefined) {
                uradoras.push(this.readString(field.data, 0, field.data.length))
            }
        }

        const deltaScores: readonly [number, number, number, number] = [
            deltaList[0] ?? 0,
            deltaList[1] ?? 0,
            deltaList[2] ?? 0,
            deltaList[3] ?? 0
        ]

        if (uradoras.length > 0) {
            return {
                seat,
                deltaScores,
                handScore,
                fan,
                fu,
                yaku,
                uradoras
            }
        }

        return {
            seat,
            deltaScores,
            handScore,
            fan,
            fu,
            yaku
        }
    }

    /*_ GEMINI THINKING _*/
    protected encodeHuleItem(item: MajsoulHuleItem): Uint8Array {
        const chunks: Uint8Array[] = [
            this.writeVarintField(1, item.seat),
            this.writePackedSignedVarints(2, item.deltaScores),
            this.writeVarintField(3, item.handScore),
            this.writeVarintField(4, item.fan),
            this.writeVarintField(5, item.fu)
        ]

        for (const y of item.yaku) {
            chunks.push(this.writeStringField(6, y))
        }

        if (item.uradoras !== undefined) {
            for (const u of item.uradoras) {
                chunks.push(this.writeStringField(7, u))
            }
        }

        return this.concatBuffers(chunks)
    }

    /*_ GEMINI THINKING _*/
    protected decodeRecordHule(data: Uint8Array): MajsoulRecordHule {
        const fields = this.parseProtoFields(data)
        const hules: MajsoulHuleItem[] = []

        for (const field of fields) {
            if (field.fieldNumber === 1 && field.data !== undefined) {
                hules.push(this.decodeHuleItem(field.data))
            }
        }

        return {
            type: 'RecordHule',
            hules
        }
    }

    /*_ GEMINI THINKING _*/
    protected encodeRecordHule(record: MajsoulRecordHule): Uint8Array {
        const chunks: Uint8Array[] = []
        for (const item of record.hules) {
            const itemData = this.encodeHuleItem(item)
            chunks.push(this.writeLengthDelimited(1, itemData))
        }
        return this.concatBuffers(chunks)
    }

    /*_ GEMINI THINKING _*/
    protected decodeRecordNoTile(data: Uint8Array): MajsoulRecordNoTile {
        const fields = this.parseProtoFields(data)
        const tenpaiSeats: SeatIndex[] = []
        const deltaList: number[] = []

        for (const field of fields) {
            if (field.fieldNumber === 1) {
                if (field.wireType === 0 && field.varintValue !== undefined) {
                    tenpaiSeats.push(this.toSeatIndex(Number(field.varintValue)))
                } else if (field.wireType === 2 && field.data !== undefined) {
                    const rawSeats = this.readPackedVarints(field.data)
                    for (const s of rawSeats) {
                        tenpaiSeats.push(this.toSeatIndex(s))
                    }
                }
            } else if (field.fieldNumber === 2) {
                if (field.wireType === 0 && field.varintValue !== undefined) {
                    deltaList.push(this.decodeSignedVarint(field.varintValue))
                } else if (field.wireType === 2 && field.data !== undefined) {
                    deltaList.push(...this.readPackedSignedVarints(field.data))
                }
            }
        }

        const deltaScores: readonly [number, number, number, number] = [
            deltaList[0] ?? 0,
            deltaList[1] ?? 0,
            deltaList[2] ?? 0,
            deltaList[3] ?? 0
        ]

        return {
            type: 'RecordNoTile',
            tenpaiSeats,
            deltaScores
        }
    }

    /*_ GEMINI THINKING _*/
    protected encodeRecordNoTile(record: MajsoulRecordNoTile): Uint8Array {
        const chunks: Uint8Array[] = [
            this.writePackedVarints(1, record.tenpaiSeats),
            this.writePackedSignedVarints(2, record.deltaScores)
        ]
        return this.concatBuffers(chunks)
    }

    /*_ GEMINI THINKING _*/
    protected decodePlayerInfo(data: Uint8Array): MajsoulPlayerInfo {
        const fields = this.parseProtoFields(data)
        let accountId = 0
        let nickname = ''
        let seat: SeatIndex = 0
        let level = 1

        for (const field of fields) {
            if (field.fieldNumber === 1 && field.varintValue !== undefined) {
                accountId = Number(field.varintValue)
            } else if (field.fieldNumber === 2 && field.data !== undefined) {
                nickname = this.readString(field.data, 0, field.data.length)
            } else if (field.fieldNumber === 3 && field.varintValue !== undefined) {
                seat = this.toSeatIndex(Number(field.varintValue))
            } else if (field.fieldNumber === 4 && field.varintValue !== undefined) {
                level = Number(field.varintValue)
            }
        }

        return {
            accountId,
            nickname,
            seat,
            level
        }
    }

    /*_ GEMINI THINKING _*/
    protected encodePlayerInfo(player: MajsoulPlayerInfo): Uint8Array {
        const chunks: Uint8Array[] = [
            this.writeVarintField(1, player.accountId),
            this.writeStringField(2, player.nickname),
            this.writeVarintField(3, player.seat),
            this.writeVarintField(4, player.level)
        ]
        return this.concatBuffers(chunks)
    }

    /*_ GEMINI THINKING _*/
    protected partitionActionsIntoRounds(
        records: readonly (MajsoulRecordNewRound | MajsoulRoundAction)[]
    ): readonly MajsoulRoundRecord[] {
        const rounds: MajsoulRoundRecord[] = []
        let currentHeader: MajsoulRecordNewRound | null = null
        let currentActions: MajsoulRoundAction[] = []

        for (const rec of records) {
            if (rec.type === 'RecordNewRound') {
                if (currentHeader !== null) {
                    rounds.push({
                        header: currentHeader,
                        actions: currentActions
                    })
                }
                currentHeader = rec
                currentActions = []
            } else {
                currentActions.push(rec)
            }
        }

        if (currentHeader !== null) {
            rounds.push({
                header: currentHeader,
                actions: currentActions
            })
        } else if (currentActions.length > 0) {
            const fallbackHeader: MajsoulRecordNewRound = {
                type: 'RecordNewRound',
                chang: 0,
                ju: 0,
                ben: 0,
                liqi: 0,
                scores: [25000, 25000, 25000, 25000],
                dora: '1m',
                hands: [[], [], [], []]
            }
            rounds.push({
                header: fallbackHeader,
                actions: currentActions
            })
        }

        return rounds
    }

    /*_ GEMINI THINKING _*/
    protected isSanmaActions(actions: readonly (MajsoulRecordNewRound | MajsoulRoundAction)[]): boolean {
        for (const a of actions) {
            if (a.type === 'RecordBaBei') {
                return true
            }
            if (a.type === 'RecordNewRound') {
                if ((a.hands[3]?.length ?? 0) === 0 && (a.hands[0]?.length ?? 0) > 0) {
                    return true
                }
            }
        }
        return false
    }

    /*_ GEMINI THINKING _*/
    protected generateDefaultPlayers(count: number): readonly MajsoulPlayerInfo[] {
        const result: MajsoulPlayerInfo[] = []
        const names = ['PlayerEast', 'PlayerSouth', 'PlayerWest', 'PlayerNorth']
        let i = 0
        while (i < count) {
            const seat = this.toSeatIndex(i)
            result.push({
                accountId: 10000 + i,
                nickname: names[i] ?? `Player${i}`,
                seat,
                level: 3
            })
            i++
        }
        return result
    }
}
