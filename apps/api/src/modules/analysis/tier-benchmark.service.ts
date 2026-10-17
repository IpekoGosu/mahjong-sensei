/*_ GEMINI THINKING _*/
import { Injectable } from '@nestjs/common'
import { GameMode } from '@mahjong-sensei/types'

export type TierKey = 'NOVICE_ADEPT' | 'EXPERT' | 'MASTER' | 'SAINT'

export interface TierBenchmarkDistribution {
    readonly tier: TierKey
    readonly tierLabel: string
    readonly mode: GameMode
    readonly avgLuckScore: number
    readonly luckStdDev: number
    readonly avgSkillScore: number
    readonly skillStdDev: number
    readonly avgDealInRate: number
    readonly avgWinRate: number
    readonly startingShantenBaseline: number
}

export interface TierComparisonResult {
    readonly mode: GameMode
    readonly tier: TierKey
    readonly tierLabel: string
    readonly benchmark: TierBenchmarkDistribution
    readonly playerLuck: number
    readonly playerSkill: number
    readonly luckDelta: number
    readonly skillDelta: number
    readonly luckPercentile: number
    readonly skillPercentile: number
    readonly allTiers: readonly TierBenchmarkDistribution[]
}

export interface GenerateShareCardParams {
    readonly nickname: string
    readonly mode: GameMode
    readonly tierLabel: string
    readonly luckScore: number
    readonly skillScore: number
    readonly winRate: number
    readonly dealInRate: number
    readonly quadrant: string
}

@Injectable()
export class TierBenchmarkService {
    private readonly distributions: Readonly<Record<GameMode, Readonly<Record<TierKey, TierBenchmarkDistribution>>>> = {
        '4p': {
            NOVICE_ADEPT: {
                tier: 'NOVICE_ADEPT',
                tierLabel: '작사 (Adept)',
                mode: '4p',
                avgLuckScore: 50.0,
                luckStdDev: 10.0,
                avgSkillScore: 42.0,
                skillStdDev: 8.0,
                avgDealInRate: 0.155,
                avgWinRate: 0.210,
                startingShantenBaseline: 3.50
            },
            EXPERT: {
                tier: 'EXPERT',
                tierLabel: '작걸 (Expert)',
                mode: '4p',
                avgLuckScore: 50.0,
                luckStdDev: 9.0,
                avgSkillScore: 54.0,
                skillStdDev: 7.0,
                avgDealInRate: 0.135,
                avgWinRate: 0.225,
                startingShantenBaseline: 3.50
            },
            MASTER: {
                tier: 'MASTER',
                tierLabel: '작호 (Master)',
                mode: '4p',
                avgLuckScore: 50.0,
                luckStdDev: 8.0,
                avgSkillScore: 68.0,
                skillStdDev: 6.0,
                avgDealInRate: 0.118,
                avgWinRate: 0.238,
                startingShantenBaseline: 3.50
            },
            SAINT: {
                tier: 'SAINT',
                tierLabel: '작성 (Saint)',
                mode: '4p',
                avgLuckScore: 50.0,
                luckStdDev: 7.5,
                avgSkillScore: 80.0,
                skillStdDev: 5.0,
                avgDealInRate: 0.102,
                avgWinRate: 0.248,
                startingShantenBaseline: 3.50
            }
        },
        '3p': {
            NOVICE_ADEPT: {
                tier: 'NOVICE_ADEPT',
                tierLabel: '작사 (Adept)',
                mode: '3p',
                avgLuckScore: 50.0,
                luckStdDev: 10.0,
                avgSkillScore: 44.0,
                skillStdDev: 8.0,
                avgDealInRate: 0.180,
                avgWinRate: 0.290,
                startingShantenBaseline: 3.25
            },
            EXPERT: {
                tier: 'EXPERT',
                tierLabel: '작걸 (Expert)',
                mode: '3p',
                avgLuckScore: 50.0,
                luckStdDev: 9.0,
                avgSkillScore: 56.0,
                skillStdDev: 7.0,
                avgDealInRate: 0.155,
                avgWinRate: 0.310,
                startingShantenBaseline: 3.25
            },
            MASTER: {
                tier: 'MASTER',
                tierLabel: '작호 (Master)',
                mode: '3p',
                avgLuckScore: 50.0,
                luckStdDev: 8.0,
                avgSkillScore: 70.0,
                skillStdDev: 6.0,
                avgDealInRate: 0.135,
                avgWinRate: 0.330,
                startingShantenBaseline: 3.25
            },
            SAINT: {
                tier: 'SAINT',
                tierLabel: '작성 (Saint)',
                mode: '3p',
                avgLuckScore: 50.0,
                luckStdDev: 7.5,
                avgSkillScore: 82.0,
                skillStdDev: 5.0,
                avgDealInRate: 0.115,
                avgWinRate: 0.345,
                startingShantenBaseline: 3.25
            }
        }
    }

