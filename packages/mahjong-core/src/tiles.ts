export const TILE_COUNT = 34

export const TILE_NAMES: readonly string[] = [
    '1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m',
    '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p',
    '1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s',
    '1z', '2z', '3z', '4z', '5z', '6z', '7z'
]

export class TileConverter {
    public static normalizeTile(tileStr: string): string {
        return tileStr.replace('0m', '5m').replace('0p', '5p').replace('0s', '5s')
    }

    public static tileStringToId(tileStr: string): number {
        /*_ GEMINI THINKING _*/
        // Normalize red fives: '0m' -> '5m', '0p' -> '5p', '0s' -> '5s'
        const normalized = TileConverter.normalizeTile(tileStr)
        const index = TILE_NAMES.indexOf(normalized)
        if (index === -1) {
            throw new Error(`Invalid tile string: ${tileStr}`)
        }
        return index
    }

    public static idToTileString(id: number): string {
        const name = TILE_NAMES[id]
        if (!name) {
            throw new Error(`Invalid tile id: ${id}`)
        }
        return name
    }

    public static handToCountArray(tiles: readonly string[]): number[] {
        const counts = new Array<number>(TILE_COUNT).fill(0)
        for (const tile of tiles) {
            const id = TileConverter.tileStringToId(tile)
            const current = counts[id] ?? 0
            counts[id] = current + 1
        }
        return counts
    }

    public static isRedDora(tileStr: string): boolean {
        return tileStr.startsWith('0') || tileStr.includes('r')
    }

    /*_ GEMINI THINKING _*/
    public static getNextDoraTile(indicator: string, is3P: boolean = false): string {
        const norm = TileConverter.normalizeTile(indicator)
        const suit = norm.slice(-1)
        const val = Number.parseInt(norm.slice(0, -1), 10)

        if (is3P && suit === 'm' && val === 1) {
            return '9m'
        }

        if (is3P && suit === 'm' && val === 9) {
            return '1m'
        }

        if (suit === 'z') {
            if (val >= 1 && val <= 4) {
                return `${val === 4 ? 1 : val + 1}z`
            }
            if (val >= 5 && val <= 7) {
                return `${val === 7 ? 5 : val + 1}z`
            }
        }

        const nextVal = val === 9 ? 1 : val + 1
        return `${nextVal}${suit}`
    }
}
