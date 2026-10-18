'use client'

import React, { useState, useEffect } from 'react'
import {
    PaipuDetail,
    PaipuRound,
    PaipuRoundMetricSummary,
    SeatIndex
} from '@mahjong-sensei/types'
import {
    Layers,
    X,
    Trophy,
    Coins,
    Flame,
    AlertCircle,
    Eye
} from 'lucide-react'

export interface PaipuRoundInspectorModalProps {
    readonly gameId: string
    readonly isOpen: boolean
    readonly onClose: () => void
    readonly apiUrl: string
}

function getTileDisplay(tile: string): {
    readonly label: string
    readonly suit: 'm' | 'p' | 's' | 'z'
    readonly isRed: boolean
} {
    const isRed = tile.startsWith('0') || tile.includes('r')
    const normalized = tile.replace('0', '5')
    const suit = (normalized.slice(-1) || 'z') as 'm' | 'p' | 's' | 'z'
    const num = normalized.slice(0, -1)

    if (suit === 'z') {
        const honorNames: Record<string, string> = {
            '1': '東',
            '2': '南',
            '3': '西',
            '4': '北',
            '5': '白',
            '6': '發',
            '7': '中'
        }
        return {
            label: honorNames[num] ?? tile,
            suit: 'z',
            isRed: false
        }
    }

    const suitNames: Record<'m' | 'p' | 's', string> = {
        m: '만',
        p: '통',
        s: '삭'
    }

    return {
        label: `${num}${suitNames[suit] ?? suit}`,
        suit,
        isRed
    }
}

function MahjongTile({
    tile,
    isDora = false
}: {
    readonly tile: string
    readonly isDora?: boolean
}): React.ReactElement {
    const { label, suit, isRed } = getTileDisplay(tile)

    let textColor = 'text-slate-900'
    if (isRed) {
        textColor = 'text-rose-600 font-extrabold'
    } else if (suit === 'm') {
        textColor = 'text-red-600'
    } else if (suit === 'p') {
        textColor = 'text-sky-700'
    } else if (suit === 's') {
        textColor = 'text-emerald-700'
    } else if (suit === 'z') {
        if (label === '中') {
            textColor = 'text-rose-600'
        } else if (label === '發') {
            textColor = 'text-emerald-600'
        } else {
            textColor = 'text-slate-800'
        }
    }

    return (
        <div
            className={`relative flex flex-col items-center justify-center min-w-[28px] sm:min-w-[32px] h-9 sm:h-10 px-1 sm:px-1.5 rounded-md bg-gradient-to-b from-amber-50 to-amber-100/90 text-xs font-bold shadow-sm select-none transition-transform hover:-translate-y-0.5 ${
                isDora
                    ? 'border-2 border-amber-400 ring-2 ring-amber-400/40 shadow-amber-500/20'
                    : 'border border-amber-200/70'
            }`}
        >
            <span className={`${textColor} font-mono tracking-tight text-[11px] sm:text-xs leading-tight`}>
                {label}
            </span>
            {isRed && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-0.5" />
            )}
            {isDora && (
                <span className="absolute -top-1.5 -right-1.5 px-1 py-0.2 bg-amber-500 text-slate-950 text-[9px] font-black rounded-full shadow-xs">
                    도라
                </span>
            )}
        </div>
    )
}

function getSeatLabel(seat: number): string {
    const winds = ['동 (東)', '남 (南)', '서 (西)', '북 (北)']
    return winds[seat] ?? `${seat + 1}번가`
}

function formatShantenText(shanten: number): string {
    if (shanten <= -1) {
        return '화료 (완성)'
    }
    if (shanten === 0) {
        return '0-샹텐 (텐파이)'
    }
    if (shanten === 1) {
        return '1-샹텐 (이샹텐)'
    }
    return `${shanten}-샹텐`
}

