'use client'

import React, { useState, useEffect, useTransition } from 'react'
import {
    RollingWindowSize,
    RollingWindowStats,
    PerformanceQuadrant
} from '@mahjong-sensei/types'
import {
    TrendingUp,
    ShieldAlert,
    Sparkles,
    Dice5,
    PlusCircle,
    RotateCw,
    Award
} from 'lucide-react'
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

const MOCK_DEFAULT_STATS: Record<RollingWindowSize, RollingWindowStats> = {
    10: {
        windowSize: 10,
        totalGames: 10,
        averageRank: 2.2,
        topTwoRate: 60.0,
        lastPlaceRate: 10.0,
        averageLuckScore: 42.5,
        averageSkillScore: 68.0,
        luckTrend: [40, 35, 45, 52, 38, 41, 30, 48, 50, 46],
        rankTrend: [2, 3, 1, 2, 4, 2, 3, 1, 2, 2],
        games: [
            {
                gameId: '230801-sample1',
                timestamp: Date.now() - 3600000 * 2,
                rank: 1,
                finalScore: 42300,
                luckScore: 48,
                skillScore: 75,
                quadrant: 'SKILLFUL_WIN',
                averageStartingShanten: 3.2,
                dealInCount: 0,
                winCount: 3
            },
            {
                gameId: '230801-sample2',
                timestamp: Date.now() - 3600000 * 5,
                rank: 4,
                finalScore: 12400,
                luckScore: 30,
                skillScore: 66,
                quadrant: 'UNLUCKY_LOSS',
                averageStartingShanten: 4.1,
                dealInCount: 1,
                winCount: 0
            }
        ]
    },
    30: {
        windowSize: 30,
        totalGames: 30,
        averageRank: 2.33,
        topTwoRate: 56.7,
        lastPlaceRate: 16.7,
        averageLuckScore: 49.2,
        averageSkillScore: 64.5,
        luckTrend: [45, 50, 52, 48, 41, 55, 38, 62, 49, 44],
        rankTrend: [2, 1, 2, 3, 4, 1, 3, 1, 2, 4],
        games: []
    },
    50: {
        windowSize: 50,
        totalGames: 50,
        averageRank: 2.38,
        topTwoRate: 54.0,
        lastPlaceRate: 18.0,
        averageLuckScore: 50.1,
        averageSkillScore: 65.2,
        luckTrend: [51, 48, 53, 49, 47, 52, 50, 49, 53, 48],
        rankTrend: [2, 2, 3, 1, 4, 2, 3, 1, 2, 3],
        games: []
    }
}

