'use client'

import React, { useState, useEffect, useTransition } from 'react'
import {
    GameMode,
    RollingWindowSize,
    RollingWindowStats,
    PerformanceQuadrant,
    GameCoachingReport
} from '@mahjong-sensei/types'
import {
    TrendingUp,
    ShieldAlert,
    Sparkles,
    Dice5,
    PlusCircle,
    RotateCw,
    Award,
    UserCheck,
    Users,
    Flame,
    FileText,
    HelpCircle,
    Clock,
    Share2,
    X,
    Check,
    AlertCircle,
    Eye
} from 'lucide-react'
import { TierBenchmarkShareCard } from '../components/TierBenchmarkShareCard'
import { PaipuRoundInspectorModal } from '../components/PaipuRoundInspectorModal'
import { PaipuBatchModal } from '../components/PaipuBatchModal'


import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ScatterChart,
    Scatter,
    ZAxis,
    ReferenceLine
} from 'recharts'

export default function DashboardPage(): React.ReactElement {
    const [gameMode, setGameMode] = useState<GameMode>('3p')
    const [windowSize, setWindowSize] = useState<RollingWindowSize>(10)
    const [accountId, setAccountId] = useState<number>(120511240)
    const [nickname, setNickname] = useState<string>('서울불빛')
    const [stats, setStats] = useState<RollingWindowStats | null>(null)
    const [paipuInput, setPaipuInput] = useState<string>('')
    const [batchModalOpen, setBatchModalOpen] = useState<boolean>(false)
    const [syncing, setSyncing] = useState<boolean>(false)
    const [importing, setImporting] = useState<boolean>(false)
    const [statusMessage, setStatusMessage] = useState<string>('')
    const [shareCardOpen, setShareCardOpen] = useState<boolean>(false)
    const [coachingGameId, setCoachingGameId] = useState<string | null>(null)
    const [coachingReport, setCoachingReport] = useState<GameCoachingReport | null>(null)
    const [coachingLoading, setCoachingLoading] = useState<boolean>(false)
    const [coachingError, setCoachingError] = useState<string | null>(null)
    const [selectedInspectorGameId, setSelectedInspectorGameId] = useState<string | null>(null)
    const [isMounted, setIsMounted] = useState<boolean>(false)
    const [, startTransition] = useTransition()

    useEffect(() => {
        setIsMounted(true)
    }, [])


    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

    const fetchStats = (accId: number, size: RollingWindowSize, mode: GameMode): void => {
        startTransition(() => {
            fetch(`${apiUrl}/analysis/rolling?accountId=${accId}&window=${size}&mode=${mode}`)
                .then((res) => {
                    if (res.ok) {
                        return res.json() as Promise<RollingWindowStats>
                    }
                    return null
                })
                .then((data) => {
                    if (data && data.totalGames > 0) {
                        setStats(data)
                    }
                })
                .catch(() => {
                    // API error fallback
                })
        })
    }

    const handleSync = async (targetMode: GameMode, targetNickname?: string): Promise<void> => {
        const name = targetNickname ?? nickname
        if (!name.trim()) {
            return
        }

        setSyncing(true)
        setStatusMessage(`작혼 ${targetMode === '3p' ? '3인 마작' : '4인 마작'} 전적 동기화 중... (${name})`)

        try {
            const res = await fetch(`${apiUrl}/sync/player?nickname=${encodeURIComponent(name)}&mode=${targetMode}`, {
                method: 'POST'
            })
            if (res.ok) {
                const data = (await res.json()) as {
                    accountId: number
                    nickname: string
                    totalGames: number
                    avgRank: number
                }
                setAccountId(data.accountId)
                setNickname(data.nickname)
                setStatusMessage(`✅ ${data.nickname} 계정의 ${targetMode === '3p' ? '3인 마작' : '4인 마작'} 실전 대국(${data.totalGames}국) 동기화 완료!`)
                fetchStats(data.accountId, windowSize, targetMode)
            } else {
                setStatusMessage(`⚠️ ${name} 계정의 공개 전적을 찾을 수 없습니다.`)
            }
        } catch {
            setStatusMessage('⚠️ 백엔드 서버에 연결할 수 없습니다.')
        } finally {
            setSyncing(false)
        }
    }

    useEffect(() => {
        handleSync(gameMode, nickname)
    }, [gameMode])

    useEffect(() => {
        if (accountId && !syncing) {
            fetchStats(accountId, windowSize, gameMode)
        }
    }, [windowSize])

    const handleImport = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault()
        if (!paipuInput.trim()) {
            return
        }

        setImporting(true)
        setStatusMessage('패보 수집 및 분석 중...')

        try {
            const res = await fetch(`${apiUrl}/paipu/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urlOrUuid: paipuInput })
            })

            if (res.ok) {
                setStatusMessage('✅ 실제 패보가 성공적으로 분석 및 등록되었습니다!')
                setPaipuInput('')
                fetchStats(accountId, windowSize, gameMode)
            } else {
                setStatusMessage('⚠️ 패보 등록에 실패했습니다. 올바른 링크나 UUID인지 확인해주세요.')
            }
        } catch {
            setStatusMessage('⚠️ 백엔드 API 서버에 연결할 수 없습니다.')
        } finally {
            setImporting(false)
        }
    }


    const handleOpenCoaching = async (gameId: string): Promise<void> => {
        setCoachingGameId(gameId)
        setCoachingLoading(true)
        setCoachingError(null)
        setCoachingReport(null)

        try {
            const res = await fetch(`${apiUrl}/analysis/coaching/${gameId}?accountId=${accountId}`)
            if (res.ok) {
                const data = (await res.json()) as GameCoachingReport
                setCoachingReport(data)
            } else {
                setCoachingError('해당 대국의 코칭 리포트를 불러오지 못했습니다.')
            }
        } catch {
            setCoachingError('백엔드 API 서버와 통신할 수 없습니다.')
        } finally {
            setCoachingLoading(false)
        }
    }

    const getMistakeCategoryBadge = (category: string): { readonly label: string; readonly badgeClass: string } => {
        switch (category) {
            case 'RECKLESS_PUSH_DEAL_IN':
                return {
                    label: '🚨 무리한 승부 (방총 직격)',
                    badgeClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                }
            case 'DANGEROUS_MUSUJI_PUSH':
                return {
                    label: '⚠️ 위험한 무스지 승부 타패',
                    badgeClass: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                }
            case 'UKEIRE_LOSS':
                return {
                    label: '📉 유효패 손실 (조패 비효율)',
                    badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }
            case 'SHANTEN_RETREAT':
                return {
                    label: '↩️ 샹텐수 후퇴 타패',
                    badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                }
            default:
                return {
                    label: category,
                    badgeClass: 'bg-slate-700 text-slate-300 border-slate-600'
                }
        }
    }

    // Default stats fallback tuned by actual recent 50 games from Amae-Koromo

    const currentStats: RollingWindowStats = stats ?? (
        gameMode === '3p'
            ? {
                windowSize,
                gameMode: '3p',
                totalGames: 50,
                averageRank: 2.21,
                topTwoRate: 58.5,
                lastPlaceRate: 41.5,
                negativeRate: 3.7,
                averageLuckScore: 43.5,
                averageSkillScore: 52.0,
                luckTrend: [45, 38, 48, 52, 40, 42, 35, 47, 49, 44],
                rankTrend: [2, 3, 2, 1, 3, 2, 3, 1, 2, 3],
                games: [],
                winRate: 29.3,
                dealInRate: 13.8,
                riichiRate: 25.0,
                furoRate: 23.1,
                damatenRate: 19.2,
                initiativeRate: 81.0,
                uradoraRate: 43.2,
                styleDiagnosis: {
                    title: '카운터 다마텐 & 철벽 수비',
                    description: '다마텐율 19.2%와 선제율 81%로 상대를 침착하게 공략하며, 들통율이 3.7%에 불과합니다.',
                    attackType: '카운터 다마텐',
                    defenseType: '철벽 수비',
                    luckRemark: '도라 편중 호조',
                    skillRemark: '3마 상위 5% 철벽 수비'
                }
            }
            : {
                windowSize,
                gameMode: '4p',
                totalGames: 50,
                averageRank: 2.38,
                topTwoRate: 56.0,
                lastPlaceRate: 20.8,
                negativeRate: 8.7,
                averageLuckScore: 48.5,
                averageSkillScore: 68.0,
                luckTrend: [48, 52, 45, 50, 47, 51, 46, 53, 49, 48],
                rankTrend: [2, 1, 3, 2, 4, 1, 2, 2, 3, 4],
                games: [],
                winRate: 22.0,
                dealInRate: 12.2,
                riichiRate: 22.5,
                furoRate: 27.6,
                damatenRate: 14.5,
                initiativeRate: 85.0,
                uradoraRate: 27.8,
                styleDiagnosis: {
                    title: '단단한 멘젠 선제형',
                    description: '후로율 27.6%와 선제 리치율 85%의 강한 공격력으로 연대율 56%를 견인하고 있습니다.',
                    attackType: '단단한 멘젠 선제',
                    defenseType: '안정 수비',
                    luckRemark: '정직한 승부',
                    skillRemark: '상위 15% 방총 제어'
                }
            }
    )

    const formatTimestamp = (timestamp?: number): string => {
        if (!timestamp) {
            return '-'
        }
        const d = new Date(timestamp)
        return d.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        })
    }

    const chartData = currentStats.luckTrend.map((luck, index) => {
        const game = currentStats.games[currentStats.games.length - 1 - index]
        return {
            gameIndex: index + 1,
            timeStr: game ? formatTimestamp(game.timestamp) : `대국 ${index + 1}`,
            luck,
            rank: currentStats.rankTrend[index] ?? (gameMode === '3p' ? 2 : 2.5)
        }
    })

    const scatterData = currentStats.games.map((g, idx) => ({
        index: idx + 1,
        luck: g.luckScore,
        skill: g.skillScore,
        quadrant: g.quadrant,
        rank: g.rank
    }))

    const totalGamesForQuadrant = currentStats.games.length
    const quadrantCounts: Record<PerformanceQuadrant, number> = {
        SKILLFUL_WIN: 0,
        UNLUCKY_LOSS: 0,
        SLUMP_LOSS: 0,
        LUCKY_FLUKE: 0
    }

    for (const g of currentStats.games) {
        quadrantCounts[g.quadrant] = (quadrantCounts[g.quadrant] ?? 0) + 1
    }

    const getQuadrantRate = (quadrant: PerformanceQuadrant): { count: number; rate: number } => {
        const count = quadrantCounts[quadrant] ?? 0
        const rate = totalGamesForQuadrant > 0 ? Number(((count / totalGamesForQuadrant) * 100).toFixed(1)) : 0
        return { count, rate }
    }

    const getQuadrantBadge = (quadrant: PerformanceQuadrant, rank: number): React.ReactElement => {
        const isTop = rank === 1 || (gameMode === '4p' && rank === 2)
        const isLast = gameMode === '3p' ? rank === 3 : rank === 4

        switch (quadrant) {
            case 'SKILLFUL_WIN':
                if (rank === 1) {
                    return <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400 font-medium">실력 대승 (1위)</span>
                }
                if (isTop) {
                    return <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400 font-medium">실력 선방 (연대)</span>
                }
                return <span className="px-2 py-0.5 rounded text-xs bg-slate-700/50 text-slate-300 font-medium">선전 석패 ({rank}위)</span>
            case 'UNLUCKY_LOSS':
                if (isTop) {
                    return <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-300 font-medium">불운 극복 (선방)</span>
                }
                return <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 font-medium">억까 피해 ({isLast ? '라스' : `${rank}위`})</span>
            case 'SLUMP_LOSS':
                return <span className="px-2 py-0.5 rounded text-xs bg-rose-500/20 text-rose-400 font-medium">실력 난조 ({isLast ? '라스' : `${rank}위`})</span>
            case 'LUCKY_FLUKE':
                if (isTop) {
                    return <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 font-medium">운빨 승리 ({rank}위)</span>
                }
                return <span className="px-2 py-0.5 rounded text-xs bg-indigo-500/20 text-indigo-300 font-medium">운빨 방어 ({rank}위)</span>
        }
    }

    const getAiGradeBadgeClass = (grade: string): string => {
        switch (grade) {
            case 'S+':
                return 'bg-amber-400/20 text-amber-300 border-amber-400/50'
            case 'S':
                return 'bg-amber-500/20 text-amber-400 border-amber-500/40'
            case 'A':
                return 'bg-blue-500/20 text-blue-300 border-blue-500/40'
            case 'B':
                return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            case 'C':
                return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
            default:
                return 'bg-rose-500/20 text-rose-300 border-rose-500/40'
        }
    }

    return (
        <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
            {/* Top Navigation */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-red-500 flex items-center justify-center font-bold text-xl shadow-lg">
                        雀
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                            Mahjong Sensei
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">v0.4</span>
                        </h1>
                        <p className="text-sm text-slate-400">작혼 패보 기반 운 & 실력 분리 분석 엔진</p>
                    </div>
                </div>

                {/* Account Sync & Paipu Quick/Batch Import */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg">
                        <UserCheck className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-semibold text-white">{nickname}</span>
                        <span className="text-xs text-slate-500 font-mono">
                            {gameMode === '3p' ? '(3마 작걸1 / 최고 작걸3)' : '(4마 작걸1)'}
                        </span>
                        <button
                            onClick={() => handleSync(gameMode, nickname)}
                            disabled={syncing}
                            className="ml-2 text-xs px-2 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 rounded font-medium transition-colors cursor-pointer flex items-center gap-1"
                        >
                            <RotateCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                            동기화
                        </button>
                    </div>

                    <form onSubmit={handleImport} className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="단일 패보 URL/UUID..."
                            value={paipuInput}
                            onChange={(e) => setPaipuInput(e.target.value)}
                            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-amber-500 w-48 transition-colors"
                        />
                        <button
                            type="submit"
                            disabled={importing}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
                        >
                            {importing ? <RotateCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                            등록
                        </button>
                    </form>

                    <button
                        onClick={() => setBatchModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-sm font-semibold transition-all cursor-pointer"
                    >
                        <FileText className="w-4 h-4 text-amber-400" />
                        패보 일괄 / 파일 등록
                    </button>

                    <button
                        onClick={() => setShareCardOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-sm font-semibold transition-all cursor-pointer shadow-sm"
                    >
                        <Share2 className="w-4 h-4 text-purple-200" />
                        SNS 공유 카드
                    </button>
                </div>

            </header>

            {statusMessage && (
                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg text-sm text-slate-300 flex items-center justify-between">
                    <span>{statusMessage}</span>
                    <span className="text-xs text-slate-500 font-mono">ID: {accountId}</span>
                </div>
            )}

            {/* Mode Selector & Rolling Window Selector */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* 3P vs 4P Switch */}
                <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    <button
                        onClick={() => setGameMode('3p')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                            gameMode === '3p'
                                ? 'bg-red-600 text-white shadow-md font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Flame className="w-4 h-4 text-amber-300" />
                        3인 마작 (3P)
                    </button>
                    <button
                        onClick={() => setGameMode('4p')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                            gameMode === '4p'
                                ? 'bg-blue-600 text-white shadow-md font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Users className="w-4 h-4 text-blue-200" />
                        4인 마작 (4P)
                    </button>
                </div>

                {/* Rolling Window (10, 30, 50) */}
                <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    {([10, 30, 50] as const).map((size) => (
                        <button
                            key={size}
                            onClick={() => setWindowSize(size)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                                windowSize === size
                                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            최근 {size}판
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards Grid */}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
                        <span>평균 순위 ({gameMode === '3p' ? '3인' : '4인'})</span>
                        <Award className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-3xl font-extrabold text-white">
                        {currentStats.averageRank} <span className="text-sm font-normal text-slate-400">위</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
                        <span className="text-emerald-400 font-medium">연대율 {currentStats.topTwoRate}%</span>
                        <span className="text-slate-600">|</span>
                        <span className="text-rose-400 font-medium">라스율 {currentStats.lastPlaceRate}%</span>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
                        <span>종합 운 지수 (Luck)</span>
                        <Dice5 className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-3xl font-extrabold text-purple-400">
                        {currentStats.averageLuckScore} <span className="text-sm font-normal text-slate-400">/ 100</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                        <span className={currentStats.averageLuckScore >= 50 ? 'text-purple-300 font-medium' : 'text-amber-400 font-medium'}>
                            우라도라율 {currentStats.uradoraRate ?? 0}% ({currentStats.styleDiagnosis?.luckRemark ?? '정직한 승부'})
                        </span>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
                        <span>종합 실력 지수 (Skill)</span>
                        <Sparkles className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-3xl font-extrabold text-blue-400">
                        {currentStats.averageSkillScore} <span className="text-sm font-normal text-slate-400">/ 100</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                        <span className="text-emerald-400 font-medium">
                            방총율 {currentStats.dealInRate ?? 0}% ({currentStats.styleDiagnosis?.skillRemark ?? '방총 제어'})
                        </span>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
                        <span>스타일 및 멘탈 진단</span>
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-lg font-bold text-amber-300">
                        {currentStats.styleDiagnosis?.title ?? '스타일 분석 중'}
                    </div>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                        {currentStats.styleDiagnosis?.description ?? '대국 데이터를 분석하여 유저의 고유 마작 스타일을 진단합니다.'}
                    </p>
                </div>
            </section>

            {/* Charts Section */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Rolling Trend Chart */}
                <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-amber-500" />
                        판별 운(Luck) vs 순위(Rank) 추세 ({gameMode === '3p' ? '3인' : '4인'})
                    </h2>
                    <div className="h-[280px] w-full min-h-[280px]">
                        {isMounted ? (
                            <ResponsiveContainer width="100%" height="100%" minHeight={280}>
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                    <XAxis dataKey="gameIndex" stroke="#64748b" label={{ value: '대국 순번', position: 'insideBottom', offset: -5 }} />
                                    <YAxis yAxisId="left" domain={[0, 100]} stroke="#a855f7" label={{ value: '운 점수', angle: -90, position: 'insideLeft' }} />
                                    <YAxis yAxisId="right" domain={gameMode === '3p' ? [1, 3] : [1, 4]} reversed stroke="#f59e0b" orientation="right" label={{ value: '순위', angle: 90, position: 'insideRight' }} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                                        labelFormatter={(label) => {
                                            const idx = Number(label) - 1
                                            const targetGame = currentStats.games[currentStats.games.length - 1 - idx]
                                            if (targetGame && targetGame.timestamp) {
                                                return `${label}번째 대국 (${formatTimestamp(targetGame.timestamp)})`
                                            }
                                            return `${label}번째 대국`
                                        }}
                                    />
                                    <Line yAxisId="left" type="monotone" dataKey="luck" stroke="#a855f7" strokeWidth={2} name="운 점수" />
                                    <Line yAxisId="right" type="monotone" dataKey="rank" stroke="#f59e0b" strokeWidth={2} name="순위" />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[280px] w-full flex items-center justify-center text-xs text-slate-500">
                                차트 로딩 중...
                            </div>
                        )}
                    </div>
                </div>

                {/* Quadrant Matrix */}
                <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <Dice5 className="w-5 h-5 text-purple-400" />
                            운 vs 실력 사분면 매트릭스 (Quadrant Analysis)
                        </h2>
                        {totalGamesForQuadrant > 0 && (
                            <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60 font-mono">
                                최근 {totalGamesForQuadrant}국 분석
                            </span>
                        )}
                    </div>
                    <div className="h-[280px] w-full min-h-[280px]">
                        {isMounted ? (
                            <ResponsiveContainer width="100%" height="100%" minHeight={280}>
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                    <XAxis type="number" dataKey="luck" domain={[0, 100]} name="운 점수" stroke="#64748b" />
                                    <YAxis type="number" dataKey="skill" domain={[0, 100]} name="실력 점수" stroke="#64748b" />
                                    <ZAxis range={[60, 60]} />
                                    <ReferenceLine x={50} stroke="#475569" strokeDasharray="4 4" />
                                    <ReferenceLine y={50} stroke="#475569" strokeDasharray="4 4" />
                                    <Tooltip
                                        cursor={{ strokeDasharray: '3 3' }}
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                                        formatter={(value, name) => [value, name === 'luck' ? '운 점수' : '실력 점수']}
                                    />
                                    <Scatter name="대국 데이터" data={scatterData} fill="#f59e0b" />
                                </ScatterChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[280px] w-full flex items-center justify-center text-xs text-slate-500">
                                차트 로딩 중...
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-400 mt-3">
                        <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <span className="text-amber-400 font-semibold">2사분면 (억까 피해)</span>
                                <span className="font-bold text-amber-300 font-mono text-sm">
                                    {getQuadrantRate('UNLUCKY_LOSS').rate}%
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                                <span>실력 높으나 운 부족</span>
                                <span className="text-slate-500 font-mono">{getQuadrantRate('UNLUCKY_LOSS').count}국 ({getQuadrantRate('UNLUCKY_LOSS').rate}%)</span>
                            </div>
                        </div>

                        <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <span className="text-emerald-400 font-semibold">1사분면 (실력 승리)</span>
                                <span className="font-bold text-emerald-300 font-mono text-sm">
                                    {getQuadrantRate('SKILLFUL_WIN').rate}%
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                                <span>실력과 운 모두 호조</span>
                                <span className="text-slate-500 font-mono">{getQuadrantRate('SKILLFUL_WIN').count}국 ({getQuadrantRate('SKILLFUL_WIN').rate}%)</span>
                            </div>
                        </div>

                        <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <span className="text-rose-400 font-semibold">3사분면 (실력 난조)</span>
                                <span className="font-bold text-rose-300 font-mono text-sm">
                                    {getQuadrantRate('SLUMP_LOSS').rate}%
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                                <span>실력도 운도 모두 난조</span>
                                <span className="text-slate-500 font-mono">{getQuadrantRate('SLUMP_LOSS').count}국 ({getQuadrantRate('SLUMP_LOSS').rate}%)</span>
                            </div>
                        </div>

                        <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/50 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <span className="text-blue-400 font-semibold">4사분면 (운빨 승리)</span>
                                <span className="font-bold text-blue-300 font-mono text-sm">
                                    {getQuadrantRate('LUCKY_FLUKE').rate}%
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                                <span>실수는 많았으나 운 승리</span>
                                <span className="text-slate-500 font-mono">{getQuadrantRate('LUCKY_FLUKE').count}국 ({getQuadrantRate('LUCKY_FLUKE').rate}%)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Recent Games Detail */}
            <section className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        최근 대국 분석 내역 (최근 {windowSize}판 · {gameMode === '3p' ? '3인 마작' : '4인 마작'})
                    </h2>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                        <span>인게임 패보 링크를 등록하면 실제 국별 샹텐수/억까 리플레이가 연동됩니다.</span>
                    </div>
                </div>

                <div className="divide-y divide-slate-800">
                    {currentStats.games.length === 0 ? (
                        <p className="py-4 text-sm text-slate-500">대국 데이터 로딩 중이거나 없습니다. 상단에서 [동기화] 또는 [일괄 등록]을 눌러보세요.</p>
                    ) : (
                        currentStats.games.map((game) => (
                            <div key={game.gameId} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                                        game.rank === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                        (gameMode === '3p' ? game.rank === 3 : game.rank === 4) ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                        'bg-slate-800 text-slate-300'
                                    }`}>
                                        {game.rank}위
                                    </div>
                                    <div>
                                        <div className="font-semibold text-white flex items-center gap-2">
                                            <span>{game.finalScore.toLocaleString()}점</span>
                                            {getQuadrantBadge(game.quadrant, game.rank)}
                                            {game.aiEvaluation && (
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getAiGradeBadgeClass(game.aiEvaluation.grade)}`}>
                                                    AI {game.aiEvaluation.grade} ({game.aiEvaluation.aiScore}점)
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-mono mt-0.5">
                                            {game.roomType && (
                                                <span className="text-amber-400/90 font-sans font-medium">{game.roomType}</span>
                                            )}
                                            <span>ID: {game.gameId}</span>
                                            {game.timestamp && (
                                                <span className="flex items-center gap-1 text-slate-400 font-sans">
                                                    <Clock className="w-3.5 h-3.5 text-amber-400/90" />
                                                    {formatTimestamp(game.timestamp)}
                                                </span>
                                            )}
                                        </div>
                                        {game.aiEvaluation?.summaryComment && (
                                            <p className="text-xs text-slate-400 mt-1 italic font-sans max-w-xl">
                                                "{game.aiEvaluation.summaryComment}"
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 text-sm">
                                    {game.aiEvaluation && (
                                        <div>
                                            <span className="text-slate-500 text-xs block">AI 일치율</span>
                                            <span className="font-semibold text-emerald-400">{game.aiEvaluation.matchRate}%</span>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-slate-500 text-xs block">운 점수</span>
                                        <span className="font-semibold text-purple-400">{game.luckScore}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 text-xs block">실력 점수</span>
                                        <span className="font-semibold text-blue-400">{game.skillScore}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 text-xs block">평균 시작 샹텐</span>
                                        <span className="font-semibold text-slate-300">{game.averageStartingShanten}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 text-xs block">화료/방총</span>
                                        <span className="font-semibold text-slate-300">{game.winCount} / {game.dealInCount}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setSelectedInspectorGameId(game.gameId)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
                                        >
                                            <Eye className="w-3.5 h-3.5 text-cyan-400" />
                                            국별 상세
                                        </button>
                                        <button
                                            onClick={() => handleOpenCoaching(game.gameId)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
                                        >
                                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                            AI 코칭
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* Batch & Protobuf Import Modal */}
            <PaipuBatchModal
                isOpen={batchModalOpen}
                onClose={() => setBatchModalOpen(false)}
                apiUrl={apiUrl}
                onComplete={() => {
                    void fetchStats(accountId, windowSize, gameMode)
                }}
                onNotify={(msg) => {
                    setStatusMessage(msg)
                }}
            />

            {/* AI Coaching Report Modal */}
            {coachingGameId && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-amber-400" />
                                    AI 틸트 & 코칭 리포트
                                </h3>
                                <p className="text-xs text-slate-400 font-mono mt-1">대국 ID: {coachingGameId}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setCoachingGameId(null)
                                    setCoachingReport(null)
                                }}
                                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {coachingLoading && (
                            <div className="py-16 flex flex-col items-center justify-center gap-3">
                                <RotateCw className="w-8 h-8 text-amber-400 animate-spin" />
                                <p className="text-sm text-slate-300 font-medium">AI 엔진이 대국 내 모든 타패와 샹텐수, 수비 안전도를 정밀 분석 중입니다...</p>
                            </div>
                        )}

                        {coachingError && (
                            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <span>{coachingError}</span>
                            </div>
                        )}

                        {coachingReport && (
                            <div className="space-y-6">
                                {/* Report Summary & Badges */}
                                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase">대국 종합 진단</span>
                                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                            {coachingReport.is3P ? '3인 마작' : '4인 마작'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-200 leading-relaxed font-medium">
                                        "{coachingReport.overallSummaryKo}"
                                    </p>
                                </div>

                                {/* Actionable Advice Checklist */}
                                {coachingReport.actionableAdviceKo.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                                            <Award className="w-4 h-4" />
                                            핵심 실력 개선 가이드
                                        </h4>
                                        <div className="space-y-2">
                                            {coachingReport.actionableAdviceKo.map((advice, idx) => (
                                                <div key={idx} className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                                                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                                    <span>{advice}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Critical Mistakes List */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                                        치명적 실수 하이라이트 (Top {coachingReport.criticalMistakes.length})
                                    </h4>

                                    {coachingReport.criticalMistakes.length === 0 ? (
                                        <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-1">
                                            <p className="text-sm font-bold text-emerald-300">🎉 치명적인 실수가 발견되지 않았습니다!</p>
                                            <p className="text-xs text-slate-400">모범적인 패효율과 공수 밸런스로 완벽한 타패를 유지했습니다.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {coachingReport.criticalMistakes.map((mistake, idx) => {
                                                const badgeInfo = getMistakeCategoryBadge(mistake.mistakeCategory)
                                                return (
                                                    <div key={idx} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${badgeInfo.badgeClass}`}>
                                                                    {badgeInfo.label}
                                                                </span>
                                                                <span className="text-xs text-slate-400 font-medium">
                                                                    동{mistake.roundIndex + 1}국 · {mistake.turnNumber}순
                                                                </span>
                                                            </div>
                                                            <span className="text-xs font-mono text-rose-400 font-bold">
                                                                실수 심각도 {mistake.severityScore}/100
                                                            </span>
                                                        </div>

                                                        {/* Tile Comparison */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 space-y-1">
                                                                <span className="text-[11px] text-rose-300 font-semibold block">내가 버린 패</span>
                                                                <div className="flex items-baseline gap-2">
                                                                    <span className="text-lg font-mono font-bold text-white">[{mistake.discardedTile}]</span>
                                                                    <span className="text-xs text-slate-400">유효패 {mistake.actualUkeire}장</span>
                                                                </div>
                                                                <div className="text-[11px] text-slate-500">
                                                                    샹텐수: {mistake.prevShanten} ➔ {mistake.afterShanten}
                                                                </div>
                                                            </div>

                                                            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                                                                <span className="text-[11px] text-emerald-300 font-semibold block">AI 최적 추천패</span>
                                                                <div className="flex items-baseline gap-2">
                                                                    <span className="text-lg font-mono font-bold text-emerald-300">[{mistake.optimalTile}]</span>
                                                                    <span className="text-xs text-emerald-400">유효패 {mistake.optimalUkeire}장</span>
                                                                </div>
                                                                <div className="text-[11px] text-slate-500">
                                                                    최대 유효패 및 방어 안전 확보
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Feedback Message */}
                                                        <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-900/80 p-3 rounded-lg border border-slate-800/80">
                                                            {mistake.coachingMessageKo}
                                                        </p>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SNS Share Card Modal */}
            {shareCardOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="relative max-w-xl w-full">
                        <button
                            onClick={() => setShareCardOpen(false)}
                            className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center shadow-lg cursor-pointer border border-slate-700"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <TierBenchmarkShareCard
                            nickname={nickname}
                            mode={gameMode}
                            luckScore={currentStats.averageLuckScore}
                            skillScore={currentStats.averageSkillScore}
                            winRate={currentStats.winRate ?? 22.0}
                            dealInRate={currentStats.dealInRate ?? 13.0}
                            quadrant={currentStats.games[0]?.quadrant ?? 'SKILLFUL_WIN'}
                            currentTier={gameMode === '3p' ? '작걸' : '작호'}
                            apiUrl={apiUrl}
                        />
                    </div>
                </div>
            )}

            {/* Paipu Round Inspector Modal */}
            {selectedInspectorGameId && (
                <PaipuRoundInspectorModal
                    gameId={selectedInspectorGameId}
                    isOpen={Boolean(selectedInspectorGameId)}
                    onClose={() => setSelectedInspectorGameId(null)}
                    apiUrl={apiUrl}
                />
            )}
        </main>
    )
}

