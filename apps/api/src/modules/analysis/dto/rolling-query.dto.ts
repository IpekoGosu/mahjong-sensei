/*_ GEMINI THINKING _*/
import { GameMode, RollingWindowSize } from '@mahjong-sensei/types'

export class RollingQueryDto {
    public readonly accountId: number
    public readonly window: RollingWindowSize
    public readonly mode: GameMode

    public constructor(accountId: number, window: RollingWindowSize, mode: GameMode) {
        this.accountId = accountId
        this.window = window
        this.mode = mode
    }

    public static parseWindow(rawVal?: string | number | null): RollingWindowSize {
        if (rawVal === undefined || rawVal === null || rawVal === '') {
            return 10
        }
        const num = typeof rawVal === 'number' ? rawVal : parseInt(String(rawVal), 10)
        if (num === 30 || num === 50 || num === 100) {
            return num
        }
        return 10
    }

    public static parseMode(rawMode?: string | null): GameMode {
        return rawMode === '4p' ? '4p' : '3p'
    }
}
