export const TILE_COUNT = 34

export const TILE_NAMES: readonly string[] = [
    '1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m',
    '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p',
    '1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s',
    '1z', '2z', '3z', '4z', '5z', '6z', '7z'
]

export class TileConverter {
    public static tileStringToId(tileStr: string): number {
        /*_ GEMINI THINKING _*/
        // Normalize red fives: '0m' -> '5m', '0p' -> '5p', '0s' -> '5s'
        const normalized = tileStr.replace('0m', '5m').replace('0p', '5p').replace('0s', '5s')
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
}