export default function DashboardPage(): React.ReactElement {
    const [windowSize, setWindowSize] = useState<RollingWindowSize>(10)
    const [stats, setStats] = useState<RollingWindowStats>(MOCK_DEFAULT_STATS[10])
    const [paipuInput, setPaipuInput] = useState<string>('')
    const [importing, setImporting] = useState<boolean>(false)
    const [statusMessage, setStatusMessage] = useState<string>('')
    const [, startTransition] = useTransition()

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

    const fetchStats = (size: RollingWindowSize): void => {
        startTransition(() => {
            fetch(`${apiUrl}/analysis/rolling?accountId=10001&window=${size}`)
                .then((res) => {
                    if (res.ok) {
                        return res.json() as Promise<RollingWindowStats>
                    }
                    return null
                })
                .then((data) => {
                    if (data && data.totalGames > 0) {
                        setStats(data)
                    } else {
                        // Fallback to sample stats if database is empty
                        setStats(MOCK_DEFAULT_STATS[size])
                    }
                })
                .catch(() => {
                    setStats(MOCK_DEFAULT_STATS[size])
                })
        })
    }

    useEffect(() => {
        fetchStats(windowSize)
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
                setStatusMessage('✅ 패보 수집 및 분석이 완료되었습니다!')
                setPaipuInput('')
                fetchStats(windowSize)
            } else {
                setStatusMessage('⚠️ 패보 등록에 실패했습니다. 올바른 링크나 UUID인지 확인해주세요.')
            }
        } catch {
            setStatusMessage('⚠️ 백엔드 API 서버에 연결할 수 없습니다.')
        } finally {
            setImporting(false)
        }
    }

    const chartData = stats.luckTrend.map((luck, index) => ({
        gameIndex: index + 1,
        luck,
        rank: stats.rankTrend[index] ?? 2.5
    }))

    const scatterData = stats.games.map((g, idx) => ({
        index: idx + 1,
        luck: g.luckScore,
        skill: g.skillScore,
        quadrant: g.quadrant,
        rank: g.rank
    }))

    const getQuadrantBadge = (quadrant: PerformanceQuadrant): React.ReactElement => {
        switch (quadrant) {
            case 'SKILLFUL_WIN':
                return <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400 font-medium">실력승 (대승)</span>
            case 'UNLUCKY_LOSS':
                return <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 font-medium">억까 피해 (불운)</span>
            case 'SLUMP_LOSS':
                return <span className="px-2 py-0.5 rounded text-xs bg-rose-500/20 text-rose-400 font-medium">실력 저하 (난조)</span>
            case 'LUCKY_FLUKE':
                return <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 font-medium">운빨 승리</span>
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
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">v0.1</span>
                        </h1>
                        <p className="text-sm text-slate-400">작혼 패보 기반 운 & 실력 분리 분석 엔진</p>
                    </div>
                </div>

                {/* Paipu Quick Import */}
                <form onSubmit={handleImport} className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="작혼 패보 URL 또는 UUID 입력..."
                        value={paipuInput}
                        onChange={(e) => setPaipuInput(e.target.value)}
                        className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-amber-500 w-72 transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={importing}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer"
                    >
                        {importing ? <RotateCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                        패보 등록
                    </button>
                </form>
            </header>

            {statusMessage && (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-300">
                    {statusMessage}
                </div>
            )}

            {/* Rolling Window Selector */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    {([10, 30, 50] as const).map((size) => (
                        <button
                            key={size}
                            onClick={() => setWindowSize(size)}
                            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                                windowSize === size
                                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            최근 {size}판 분석
                        </button>
                    ))}
                </div>
                <div className="text-xs text-slate-500">
                    기준 계정: <span className="text-slate-300 font-mono">SenseiPlayer (#10001)</span>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
                        <span>평균 순위</span>
                        <Award className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-3xl font-extrabold text-white">
                        {stats.averageRank} <span className="text-sm font-normal text-slate-400">위</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
                        <span>연대율 {stats.topTwoRate}%</span>
                        <span className="text-slate-600">|</span>
                        <span>라스율 {stats.lastPlaceRate}%</span>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
                        <span>종합 운 지수 (Luck)</span>
                        <Dice5 className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-3xl font-extrabold text-purple-400">
                        {stats.averageLuckScore} <span className="text-sm font-normal text-slate-400">/ 100</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                        {stats.averageLuckScore < 45 ? (
                            <span className="text-rose-400 font-medium">⚠️ 극심한 억까(불운) 구간</span>
                        ) : stats.averageLuckScore > 55 ? (
                            <span className="text-emerald-400 font-medium">✨ 좋은 쯔모/배패 흐름</span>
                        ) : (
                            <span>보통 수준의 패운</span>
                        )}
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
                        <span>종합 실력 지수 (Skill)</span>
                        <Sparkles className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-3xl font-extrabold text-blue-400">
                        {stats.averageSkillScore} <span className="text-sm font-normal text-slate-400">/ 100</span>
                    </div>
                    <div className="mt-2 text-xs text-slate-400">
                        <span className="text-emerald-400 font-medium">상위 20% 조패 효율 & 방총 억제</span>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-slate-400 text-sm mb-2">
                        <span>멘탈 진단 요약</span>
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-lg font-bold text-amber-300">
                        {stats.averageLuckScore < 45 && stats.averageSkillScore >= 60
                            ? '실력 발휘 중, 패배는 억까'
                            : '안정적인 궤도 유지 중'}
                    </div>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                        최근 {windowSize}판 동안 실착보다는 불가항력 쯔모 피격 비율이 높았습니다. 현재 스타일 유지를 권장합니다.
                    </p>
                </div>
            </section>

            {/* Charts Section */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Rolling Trend Chart */}
                <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-amber-500" />
                        판별 운(Luck) vs 순위(Rank) 추세
                    </h2>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis dataKey="gameIndex" stroke="#64748b" label={{ value: '대국 순번', position: 'insideBottom', offset: -5 }} />
                                <YAxis yAxisId="left" domain={[0, 100]} stroke="#a855f7" label={{ value: '운 점수', angle: -90, position: 'insideLeft' }} />
                                <YAxis yAxisId="right" domain={[1, 4]} reversed stroke="#f59e0b" orientation="right" label={{ value: '순위', angle: 90, position: 'insideRight' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                                />
                                <Line yAxisId="left" type="monotone" dataKey="luck" stroke="#a855f7" strokeWidth={2} name="운 점수" />
                                <Line yAxisId="right" type="monotone" dataKey="rank" stroke="#f59e0b" strokeWidth={2} name="순위" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Quadrant Matrix */}
                <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Dice5 className="w-5 h-5 text-purple-400" />
                        운 vs 실력 사분면 매트릭스 (Quadrant Analysis)
                    </h2>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
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
                                />
                                <Scatter name="대국 데이터" data={scatterData} fill="#f59e0b" />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mt-2">
                        <div className="bg-slate-800/40 p-2 rounded">
                            <span className="text-amber-400 font-semibold">2사분면 (억까 패배)</span>: 실력은 높으나 운이 따르지 않음
                        </div>
                        <div className="bg-slate-800/40 p-2 rounded">
                            <span className="text-emerald-400 font-semibold">1사분면 (실력 승리)</span>: 실력과 운 모두 호조
                        </div>
                        <div className="bg-slate-800/40 p-2 rounded">
                            <span className="text-rose-400 font-semibold">3사분면 (슬럼프/난조)</span>: 실력도 운도 모두 난조
                        </div>
                        <div className="bg-slate-800/40 p-2 rounded">
                            <span className="text-blue-400 font-semibold">4사분면 (운빨 승리)</span>: 실수는 많았으나 운으로 이김
                        </div>
                    </div>
                </div>
            </section>

            {/* Recent Games Detail */}
            <section className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <h2 className="text-lg font-bold text-white mb-4">최근 대국 분석 내역</h2>
                <div className="divide-y divide-slate-800">
                    {stats.games.length === 0 ? (
                        <p className="py-4 text-sm text-slate-500">대국 데이터가 없습니다. 상단에서 패보 링크나 UUID를 등록해보세요.</p>
                    ) : (
                        stats.games.map((game) => (
                            <div key={game.gameId} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                                        game.rank === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                        game.rank === 4 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                        'bg-slate-800 text-slate-300'
                                    }`}>
                                        {game.rank}위
                                    </div>
                                    <div>
                                        <div className="font-semibold text-white flex items-center gap-2">
                                            <span>{game.finalScore.toLocaleString()}점</span>
                                            {getQuadrantBadge(game.quadrant)}
                                        </div>
                                        <div className="text-xs text-slate-500 font-mono">
                                            UUID: {game.gameId}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 text-sm">
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
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </main>
    )
}
