import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common'
import { JsonObject, JsonPrimitive, JsonValue } from './json.types'

export type ImportBatchAsyncRawInput =
    | ImportBatchAsyncDto
    | { readonly urls?: JsonValue; readonly inputs?: JsonValue }
    | JsonObject
    | JsonPrimitive
    | readonly JsonValue[]

export class ImportBatchAsyncDto {
    public readonly urls: readonly string[]

    public constructor(urls: readonly string[]) {
        this.urls = urls
    }

    public static validate(payload: ImportBatchAsyncRawInput): ImportBatchAsyncDto {
        /*_ GEMINI THINKING _*/
        if (payload instanceof ImportBatchAsyncDto) {
            return payload
        }

        if (payload === null || payload === undefined || typeof payload !== 'object' || Array.isArray(payload)) {
            throw new BadRequestException('Request body must be a non-null object')
        }

        const candidate = 'urls' in payload ? payload.urls : ('inputs' in payload ? payload.inputs : undefined)
        if (candidate === undefined) {
            throw new BadRequestException('Missing required field: urls')
        }

        if (!Array.isArray(candidate)) {
            throw new BadRequestException('Field urls must be an array of strings')
        }

        if (candidate.length < 1 || candidate.length > 100) {
            throw new BadRequestException('Field urls must contain between 1 and 100 items')
        }

        const validatedUrls: string[] = []
        for (const [i, item] of candidate.entries()) {
            if (typeof item !== 'string') {
                throw new BadRequestException(`Field urls[${i}] must be a string`)
            }
            const trimmed = item.trim()
            if (trimmed.length < 1 || trimmed.length > 500) {
                throw new BadRequestException(`Field urls[${i}] must have trimmed length between 1 and 500 characters`)
            }
            validatedUrls.push(trimmed)
        }

        return new ImportBatchAsyncDto(validatedUrls)
    }
}

@Injectable()
export class ImportBatchAsyncPipe implements PipeTransform<ImportBatchAsyncRawInput, ImportBatchAsyncDto> {
    public transform(value: ImportBatchAsyncRawInput): ImportBatchAsyncDto {
        return ImportBatchAsyncDto.validate(value)
    }
}
