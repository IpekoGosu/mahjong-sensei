import React, { useState, useEffect, useRef } from 'react'
import { RotateCw, Upload, X, Check, AlertCircle } from 'lucide-react'
import { BatchPaipuJobStatus, BatchAsyncImportResponse } from '@mahjong-sensei/types'

export interface PaipuBatchModalProps {
    readonly isOpen: boolean
    readonly onClose: () => void
    readonly apiUrl: string
    readonly onComplete: () => void
    readonly onNotify: (message: string) => void
}

export const PaipuBatchModal: React.FC<PaipuBatchModalProps> = ({
    isOpen,
    onClose,
    apiUrl,
    onComplete,
    onNotify
}) => {
    const [importTab, setImportTab] = useState<'batch' | 'file'>('batch')
    const [batchInput, setBatchInput] = useState<string>('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
    const [activeJobId, setActiveJobId] = useState<string | null>(null)
    const [jobStatus, setJobStatus] = useState<BatchPaipuJobStatus | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const pollTimerRef = useRef<NodeJS.Timeout | null>(null)

    const clearPollTimer = (): void => {
        if (pollTimerRef.current !== null) {
            clearInterval(pollTimerRef.current)
            pollTimerRef.current = null
        }
    }

    useEffect(() => {
        return () => {
            clearPollTimer()
        }
    }, [])

    /*_ GEMINI THINKING _*/
    const handleClose = (): void => {
        if (isSubmitting && jobStatus && !jobStatus.isFinished) {
            const confirmed = window.confirm('현재 패보 분석 작업이 백그라운드에서 진행 중입니다. 창을 닫으시겠습니까?')
            if (!confirmed) {
                return
            }
        }
        clearPollTimer()
        setIsSubmitting(false)
        setActiveJobId(null)
        setJobStatus(null)
        setErrorMessage(null)
        onClose()
    }

    const startPolling = (jobId: string): void => {
        clearPollTimer()

        pollTimerRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${apiUrl}/paipu/batch-status/${jobId}`)
                if (!res.ok) {
                    throw new Error(`Status check failed: HTTP ${res.status}`)
                }

                const status = (await res.json()) as BatchPaipuJobStatus
                setJobStatus(status)

                if (status.isFinished) {
                    clearPollTimer()
                    setIsSubmitting(false)

                    const icon = status.failed === 0 ? '✅' : status.completed > 0 ? '⚠️' : '❌'
                    const msg = `${icon} 총 ${status.total}건 중 ${status.completed}건 완료${
                        status.failed > 0 ? `, ${status.failed}건 실패` : ''
                    } 처리되었습니다.`
                    onNotify(msg)
                    onComplete()
                }
            } catch (err) {
                clearPollTimer()
                setIsSubmitting(false)
                const errText = err instanceof Error ? err.message : '작업 상태 조회 실패'
                setErrorMessage(`비동기 상태 확인 중 오류 발생: ${errText}`)
                onNotify('⚠️ 패보 분석 상태 확인 중 오류가 발생했습니다.')
            }
        }, 600)
    }

    const handleBatchSubmit = async (): Promise<void> => {
        const rawLines = batchInput.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
        const uniqueUrls = Array.from(new Set(rawLines))

        if (uniqueUrls.length === 0) {
            setErrorMessage('패보 URL 또는 UUID를 최소 1개 이상 입력해주세요.')
            return
        }

        if (uniqueUrls.length > 100) {
            setErrorMessage(`한 번에 최대 100개까지만 등록할 수 있습니다. (현재 입력: ${uniqueUrls.length}개)`)
            return
        }

        setErrorMessage(null)
        setIsSubmitting(true)
        setJobStatus({
            jobId: '',
            total: uniqueUrls.length,
            completed: 0,
            failed: 0,
            progressPercent: 0,
            isFinished: false,
            errors: []
        })

        try {
            const res = await fetch(`${apiUrl}/paipu/batch-async`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: uniqueUrls })
            })

            if (!res.ok) {
                const errorData = (await res.json().catch(() => ({}))) as { message?: string }
                throw new Error(errorData.message ?? `서버 오류 (HTTP ${res.status})`)
            }

            const data = (await res.json()) as BatchAsyncImportResponse
            setActiveJobId(data.jobId)
            startPolling(data.jobId)
        } catch (err) {
            setIsSubmitting(false)
            setJobStatus(null)
            const errText = err instanceof Error ? err.message : '요청 실패'
            setErrorMessage(`일괄 등록 요청 실패: ${errText}`)
            onNotify('⚠️ 패보 일괄 등록 요청에 실패했습니다.')
        }
    }

    /*_ GEMINI THINKING _*/
    const handleFileUpload = async (): Promise<void> => {
        if (!selectedFile) {
            setErrorMessage('업로드할 파일을 선택해주세요.')
            return
        }

        setIsSubmitting(true)
        setErrorMessage(null)
        onNotify(`파일 업로드 및 패보 디코딩 중... (${selectedFile.name})`)

        try {
            const isJson = selectedFile.name.toLowerCase().endsWith('.json')
            let content = ''

            if (isJson) {
                content = await selectedFile.text()
            } else {
                const buffer = await selectedFile.arrayBuffer()
                const bytes = new Uint8Array(buffer)
                let binary = ''
                const chunkSize = 8192
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    const chunk = bytes.subarray(i, i + chunkSize)
                    binary += String.fromCharCode(...chunk)
                }
                content = btoa(binary)
            }

            const res = await fetch(`${apiUrl}/paipu/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content,
                    format: isJson ? 'json' : 'base64'
                })
            })

            if (res.ok) {
                const data = (await res.json()) as { success: boolean; gameId: string }
                onNotify(`✅ 패보가 성공적으로 분석 및 등록되었습니다. (Game ID: ${data.gameId})`)
                setSelectedFile(null)
                onComplete()
                handleClose()
            } else {
                const errData = (await res.json().catch(() => ({}))) as { message?: string }
                throw new Error(errData.message ?? '패보 파일 파싱 또는 저장 실패')
            }
        } catch (err) {
            const errText = err instanceof Error ? err.message : '업로드 처리 오류'
            setErrorMessage(`파일 업로드 오류: ${errText}`)
            onNotify('⚠️ 패보 파일 처리 중 오류가 발생했습니다.')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isOpen) {
        return null
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-amber-500" />
                        작혼 실제 패보 등록 & 비동기 Protobuf 정밀 분석
                    </h3>
                    <button
                        onClick={handleClose}
                        className="text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs: Text Batch vs File Upload */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <button
                        onClick={() => {
                            if (!isSubmitting) {
                                setImportTab('batch')
                                setErrorMessage(null)
                            }
                        }}
                        disabled={isSubmitting}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            importTab === 'batch'
                                ? 'bg-amber-600 text-white font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                        } disabled:opacity-50`}
                    >
                        링크 / UUID 비동기 일괄 등록
                    </button>
                    <button
                        onClick={() => {
                            if (!isSubmitting) {
                                setImportTab('file')
                                setErrorMessage(null)
                            }
                        }}
                        disabled={isSubmitting}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                            importTab === 'file'
                                ? 'bg-amber-600 text-white font-bold'
                                : 'text-slate-400 hover:text-slate-200'
                        } disabled:opacity-50`}
                    >
                        <Upload className="w-3.5 h-3.5" />
                        파일 업로드 (.json / .pb)
                    </button>
                </div>

                {errorMessage && (
                    <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{errorMessage}</span>
                    </div>
                )}

                {importTab === 'batch' ? (
                    <>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            작혼 인게임 [패보] 메뉴에서 최근 대국의 링크 또는 UUID를 한 줄에 하나씩 붙여넣으세요. (최대 100개)
                            <br />
                            백엔드 비동기 잡 큐에서 Protobuf 디코딩 및 운/실력 지표를 순차/병렬 정밀 분석합니다.
                        </p>

                        {!isSubmitting && (!jobStatus || jobStatus.isFinished) && (
                            <textarea
                                rows={7}
                                placeholder="https://mahjongsoul.game.yo-star.com/?paipu=241015-xxxx&#10;241014-yyyy-yyyy...&#10;241013-zzzz-zzzz..."
                                value={batchInput}
                                onChange={(e) => setBatchInput(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-mono text-slate-200 focus:outline-none focus:border-amber-500 resize-none"
                            />
                        )}

                        {/* Progress Bar & Status View */}
                        {jobStatus && (
                            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-slate-300 flex items-center gap-2">
                                        {jobStatus.isFinished ? (
                                            <Check className="w-4 h-4 text-emerald-400" />
                                        ) : (
                                            <RotateCw className="w-4 h-4 text-amber-400 animate-spin" />
                                        )}
                                        {jobStatus.isFinished
                                            ? '비동기 분석 파이프라인 처리 완료'
                                            : '비동기 Protobuf 정밀 분석 및 대국 저장 중...'}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {activeJobId && (
                                            <span className="text-[10px] text-slate-500 font-mono">
                                                [{activeJobId}]
                                            </span>
                                        )}
                                        <span className="font-mono text-amber-400 font-bold">
                                            {jobStatus.progressPercent}%
                                        </span>
                                    </div>
                                </div>

                                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-amber-600 to-amber-400 h-full transition-all duration-300 ease-out rounded-full"
                                        style={{ width: `${jobStatus.progressPercent}%` }}
                                    />
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                                    <span>
                                        완료: <strong className="text-emerald-400">{jobStatus.completed}</strong> / 총 {jobStatus.total}건
                                    </span>
                                    {jobStatus.failed > 0 && (
                                        <span>
                                            실패: <strong className="text-red-400">{jobStatus.failed}</strong>건
                                        </span>
                                    )}
                                </div>

                                {jobStatus.errors.length > 0 && (
                                    <div className="mt-2 max-h-24 overflow-y-auto space-y-1 bg-red-950/30 p-2 rounded-lg border border-red-900/50 text-[11px] text-red-300 font-mono">
                                        {jobStatus.errors.map((err, idx) => (
                                            <div key={idx} className="truncate">
                                                • {err}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                                {jobStatus && jobStatus.isFinished ? '닫기' : '취소'}
                            </button>
                            {(!jobStatus || !jobStatus.isFinished) && (
                                <button
                                    onClick={handleBatchSubmit}
                                    disabled={isSubmitting || !batchInput.trim()}
                                    className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                                >
                                    {isSubmitting && <RotateCw className="w-4 h-4 animate-spin" />}
                                    비동기 파이프라인 분석 시작
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="space-y-4">
                        <p className="text-xs text-slate-400 leading-relaxed">
                            작혼 웹/모바일 클라이언트에서 추출한 JSON 패보 파일 또는 Protobuf(.pb) 바이너리 파일을 직접 업로드하세요.
                        </p>
                        <label className="border-2 border-dashed border-slate-700 hover:border-amber-500/80 rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-slate-950/50">
                            <Upload className="w-8 h-8 text-amber-400" />
                            <span className="text-sm font-medium text-slate-200">
                                {selectedFile ? selectedFile.name : '클릭하여 파일 선택 또는 파일 드래그'}
                            </span>
                            <span className="text-xs text-slate-500">
                                지원 형식: .json, .pb, .bin (최대 10MB)
                            </span>
                            <input
                                type="file"
                                accept=".json,.pb,.bin"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) {
                                        setSelectedFile(file)
                                        setErrorMessage(null)
                                    }
                                }}
                            />
                        </label>
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleFileUpload}
                                disabled={isSubmitting || !selectedFile}
                                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                            >
                                {isSubmitting && <RotateCw className="w-4 h-4 animate-spin" />}
                                패보 디코딩 & 등록
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
