'use client'

/*_ GEMINI THINKING _*/
import React, { useState, useMemo, useEffect, useRef } from 'react'
import {
    GameMode,
    PerformanceQuadrant,
    TierKey,
    TierBenchmarkDistribution
} from '@mahjong-sensei/types'
import {
    TIER_BENCHMARKS,
    resolveTierKey,
    calculatePercentile,
    generateShareCardSvg
} from '@mahjong-sensei/mahjong-core'
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

export type { TierKey }
export type TierBenchmarkData = TierBenchmarkDistribution

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

export function TierBenchmarkShareCard({
    nickname = '마작선수',
    mode = '4p',
    luckScore = 58.4,
    skillScore = 72.8,
    winRate = 24.5,
    dealInRate = 11.2,
    quadrant = 'SKILLFUL_WIN',
    currentTier = '작호',
    apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
}: TierBenchmarkShareCardProps): React.ReactElement {
    /*_ GEMINI THINKING _*/
    const initialTierKey = useMemo(() => resolveTierKey(currentTier), [currentTier])
    const [selectedTier, setSelectedTier] = useState<TierKey>(initialTierKey)
    const [copiedStatus, setCopiedStatus] = useState<string>('')
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        setSelectedTier(initialTierKey)
    }, [initialTierKey, mode])

    useEffect(() => {
        return () => {
            if (toastTimeoutRef.current !== null) {
                clearTimeout(toastTimeoutRef.current)
            }
        }
    }, [])

    const showToast = (message: string): void => {
        if (toastTimeoutRef.current !== null) {
            clearTimeout(toastTimeoutRef.current)
        }
        setCopiedStatus(message)
        toastTimeoutRef.current = setTimeout(() => {
            setCopiedStatus('')
            toastTimeoutRef.current = null
        }, 3000)
    }

    const activeBenchmarks = TIER_BENCHMARKS[mode]
    const benchmark = activeBenchmarks[selectedTier]

    const playerWinRatePercent = winRate
    const playerDealInRatePercent = dealInRate

    const benchmarkWinRatePercent = benchmark.avgWinRate * 100
    const benchmarkDealInRatePercent = benchmark.avgDealInRate * 100

    const luckDelta = Math.round((luckScore - benchmark.avgLuckScore) * 10) / 10
    const skillDelta = Math.round((skillScore - benchmark.avgSkillScore) * 10) / 10
    const winRateDelta = Math.round((playerWinRatePercent - benchmarkWinRatePercent) * 10) / 10
    const dealInDelta = Math.round((playerDealInRatePercent - benchmarkDealInRatePercent) * 10) / 10

    const luckPercentile = calculatePercentile(luckScore, benchmark.avgLuckScore, benchmark.luckStdDev)
    const skillPercentile = calculatePercentile(skillScore, benchmark.avgSkillScore, benchmark.skillStdDev)

    const clampedLuck = Math.max(0, Math.min(100, luckScore))
    const clampedSkill = Math.max(0, Math.min(100, skillScore))

    const quadrantUpper = (quadrant ?? '').trim().toUpperCase()
    const resolvedQuadrant: PerformanceQuadrant =
        quadrantUpper.includes('UNLUCKY') || quadrantUpper === 'UNLUCKY_LOSS'
            ? 'UNLUCKY_LOSS'
            : quadrantUpper.includes('SLUMP') || quadrantUpper === 'SLUMP_LOSS'
              ? 'SLUMP_LOSS'
              : quadrantUpper.includes('FLUKE') || quadrantUpper === 'LUCKY_FLUKE'
                ? 'LUCKY_FLUKE'
                : quadrantUpper.includes('SKILLFUL') || quadrantUpper === 'SKILLFUL_WIN'
                  ? 'SKILLFUL_WIN'
                  : clampedSkill >= 50
                    ? clampedLuck >= 50
                        ? 'SKILLFUL_WIN'
                        : 'UNLUCKY_LOSS'
                    : clampedLuck >= 50
                      ? 'LUCKY_FLUKE'
                      : 'SLUMP_LOSS'

    const quadrantBadgeText = resolvedQuadrant

    const shareCardUrl = `${apiUrl}/analysis/share-card?nickname=${encodeURIComponent(nickname)}&mode=${mode}&tierLabel=${encodeURIComponent(benchmark.tierLabel)}&luckScore=${luckScore}&skillScore=${skillScore}&winRate=${playerWinRatePercent.toFixed(1)}&dealInRate=${playerDealInRatePercent.toFixed(1)}&quadrant=${quadrantBadgeText}`

    const buildFullSvg = (): string => {
        /*_ GEMINI THINKING _*/
        return generateShareCardSvg({
            nickname,
            mode,
            tierLabel: benchmark.tierLabel,
            luckScore,
            skillScore,
            winRate: playerWinRatePercent,
            dealInRate: playerDealInRatePercent,
            quadrant: quadrantBadgeText
        })
    }

    const handleCopySvg = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(buildFullSvg())
            showToast('SVG 코드가 클립보드에 복사되었습니다!')
        } catch {
            showToast('클립보드 접근 권한이 필요합니다.')
        }
    }

    const handleCopyLink = async (): Promise<void> => {
        try {
            await navigator.clipboard.writeText(shareCardUrl)
            showToast('공유 링크가 클립보드에 복사되었습니다!')
        } catch {
            showToast('클립보드 접근 권한이 필요합니다.')
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
        showToast('SVG 카드가 다운로드되었습니다!')
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