export function PaipuRoundInspectorModal({
    gameId,
    isOpen,
    onClose,
    apiUrl
}: PaipuRoundInspectorModalProps): React.ReactElement | null {
    const [detail, setDetail] = useState<PaipuDetail | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)
    const [activeRoundIndex, setActiveRoundIndex] = useState<number>(0)

    useEffect(() => {
        if (!isOpen || !gameId) {
            return
        }

        setLoading(true)
        setError(null)
        setActiveRoundIndex(0)

        fetch(`${apiUrl}/paipu/${encodeURIComponent(gameId)}`)
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error(`패보 데이터를 불러올 수 없습니다 (상태 코드: ${res.status})`)
                }
                return (await res.json()) as PaipuDetail
            })
            .then((data) => {
                setDetail(data)
                setLoading(false)
            })
            .catch((err: Error) => {
                setError(err.message || '패보 데이터를 불러오는 중 오류가 발생했습니다.')
                setLoading(false)
            })
    }, [isOpen, gameId, apiUrl])

    if (!isOpen) {
        return null
    }

    const currentRound: PaipuRound | undefined = detail?.rounds[activeRoundIndex]

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                <Layers className="w-4 h-4" />
                            </span>
                            <h3 className="text-base sm:text-lg font-bold text-white">
                                대국 국별 상세 뷰어 (Paipu Inspector)
                            </h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            {detail && (
                                <>
                                    <span className="text-cyan-300 font-semibold">{detail.roomName}</span>
                                    <span>·</span>
                                    <span className="font-mono text-slate-400">{detail.id}</span>
                                    <span>·</span>
                                    <span>{new Date(detail.timestamp).toLocaleDateString('ko-KR')}</span>
                                </>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Body */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
                    {loading && (
                        <div className="py-20 text-center space-y-3">
                            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-sm text-slate-400">국별 패보 상세 데이터를 불러오는 중입니다...</p>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <h4 className="text-sm font-semibold text-rose-200">데이터 조회 실패</h4>
                                <p className="text-xs text-rose-300/80">{error}</p>
                            </div>
                        </div>
                    )}

                    {!loading && !error && detail && (
                        <>
                            {/* Match Summary Bar */}
                            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                    전체 대국 최종 결과
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                    {detail.players.map((p) => {
                                        let rankBadge = 'bg-slate-700 text-slate-200 border-slate-600'
                                        if (p.rank === 1) {
                                            rankBadge = 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-black'
                                        } else if (p.rank === 2) {
                                            rankBadge = 'bg-slate-300/20 text-slate-200 border-slate-300/40 font-bold'
                                        } else if (p.rank === 3) {
                                            rankBadge = 'bg-amber-700/20 text-amber-400 border-amber-700/40'
                                        }

                                        return (
                                            <div
                                                key={p.seat}
                                                className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1.5"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className={`px-2 py-0.5 rounded text-[11px] border ${rankBadge}`}>
                                                        {p.rank}위
                                                    </span>
                                                    <span className="text-[11px] text-slate-400">
                                                        {getSeatLabel(p.seat)}
                                                    </span>
                                                </div>
                                                <div className="font-bold text-white text-sm truncate">
                                                    {p.nickname}
                                                </div>
                                                <div className="flex items-baseline justify-between text-xs">
                                                    <span className="font-mono font-bold text-slate-200">
                                                        {p.finalScore.toLocaleString()}점
                                                    </span>
                                                    <div className="flex items-center gap-1.5 text-[11px]">
                                                        <span className="text-purple-400 font-semibold">운 {p.luckScore}</span>
                                                        <span className="text-blue-400 font-semibold">실력 {p.skillScore}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Round Selector Tabs */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                                    <span className="flex items-center gap-1.5">
                                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                                        국 선택 (Round Selection)
                                    </span>
                                    <span>총 {detail.rounds.length}국 진행</span>
                                </div>
                                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
                                    {detail.rounds.map((r, idx) => {
                                        const isActive = idx === activeRoundIndex
                                        let outcomeBadge = 'bg-slate-800 text-slate-400'
                                        let outcomeLabel = '유국'

                                        if (r.result?.type === 'ron') {
                                            outcomeBadge = 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                            outcomeLabel = '론 화료'
                                        } else if (r.result?.type === 'tsumo') {
                                            outcomeBadge = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                            outcomeLabel = '쯔모 화료'
                                        } else if (r.result?.type === 'ryukyoku') {
                                            outcomeBadge = 'bg-slate-700/30 text-slate-300 border-slate-700/40'
                                            outcomeLabel = '유국'
                                        }

                                        return (
                                            <button
                                                key={r.roundIndex}
                                                onClick={() => setActiveRoundIndex(idx)}
                                                className={`px-3 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all flex flex-col items-center gap-1 cursor-pointer border ${
                                                    isActive
                                                        ? 'bg-gradient-to-r from-cyan-900/60 to-blue-900/60 border-cyan-500 text-white shadow-lg shadow-cyan-950/50'
                                                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                                }`}
                                            >
                                                <span className="font-bold whitespace-nowrap">
                                                    {r.roundName} {r.honba > 0 ? `${r.honba}본장` : ''}
                                                </span>
                                                <span className={`px-1.5 py-0.2 rounded text-[10px] border ${outcomeBadge}`}>
                                                    {outcomeLabel}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Active Round Inspector */}
                            {currentRound && (
                                <div className="space-y-4">
                                    {/* Round Header Strip */}
                                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="space-y-1">
                                                <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                                                    도라 표시패 (Dora)
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    {currentRound.doraIndicators.map((d, dIdx) => (
                                                        <MahjongTile key={dIdx} tile={d} isDora={true} />
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="h-8 w-px bg-slate-800 hidden sm:block" />

                                            <div className="space-y-1">
                                                <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                                                    본장 및 공탁금
                                                </span>
                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                                                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                                                        {currentRound.honba}본장
                                                    </span>
                                                    <span className="flex items-center gap-1 text-amber-400">
                                                        <Coins className="w-3.5 h-3.5" />
                                                        리치봉 {currentRound.riichiSticks}개 ({currentRound.riichiSticks * 1000}점)
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Outcome Banner */}
                                        {currentRound.result && (
                                            <div className="flex-1 max-w-md p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    {currentRound.result.type === 'ron' && (
                                                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                                            론 화료
                                                        </span>
                                                    )}
                                                    {currentRound.result.type === 'tsumo' && (
                                                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                                            쯔모 화료
                                                        </span>
                                                    )}
                                                    {currentRound.result.type === 'ryukyoku' && (
                                                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-700/40 text-slate-300 border border-slate-600">
                                                            유국
                                                        </span>
                                                    )}
                                                    <span className="text-xs font-semibold text-white">
                                                        {currentRound.result.summaryKo}
                                                    </span>
                                                </div>

                                                {/* Yaku Badges */}
                                                {currentRound.result.yakuList && currentRound.result.yakuList.length > 0 && (
                                                    <div className="flex flex-wrap items-center gap-1 pt-1">
                                                        {currentRound.result.yakuList.map((y, yIdx) => (
                                                            <span
                                                                key={yIdx}
                                                                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20"
                                                            >
                                                                {y}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Player Hands & Round Metrics Cards */}
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Flame className="w-3.5 h-3.5 text-amber-400" />
                                            플레이어별 배패 및 국별 운/실력 상세
                                        </h4>

                                        <div className="space-y-3">
                                            {detail.players.map((player) => {
                                                const seat = player.seat as SeatIndex
                                                const hand = currentRound.startingHands[seat] ?? []
                                                const metric: PaipuRoundMetricSummary | undefined =
                                                    currentRound.roundMetrics?.find((m) => m.seat === seat)

                                                return (
                                                    <div
                                                        key={seat}
                                                        className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3"
                                                    >
                                                        {/* Player Title & Style Badges */}
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700">
                                                                    {getSeatLabel(seat)}
                                                                </span>
                                                                <span className="font-bold text-white text-sm">
                                                                    {player.nickname}
                                                                </span>
                                                                <span className="text-xs text-slate-400">
                                                                    (시작 {currentRound.initialScores[seat]?.toLocaleString()}점)
                                                                </span>
                                                            </div>

                                                            {/* Round style flags */}
                                                            <div className="flex items-center gap-1 text-[11px]">
                                                                {metric?.isWin && (
                                                                    <span className="px-2 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                                        화료
                                                                    </span>
                                                                )}
                                                                {metric?.dealInScore && metric.dealInScore > 0 ? (
                                                                    <span className="px-2 py-0.5 rounded font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                                                        방총 (-{metric.dealInScore.toLocaleString()}점)
                                                                    </span>
                                                                ) : null}
                                                                {metric?.isRiichi && (
                                                                    <span className="px-2 py-0.5 rounded font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                                        리치
                                                                    </span>
                                                                )}
                                                                {metric?.isFuro && (
                                                                    <span className="px-2 py-0.5 rounded font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                                        후로
                                                                    </span>
                                                                )}
                                                                {metric?.isDamaten && (
                                                                    <span className="px-2 py-0.5 rounded font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                                        다마텐
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Starting Hand Tiles */}
                                                        <div className="space-y-1.5">
                                                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                                                                <span>시작 배패 ({hand.length}장)</span>
                                                                {metric && (
                                                                    <span className="text-cyan-400 font-semibold">
                                                                        {formatShantenText(metric.startingShanten)} · 시작 도라 {metric.startingDoraCount}장
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 min-h-[48px]">
                                                                {hand.length === 0 ? (
                                                                    <span className="text-xs text-slate-500">배패 기록 없음</span>
                                                                ) : (
                                                                    hand.map((tile, tIdx) => (
                                                                        <MahjongTile key={tIdx} tile={tile} />
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Round Metrics Grid */}
                                                        {metric && (
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                                                                <div className="p-2 rounded bg-slate-900/50 border border-slate-800/50 space-y-0.5">
                                                                    <span className="text-[11px] text-slate-500 block">국별 운 점수</span>
                                                                    <span className="font-semibold text-purple-400">{metric.luckScore}점</span>
                                                                </div>
                                                                <div className="p-2 rounded bg-slate-900/50 border border-slate-800/50 space-y-0.5">
                                                                    <span className="text-[11px] text-slate-500 block">국별 실력 점수</span>
                                                                    <span className="font-semibold text-blue-400">{metric.skillScore}점</span>
                                                                </div>
                                                                <div className="p-2 rounded bg-slate-900/50 border border-slate-800/50 space-y-0.5">
                                                                    <span className="text-[11px] text-slate-500 block">패효율 (Tile Eff.)</span>
                                                                    <span className="font-semibold text-emerald-400">
                                                                        {(metric.tileEfficiency * 100).toFixed(1)}%
                                                                    </span>
                                                                </div>
                                                                <div className="p-2 rounded bg-slate-900/50 border border-slate-800/50 space-y-0.5">
                                                                    <span className="text-[11px] text-slate-500 block">시작 샹텐수</span>
                                                                    <span className="font-semibold text-slate-300">
                                                                        {metric.startingShanten}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
