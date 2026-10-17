'use client'

/*_ GEMINI THINKING _*/
import React, { useState, useMemo } from 'react'
import { GameMode, PerformanceQuadrant } from '@mahjong-sensei/types'
import {
    Award,
    Share2,
    Download,
    Copy,
    Check,
    TrendingUp,
    ShieldAlert,
    Sparkles,
    Dice5
} from 'lucide-react'

export type TierKey = 'NOVICE_ADEPT' | 'EXPERT' | 'MASTER' | 'SAINT'

export interface TierBenchmarkData {
    readonly tier: TierKey
    readonly tierLabel: string
    readonly avgLuckScore: number
    readonly luckStdDev: number
    readonly avgSkillScore: number
    readonly skillStdDev: number
    readonly avgDealInRate: number
    readonly avgWinRate: number
    readonly startingShantenBaseline: number
}

export interface TierBenchmarkShareCardProps {
    readonly nickname?: string
    readonly mode?: GameMode
    readonly luckScore?: number
    readonly skillScore?: number
    readonly winRate?: number
    readonly dealInRate?: number
    readonly quadrant?: PerformanceQuadrant | string
    readonly currentTier?: string
    readonly apiUrl?: string
}

const TIER_BENCHMARKS: Readonly<Record<GameMode, Readonly<Record<TierKey, TierBenchmarkData>>>> = {
    '4p': {
        NOVICE_ADEPT: {
            tier: 'NOVICE_ADEPT',
            tierLabel: '작사 (Adept)',
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

const resolveTierKey = (tier: string): TierKey => {
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

const normalCdf = (z: number): number => {
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

const calculatePercentile = (value: number, mean: number, stdDev: number): number => {
    /*_ GEMINI THINKING _*/
    if (stdDev <= 0) {
        return value >= mean ? 100 : 0
    }
    const z = (value - mean) / stdDev
    const cdf = normalCdf(z)
    const pct = Math.round(cdf * 1000) / 10
    return Math.max(0.1, Math.min(99.9, pct))
}

const escapeXml = (unsafe: string): string => {
    /*_ GEMINI THINKING _*/
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

export function TierBenchmarkShareCard({
    nickname = '마작선수',
    mode = '4p',
    luckScore = 58.4,
    skillScore = 72.8,
    winRate = 0.245,
    dealInRate = 0.112,
    quadrant = 'SKILLFUL_WIN',
    currentTier = '작호',
    apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
}: TierBenchmarkShareCardProps): React.ReactElement {
    /*_ GEMINI THINKING _*/
    const initialTierKey = useMemo(() => resolveTierKey(currentTier), [currentTier])
    const [selectedTier, setSelectedTier] = useState<TierKey>(initialTierKey)
    const [copiedStatus, setCopiedStatus] = useState<string>('')

    const activeBenchmarks = TIER_BENCHMARKS[mode]
    const benchmark = activeBenchmarks[selectedTier]

    const playerWinRatePercent = winRate > 1 ? winRate : winRate * 100
    const playerDealInRatePercent = dealInRate > 1 ? dealInRate : dealInRate * 100

    const benchmarkWinRatePercent = benchmark.avgWinRate * 100
    const benchmarkDealInRatePercent = benchmark.avgDealInRate * 100

    const luckDelta = Math.round((luckScore - benchmark.avgLuckScore) * 10) / 10
    const skillDelta = Math.round((skillScore - benchmark.avgSkillScore) * 10) / 10
    const winRateDelta = Math.round((playerWinRatePercent - benchmarkWinRatePercent) * 10) / 10
    const dealInDelta = Math.round((playerDealInRatePercent - benchmarkDealInRatePercent) * 10) / 10

    const luckPercentile = calculatePercentile(luckScore, benchmark.avgLuckScore, benchmark.luckStdDev)
    const skillPercentile = calculatePercentile(skillScore, benchmark.avgSkillScore, benchmark.skillStdDev)

    // Quadrant theme & copy
    const quadrantUpper = quadrant.toUpperCase()
    const isQ1 = quadrantUpper.includes('SKILLFUL') || quadrantUpper === 'SKILLFUL_WIN'
    const isQ2 = quadrantUpper.includes('UNLUCKY') || quadrantUpper === 'UNLUCKY_LOSS'
    const isQ3 = quadrantUpper.includes('SLUMP') || quadrantUpper === 'SLUMP_LOSS'
    const isQ4 = quadrantUpper.includes('FLUKE') || quadrantUpper === 'LUCKY_FLUKE'

    let quadrantColor = '#10B981'
    let quadrantBadgeText = 'SKILLFUL_WIN'
    let quadrantTitle = '실력 & 운의 조화로운 승리'
    let quadrantDesc = '탁월한 타패 효율과 행운이 빚어낸 이상적인 대국'

    if (isQ2) {
        quadrantColor = '#3B82F6'
        quadrantBadgeText = 'UNLUCKY_LOSS'
        quadrantTitle = '억까 패배 (멘탈 케어)'
        quadrantDesc = '타패 선택은 올바랐습니다. 억까에 흔들리지 마세요!'
    } else if (isQ3) {
        quadrantColor = '#EF4444'
        quadrantBadgeText = 'SLUMP_LOSS'
        quadrantTitle = '슬럼프 / 틸트 경고'
        quadrantDesc = '타패 실수와 방총이 누적되었습니다. 잠시 휴식을 추천합니다.'
    } else if (isQ4) {
        quadrantColor = '#F59E0B'
        quadrantBadgeText = 'LUCKY_FLUKE'
        quadrantTitle = '운빨 승리 (복기 추천)'
        quadrantDesc = '도라와 쯔모운으로 승리했으나 위험한 실수가 있었습니다.'
    }

    const clampedLuck = Math.max(0, Math.min(100, luckScore))
    const clampedSkill = Math.max(0, Math.min(100, skillScore))

    const shareCardUrl = `${apiUrl}/analysis/share-card?nickname=${encodeURIComponent(nickname)}&mode=${mode}&tierLabel=${encodeURIComponent(benchmark.tierLabel)}&luckScore=${luckScore}&skillScore=${skillScore}&winRate=${(playerWinRatePercent / 100).toFixed(4)}&dealInRate=${(playerDealInRatePercent / 100).toFixed(4)}&quadrant=${quadrantBadgeText}`

    const buildFullSvg = (): string => {
        /*_ GEMINI THINKING _*/
        const safeNickname = escapeXml(nickname)
        const safeTierLabel = escapeXml(benchmark.tierLabel)
        const modeLabel = mode === '3p' ? '3인마 (3P)' : '4인마 (4P)'

        const formattedLuck = luckScore.toFixed(1)
        const formattedSkill = skillScore.toFixed(1)
        const formattedWinRate = playerWinRatePercent.toFixed(1)
        const formattedDealInRate = playerDealInRatePercent.toFixed(1)

        const chartX = 60
        const chartY = 150
        const chartWidth = 480
        const chartHeight = 420

        const dotX = chartX + (clampedLuck / 100) * chartWidth
        const dotY = chartY + (1 - clampedSkill / 100) * chartHeight

        const luckBarWidth = Math.round((clampedLuck / 100) * 195)
        const skillBarWidth = Math.round((clampedSkill / 100) * 195)

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
    </defs>
    <rect width="1200" height="630" fill="url(#bgGrad)" />
    <g transform="translate(60, 42)">
        <text x="0" y="32" fill="#38bdf8" font-size="28" font-weight="900" font-family="system-ui, sans-serif" letter-spacing="2">MAHJONG SENSEI</text>
        <text x="0" y="60" fill="#94a3b8" font-size="14" font-weight="500" font-family="system-ui, sans-serif">작혼 운/실력 과학적 분리 분석 리포트</text>
    </g>
    <g transform="translate(1140, 52)">
        <g transform="translate(-400, 0)">
            <rect x="0" y="0" width="400" height="54" rx="27" fill="#1e293b" stroke="#334155" stroke-width="1.5" />
            <text x="24" y="34" fill="#ffffff" font-size="20" font-weight="700" font-family="system-ui, sans-serif">${safeNickname}</text>
            <rect x="230" y="12" width="70" height="30" rx="15" fill="#334155" />
            <text x="265" y="32" text-anchor="middle" fill="#38bdf8" font-size="13" font-weight="700" font-family="system-ui, sans-serif">${modeLabel}</text>
            <rect x="306" y="12" width="80" height="30" rx="15" fill="#3b82f6" />
            <text x="346" y="32" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="700" font-family="system-ui, sans-serif">${safeTierLabel}</text>
        </g>
    </g>
    <g id="quadrant-chart">
        <rect x="60" y="150" width="480" height="420" rx="16" fill="#0d1424" stroke="#1e293b" stroke-width="2" />
        <rect x="60" y="150" width="240" height="210" fill="${isQ2 ? '#3b82f6' : '#1e293b'}" fill-opacity="${isQ2 ? '0.18' : '0.04'}" />
        <rect x="300" y="150" width="240" height="210" fill="${isQ1 ? '#10b981' : '#1e293b'}" fill-opacity="${isQ1 ? '0.18' : '0.04'}" />
        <rect x="60" y="360" width="240" height="210" fill="${isQ3 ? '#ef4444' : '#1e293b'}" fill-opacity="${isQ3 ? '0.18' : '0.04'}" />
        <rect x="300" y="360" width="240" height="210" fill="${isQ4 ? '#f59e0b' : '#1e293b'}" fill-opacity="${isQ4 ? '0.18' : '0.04'}" />
        <line x1="300" y1="150" x2="300" y2="570" stroke="#334155" stroke-width="2" stroke-dasharray="6,6" />
        <line x1="60" y1="360" x2="540" y2="360" stroke="#334155" stroke-width="2" stroke-dasharray="6,6" />
        <text x="80" y="185" fill="${isQ2 ? '#60a5fa' : '#64748b'}" font-size="13" font-weight="700" font-family="system-ui, sans-serif">2사분면: 억까 패배</text>
        <text x="520" y="185" text-anchor="end" fill="${isQ1 ? '#34d399' : '#64748b'}" font-size="13" font-weight="700" font-family="system-ui, sans-serif">1사분면: 실력 승리</text>
        <text x="80" y="545" fill="${isQ3 ? '#f87171' : '#64748b'}" font-size="13" font-weight="700" font-family="system-ui, sans-serif">3사분면: 슬럼프</text>
        <text x="520" y="545" text-anchor="end" fill="${isQ4 ? '#fbbf24' : '#64748b'}" font-size="13" font-weight="700" font-family="system-ui, sans-serif">4사분면: 운빨 승리</text>
        <circle cx="${dotX}" cy="${dotY}" r="9" fill="${quadrantColor}" stroke="#ffffff" stroke-width="3" />
        <text x="${dotX}" y="${dotY - 16}" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="800" font-family="system-ui, sans-serif">(${formattedLuck}, ${formattedSkill})</text>
    </g>
    <g id="stats-panel" transform="translate(580, 150)">
        <rect x="0" y="0" width="560" height="420" rx="16" fill="url(#cardGrad)" stroke="#1e293b" stroke-width="2" />
        <rect x="30" y="25" width="500" height="95" rx="12" fill="#1e293b" stroke="${quadrantColor}" stroke-width="1.5" />
        <text x="50" y="55" fill="${quadrantColor}" font-size="13" font-weight="800" font-family="system-ui, sans-serif">${quadrantBadgeText}</text>
        <text x="50" y="82" fill="#ffffff" font-size="20" font-weight="700" font-family="system-ui, sans-serif">${quadrantTitle}</text>
        <text x="50" y="104" fill="#cbd5e1" font-size="13" font-weight="400" font-family="system-ui, sans-serif">${quadrantDesc}</text>
        <rect x="30" y="145" width="235" height="110" rx="12" fill="#131c2e" stroke="#334155" stroke-width="1" />
        <text x="48" y="174" fill="#94a3b8" font-size="13" font-weight="600" font-family="system-ui, sans-serif">운 점수 (Luck)</text>
        <text x="48" y="212" fill="#ffffff" font-size="30" font-weight="800" font-family="system-ui, sans-serif">${formattedLuck}</text>
        <rect x="48" y="228" width="195" height="8" rx="4" fill="#1e293b" />
        <rect x="48" y="228" width="${luckBarWidth}" height="8" rx="4" fill="url(#luckGrad)" />
        <rect x="295" y="145" width="235" height="110" rx="12" fill="#131c2e" stroke="#334155" stroke-width="1" />
        <text x="313" y="174" fill="#94a3b8" font-size="13" font-weight="600" font-family="system-ui, sans-serif">실력 점수 (Skill)</text>
        <text x="313" y="212" fill="#ffffff" font-size="30" font-weight="800" font-family="system-ui, sans-serif">${formattedSkill}</text>
        <rect x="313" y="228" width="195" height="8" rx="4" fill="#1e293b" />
        <rect x="313" y="228" width="${skillBarWidth}" height="8" rx="4" fill="url(#skillGrad)" />
        <rect x="30" y="275" width="235" height="105" rx="12" fill="#131c2e" stroke="#334155" stroke-width="1" />
        <text x="48" y="304" fill="#94a3b8" font-size="13" font-weight="600" font-family="system-ui, sans-serif">화료율</text>
        <text x="48" y="344" fill="#38bdf8" font-size="30" font-weight="800" font-family="system-ui, sans-serif">${formattedWinRate}%</text>
        <rect x="295" y="275" width="235" height="105" rx="12" fill="#131c2e" stroke="#334155" stroke-width="1" />
        <text x="313" y="304" fill="#94a3b8" font-size="13" font-weight="600" font-family="system-ui, sans-serif">방총률</text>
        <text x="313" y="344" fill="#f43f5e" font-size="30" font-weight="800" font-family="system-ui, sans-serif">${formattedDealInRate}%</text>
    </g>
    <text x="600" y="605" text-anchor="middle" fill="#64748b" font-size="13" font-family="system-ui, sans-serif">Powered by Mahjong Sensei Engine</text>
</svg>`
    }

    const handleCopySvg = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(buildFullSvg())
            setCopiedStatus('SVG 코드가 클립보드에 복사되었습니다!')
            setTimeout(() => setCopiedStatus(''), 3000)
        } catch {
            setCopiedStatus('클립보드 접근 권한이 필요합니다.')
        }
    }

    const handleCopyLink = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(shareCardUrl)
            setCopiedStatus('공유 링크가 클립보드에 복사되었습니다!')
            setTimeout(() => setCopiedStatus(''), 3000)
        } catch {
            setCopiedStatus('클립보드 접근 권한이 필요합니다.')
        }
    }

    const handleDownloadSvg = (): void => {
        const svgContent = buildFullSvg()
        const blob = new Blob([svgContent], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${nickname}_mahjong_sensei_card.svg`
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        URL.revokeObjectURL(url)
        setCopiedStatus('SVG 카드가 다운로드되었습니다!')
        setTimeout(() => setCopiedStatus(''), 3000)
    }

    const tierKeys: readonly TierKey[] = ['NOVICE_ADEPT', 'EXPERT', 'MASTER', 'SAINT']

    return (
        <div className="w-full space-y-6">
            {/* Header & Tier Comparison Selector */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                    <div>
                        <div className="flex items-center gap-2">
                            <Award className="w-6 h-6 text-amber-400" />
                            <h2 className="text-xl font-bold text-white">작혼 티어별 벤치마크 &amp; 퍼포먼스 분석</h2>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">
                            공식 작혼 탁 티어 평균과 비교하여 유저의 실력과 운, 화료/방총 퍼포먼스를 정밀 진단합니다.
                            (기준 배패 샹텐수: {mode === '3p' ? '3.25' : '3.50'} 샹텐)
                        </p>
                    </div>

                    {/* Tier selector pills */}
                    <div className="flex items-center bg-slate-950 p-1.5 rounded-xl border border-slate-800 self-start md:self-auto">
                        {tierKeys.map((key) => {
                            const isSelected = selectedTier === key
                            const item = activeBenchmarks[key]
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setSelectedTier(key)}
                                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                        isSelected
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                    }`}
                                >
                                    {item.tierLabel}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* 4 Overlay Benchmark Comparison Bars */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    {/* Skill Score Card */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> 실력 점수
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                    skillDelta >= 0 ? 'bg-cyan-500/20 text-cyan-300' : 'bg-rose-500/20 text-rose-300'
                                }`}>
                                    {skillDelta >= 0 ? `+${skillDelta}` : `${skillDelta}`}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-white">{skillScore.toFixed(1)}</span>
                                <span className="text-xs text-slate-400">/ 기준 {benchmark.avgSkillScore.toFixed(1)}</span>
                            </div>
                            <p className="text-xs text-cyan-400 mt-1 font-medium">
                                {benchmark.tierLabel} 기준 상위 {(100 - skillPercentile).toFixed(1)}%
                            </p>
                        </div>
                        {/* Overlay Bar */}
                        <div className="mt-4">
                            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden relative">
                                <div
                                    className="bg-cyan-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, Math.max(0, skillScore))}%` }}
                                />
                                <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-sm"
                                    style={{ left: `${Math.min(100, Math.max(0, benchmark.avgSkillScore))}%` }}
                                    title={`티어 평균: ${benchmark.avgSkillScore}`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Luck Score Card */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                                    <Dice5 className="w-3.5 h-3.5 text-purple-400" /> 운 점수
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                    luckDelta >= 0 ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-700 text-slate-300'
                                }`}>
                                    {luckDelta >= 0 ? `+${luckDelta}` : `${luckDelta}`}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-white">{luckScore.toFixed(1)}</span>
                                <span className="text-xs text-slate-400">/ 기준 {benchmark.avgLuckScore.toFixed(1)}</span>
                            </div>
                            <p className="text-xs text-purple-400 mt-1 font-medium">
                                {benchmark.tierLabel} 기준 상위 {(100 - luckPercentile).toFixed(1)}%
                            </p>
                        </div>
                        {/* Overlay Bar */}
                        <div className="mt-4">
                            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden relative">
                                <div
                                    className="bg-purple-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, Math.max(0, luckScore))}%` }}
                                />
                                <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-sm"
                                    style={{ left: `${Math.min(100, Math.max(0, benchmark.avgLuckScore))}%` }}
                                    title={`티어 평균: ${benchmark.avgLuckScore}`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Win Rate Card */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                                    <TrendingUp className="w-3.5 h-3.5 text-blue-400" /> 화료율 (Win Rate)
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                    winRateDelta >= 0 ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-300'
                                }`}>
                                    {winRateDelta >= 0 ? `+${winRateDelta}%` : `${winRateDelta}%`}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-white">{playerWinRatePercent.toFixed(1)}%</span>
                                <span className="text-xs text-slate-400">/ 기준 {benchmarkWinRatePercent.toFixed(1)}%</span>
                            </div>
                            <p className="text-xs text-blue-400 mt-1 font-medium">
                                {winRateDelta >= 0 ? '화료 빈도 우수' : '공격력 보강 추천'}
                            </p>
                        </div>
                        {/* Overlay Bar */}
                        <div className="mt-4">
                            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden relative">
                                <div
                                    className="bg-blue-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, (playerWinRatePercent / 45) * 100)}%` }}
                                />
                                <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-sm"
                                    style={{ left: `${Math.min(100, (benchmarkWinRatePercent / 45) * 100)}%` }}
                                    title={`티어 평균: ${benchmarkWinRatePercent.toFixed(1)}%`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Deal-In Rate Card */}
                    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> 방총률 (Deal-In)
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                    dealInDelta <= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                                }`}>
                                    {dealInDelta <= 0 ? `${dealInDelta}% (수비 우수)` : `+${dealInDelta}% (방총 주의)`}
                                </span>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-white">{playerDealInRatePercent.toFixed(1)}%</span>
                                <span className="text-xs text-slate-400">/ 기준 {benchmarkDealInRatePercent.toFixed(1)}%</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1 font-medium">
                                {dealInDelta <= 0 ? '안정적인 수비력 유지 중' : '위험패 억제 및 내리기 필요'}
                            </p>
                        </div>
                        {/* Overlay Bar */}
                        <div className="mt-4">
                            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden relative">
                                <div
                                    className="bg-rose-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, (playerDealInRatePercent / 30) * 100)}%` }}
                                />
                                <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-sm"
                                    style={{ left: `${Math.min(100, (benchmarkDealInRatePercent / 30) * 100)}%` }}
                                    title={`티어 평균: ${benchmarkDealInRatePercent.toFixed(1)}%`}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SNS Share Card Preview Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Share2 className="w-5 h-5 text-blue-400" />
                            <h3 className="text-lg font-bold text-white">4사분면 퍼포먼스 SNS 공유 카드 미리보기</h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Twitter/X, Discord, 블로그에 공유 가능한 1200x630 고해상도 OpenGraph 벡터 카드입니다.
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => void handleCopySvg()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-700"
                        >
                            <Copy className="w-3.5 h-3.5" /> SVG 복사
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadSvg}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-700"
                        >
                            <Download className="w-3.5 h-3.5" /> SVG 다운로드
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleCopyLink()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors shadow"
                        >
                            <Share2 className="w-3.5 h-3.5" /> 공유 링크 복사
                        </button>
                    </div>
                </div>

                {/* Status toast message */}
                {copiedStatus ? (
                    <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-xs font-semibold animate-in fade-in">
                        <Check className="w-4 h-4 text-emerald-400" /> {copiedStatus}
                    </div>
                ) : null}

                {/* Visual Card Preview */}
                <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-[#0a0f1d] shadow-2xl aspect-[1200/630] max-h-[500px] flex items-center justify-center p-2">
                    <div
                        className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-h-full"
                        dangerouslySetInnerHTML={{ __html: buildFullSvg() }}
                    />
                </div>
            </div>
        </div>
    )
}