    public constructor() {}

    public getTierComparison(
        mode: GameMode,
        tier: string,
        playerLuck: number,
        playerSkill: number
    ): TierComparisonResult {
        /*_ GEMINI THINKING _*/
        const resolvedTier = this.resolveTierKey(tier)
        const validMode: GameMode = mode === '3p' ? '3p' : '4p'
        const tierGroup = this.distributions[validMode]
        const benchmark = tierGroup[resolvedTier]

        const luckDelta = Math.round((playerLuck - benchmark.avgLuckScore) * 10) / 10
        const skillDelta = Math.round((playerSkill - benchmark.avgSkillScore) * 10) / 10

        const luckPercentile = this.calculatePercentile(playerLuck, benchmark.avgLuckScore, benchmark.luckStdDev)
        const skillPercentile = this.calculatePercentile(playerSkill, benchmark.avgSkillScore, benchmark.skillStdDev)

        const allTiers: readonly TierBenchmarkDistribution[] = [
            tierGroup.NOVICE_ADEPT,
            tierGroup.EXPERT,
            tierGroup.MASTER,
            tierGroup.SAINT
        ]

        return {
            mode: validMode,
            tier: resolvedTier,
            tierLabel: benchmark.tierLabel,
            benchmark,
            playerLuck,
            playerSkill,
            luckDelta,
            skillDelta,
            luckPercentile,
            skillPercentile,
            allTiers
        }
    }

    public generateShareCardSvg(params: GenerateShareCardParams): string {
        /*_ GEMINI THINKING _*/
        const safeNickname = this.escapeXml(params.nickname)
        const safeTierLabel = this.escapeXml(params.tierLabel)
        const modeLabel = params.mode === '3p' ? '3인마 (3P)' : '4인마 (4P)'

        const winRatePercent = params.winRate > 1 ? params.winRate : params.winRate * 100
        const dealInRatePercent = params.dealInRate > 1 ? params.dealInRate : params.dealInRate * 100

        const formattedLuck = params.luckScore.toFixed(1)
        const formattedSkill = params.skillScore.toFixed(1)
        const formattedWinRate = winRatePercent.toFixed(1)
        const formattedDealInRate = dealInRatePercent.toFixed(1)

        let quadrantTitle = '실력 &amp; 운의 조화로운 승리'
        let quadrantBadge = 'SKILLFUL_WIN'
        let quadrantDesc = '탁월한 타패 효율과 행운이 빚어낸 이상적인 대국'
        let quadrantColor = '#10B981'
        let quadrantBg = '#064e3b'

        const q = params.quadrant.toUpperCase()
        if (q.includes('UNLUCKY') || q === 'UNLUCKY_LOSS') {
            quadrantTitle = '억까 패배 (멘탈 케어)'
            quadrantBadge = 'UNLUCKY_LOSS'
            quadrantDesc = '타패 선택은 올바랐습니다. 억까에 흔들리지 마세요!'
            quadrantColor = '#3B82F6'
            quadrantBg = '#1e3a8a'
        } else if (q.includes('SLUMP') || q === 'SLUMP_LOSS') {
            quadrantTitle = '슬럼프 / 틸트 경고'
            quadrantBadge = 'SLUMP_LOSS'
            quadrantDesc = '타패 실수와 방총이 누적되었습니다. 잠시 휴식을 추천합니다.'
            quadrantColor = '#EF4444'
            quadrantBg = '#7f1d1d'
        } else if (q.includes('FLUKE') || q === 'LUCKY_FLUKE') {
            quadrantTitle = '운빨 승리 (복기 추천)'
            quadrantBadge = 'LUCKY_FLUKE'
            quadrantDesc = '도라와 쯔모운으로 승리했으나 위험한 실수가 있었습니다.'
            quadrantColor = '#F59E0B'
            quadrantBg = '#78350f'
        }

        const clampedLuck = Math.max(0, Math.min(100, params.luckScore))
        const clampedSkill = Math.max(0, Math.min(100, params.skillScore))

        const chartX = 60
        const chartY = 150
        const chartWidth = 480
        const chartHeight = 420

        const dotX = chartX + (clampedLuck / 100) * chartWidth
        const dotY = chartY + (1 - clampedSkill / 100) * chartHeight

        const luckBarWidth = Math.round((clampedLuck / 100) * 195)
        const skillBarWidth = Math.round((clampedSkill / 100) * 195)

        const isQ1 = quadrantBadge === 'SKILLFUL_WIN'
        const isQ2 = quadrantBadge === 'UNLUCKY_LOSS'
        const isQ3 = quadrantBadge === 'SLUMP_LOSS'
        const isQ4 = quadrantBadge === 'LUCKY_FLUKE'

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
    <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0a0f1d" />
            <stop offset="50%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#182234" />
        </linearGradient>
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1e293b" stop-opacity="0.9" />
            <stop offset="100%" stop-color="#0f172a" stop-opacity="0.9" />
        </linearGradient>
        <linearGradient id="luckGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#6366f1" />
            <stop offset="100%" stop-color="#a855f7" />
        </linearGradient>
        <linearGradient id="skillGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#06b6d4" />
            <stop offset="100%" stop-color="#3b82f6" />
        </linearGradient>
        <radialGradient id="dotPulse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${quadrantColor}" stop-opacity="0.8" />
            <stop offset="100%" stop-color="${quadrantColor}" stop-opacity="0" />
        </radialGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
    </defs>

    <rect width="1200" height="630" fill="url(#bgGrad)" />

    <!-- Top Navigation / Brand Header -->
    <g transform="translate(60, 42)">
        <text x="0" y="32" fill="#38bdf8" font-size="28" font-weight="900" font-family="system-ui, -apple-system, sans-serif" letter-spacing="2">MAHJONG SENSEI</text>
        <text x="0" y="60" fill="#94a3b8" font-size="14" font-weight="500" font-family="system-ui, -apple-system, sans-serif">작혼 운/실력 과학적 분리 분석 리포트</text>
    </g>

    <!-- Player Information Badges -->
    <g transform="translate(1140, 52)">
        <g transform="translate(-400, 0)">
            <rect x="0" y="0" width="400" height="54" rx="27" fill="#1e293b" stroke="#334155" stroke-width="1.5" />
            <text x="24" y="34" fill="#ffffff" font-size="20" font-weight="700" font-family="system-ui, -apple-system, sans-serif">${safeNickname}</text>
            <rect x="230" y="12" width="70" height="30" rx="15" fill="#334155" />
            <text x="265" y="32" text-anchor="middle" fill="#38bdf8" font-size="13" font-weight="700" font-family="system-ui, -apple-system, sans-serif">${modeLabel}</text>
            <rect x="306" y="12" width="80" height="30" rx="15" fill="#3b82f6" />
            <text x="346" y="32" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="700" font-family="system-ui, -apple-system, sans-serif">${safeTierLabel}</text>
        </g>
    </g>

    <!-- Left: 4-Quadrant Visual Grid -->
    <g id="quadrant-chart">
        <rect x="60" y="150" width="480" height="420" rx="16" fill="#0d1424" stroke="#1e293b" stroke-width="2" />
        
        <!-- Quadrant Highlights -->
        <rect x="60" y="150" width="240" height="210" fill="${isQ2 ? '#3b82f6' : '#1e293b'}" fill-opacity="${isQ2 ? '0.18' : '0.04'}" />
        <rect x="300" y="150" width="240" height="210" fill="${isQ1 ? '#10b981' : '#1e293b'}" fill-opacity="${isQ1 ? '0.18' : '0.04'}" />
        <rect x="60" y="360" width="240" height="210" fill="${isQ3 ? '#ef4444' : '#1e293b'}" fill-opacity="${isQ3 ? '0.18' : '0.04'}" />
        <rect x="300" y="360" width="240" height="210" fill="${isQ4 ? '#f59e0b' : '#1e293b'}" fill-opacity="${isQ4 ? '0.18' : '0.04'}" />

        <!-- Dividing Grid Axes -->
        <line x1="300" y1="150" x2="300" y2="570" stroke="#334155" stroke-width="2" stroke-dasharray="6,6" />
        <line x1="60" y1="360" x2="540" y2="360" stroke="#334155" stroke-width="2" stroke-dasharray="6,6" />

        <!-- Quadrant Labels -->
        <text x="80" y="185" fill="${isQ2 ? '#60a5fa' : '#64748b'}" font-size="13" font-weight="700" font-family="system-ui, -apple-system, sans-serif">2사분면: 억까 패배</text>
        <text x="520" y="185" text-anchor="end" fill="${isQ1 ? '#34d399' : '#64748b'}" font-size="13" font-weight="700" font-family="system-ui, -apple-system, sans-serif">1사분면: 실력 승리</text>
        <text x="80" y="545" fill="${isQ3 ? '#f87171' : '#64748b'}" font-size="13" font-weight="700" font-family="system-ui, -apple-system, sans-serif">3사분면: 슬럼프</text>
        <text x="520" y="545" text-anchor="end" fill="${isQ4 ? '#fbbf24' : '#64748b'}" font-size="13" font-weight="700" font-family="system-ui, -apple-system, sans-serif">4사분면: 운빨 승리</text>

        <!-- Axis Titles -->
        <text x="300" y="172" text-anchor="middle" fill="#94a3b8" font-size="12" font-weight="600" font-family="system-ui, -apple-system, sans-serif">▲ 실력 점수 (Skill)</text>
        <text x="500" y="352" text-anchor="end" fill="#94a3b8" font-size="12" font-weight="600" font-family="system-ui, -apple-system, sans-serif">운 점수 (Luck) ▶</text>

        <!-- Player Location Marker -->
        <circle cx="${dotX}" cy="${dotY}" r="22" fill="url(#dotPulse)" />
        <circle cx="${dotX}" cy="${dotY}" r="9" fill="${quadrantColor}" stroke="#ffffff" stroke-width="3" filter="url(#glow)" />
        <text x="${dotX}" y="${dotY - 16}" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="800" font-family="system-ui, -apple-system, sans-serif">(${formattedLuck}, ${formattedSkill})</text>
    </g>

    <!-- Right: Stats Panel & Diagnosis -->
    <g id="stats-panel" transform="translate(580, 150)">
        <rect x="0" y="0" width="560" height="420" rx="16" fill="url(#cardGrad)" stroke="#1e293b" stroke-width="2" />

        <!-- Quadrant Diagnosis Banner -->
        <rect x="30" y="25" width="500" height="95" rx="12" fill="${quadrantBg}" fill-opacity="0.35" stroke="${quadrantColor}" stroke-width="1.5" />
        <text x="50" y="55" fill="${quadrantColor}" font-size="13" font-weight="800" font-family="system-ui, -apple-system, sans-serif" letter-spacing="1">${quadrantBadge}</text>
        <text x="50" y="82" fill="#ffffff" font-size="20" font-weight="700" font-family="system-ui, -apple-system, sans-serif">${quadrantTitle}</text>
        <text x="50" y="104" fill="#cbd5e1" font-size="13" font-weight="400" font-family="system-ui, -apple-system, sans-serif">${quadrantDesc}</text>

        <!-- Metric Box 1: Luck Score -->
        <rect x="30" y="145" width="235" height="110" rx="12" fill="#131c2e" stroke="#334155" stroke-width="1" />
        <text x="48" y="174" fill="#94a3b8" font-size="13" font-weight="600" font-family="system-ui, -apple-system, sans-serif">운 점수 (Luck Score)</text>
        <text x="48" y="212" fill="#ffffff" font-size="30" font-weight="800" font-family="system-ui, -apple-system, sans-serif">${formattedLuck} <tspan fill="#64748b" font-size="16" font-weight="500">/ 100</tspan></text>
        <rect x="48" y="228" width="195" height="8" rx="4" fill="#1e293b" />
        <rect x="48" y="228" width="${luckBarWidth}" height="8" rx="4" fill="url(#luckGrad)" />

        <!-- Metric Box 2: Skill Score -->
        <rect x="295" y="145" width="235" height="110" rx="12" fill="#131c2e" stroke="#334155" stroke-width="1" />
        <text x="313" y="174" fill="#94a3b8" font-size="13" font-weight="600" font-family="system-ui, -apple-system, sans-serif">실력 점수 (Skill Score)</text>
        <text x="313" y="212" fill="#ffffff" font-size="30" font-weight="800" font-family="system-ui, -apple-system, sans-serif">${formattedSkill} <tspan fill="#64748b" font-size="16" font-weight="500">/ 100</tspan></text>
        <rect x="313" y="228" width="195" height="8" rx="4" fill="#1e293b" />
        <rect x="313" y="228" width="${skillBarWidth}" height="8" rx="4" fill="url(#skillGrad)" />

        <!-- Metric Box 3: Win Rate -->
        <rect x="30" y="275" width="235" height="105" rx="12" fill="#131c2e" stroke="#334155" stroke-width="1" />
        <text x="48" y="304" fill="#94a3b8" font-size="13" font-weight="600" font-family="system-ui, -apple-system, sans-serif">화료율 (Win Rate)</text>
        <text x="48" y="344" fill="#38bdf8" font-size="30" font-weight="800" font-family="system-ui, -apple-system, sans-serif">${formattedWinRate}%</text>
        <text x="48" y="365" fill="#64748b" font-size="12" font-weight="500" font-family="system-ui, -apple-system, sans-serif">대국 화료 빈도</text>

        <!-- Metric Box 4: Deal-In Rate -->
        <rect x="295" y="275" width="235" height="105" rx="12" fill="#131c2e" stroke="#334155" stroke-width="1" />
        <text x="313" y="304" fill="#94a3b8" font-size="13" font-weight="600" font-family="system-ui, -apple-system, sans-serif">방총률 (Deal-In Rate)</text>
        <text x="313" y="344" fill="#f43f5e" font-size="30" font-weight="800" font-family="system-ui, -apple-system, sans-serif">${formattedDealInRate}%</text>
        <text x="313" y="365" fill="#64748b" font-size="12" font-weight="500" font-family="system-ui, -apple-system, sans-serif">위험패 실점 빈도</text>
    </g>

    <!-- Footer Credit -->
    <text x="600" y="605" text-anchor="middle" fill="#64748b" font-size="13" font-weight="500" font-family="system-ui, -apple-system, sans-serif">Powered by Mahjong Sensei Engine • https://mahjong-sensei.app</text>
</svg>`
    }

    protected resolveTierKey(tier: string): TierKey {
        /*_ GEMINI THINKING _*/
        const normalized = tier.trim().toUpperCase()
        if (normalized === 'NOVICE_ADEPT' || normalized === 'ADEPT' || normalized === 'NOVICE' || normalized.includes('작사')) {
            return 'NOVICE_ADEPT'
        }
        if (normalized === 'EXPERT' || normalized.includes('작걸')) {
            return 'EXPERT'
        }
        if (normalized === 'MASTER' || normalized.includes('작호')) {
            return 'MASTER'
        }
        if (normalized === 'SAINT' || normalized.includes('작성')) {
            return 'SAINT'
        }
        return 'EXPERT'
    }

    protected normalCdf(z: number): number {
        /*_ GEMINI THINKING _*/
        const sign = z < 0 ? -1 : 1
        const x = Math.abs(z) / Math.SQRT2
        const a1 = 0.254829592
        const a2 = -0.284496736
        const a3 = 1.421413741
        const a4 = -1.453152027
        const a5 = 1.061405429
        const p = 0.3275911

        const t = 1 / (1 + p * x)
        const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
        const erf = sign * y
        return 0.5 * (1 + erf)
    }

    protected calculatePercentile(value: number, mean: number, stdDev: number): number {
        /*_ GEMINI THINKING _*/
        if (stdDev <= 0) {
            return value >= mean ? 100 : 0
        }
        const z = (value - mean) / stdDev
        const cdf = this.normalCdf(z)
        const percentile = Math.round(cdf * 1000) / 10
        return Math.max(0.1, Math.min(99.9, percentile))
    }

    protected escapeXml(unsafe: string): string {
        /*_ GEMINI THINKING _*/
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
    }
}
