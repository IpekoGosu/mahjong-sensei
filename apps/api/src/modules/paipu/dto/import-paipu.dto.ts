import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common'
import { JsonObject, JsonPrimitive, JsonValue } from './json.types'

export type ImportPaipuRawInput =
    | ImportPaipuDto
    | { readonly urlOrUuid?: JsonValue }
    | JsonObject
    | JsonPrimitive
    | readonly JsonValue[]

export class ImportPaipuDto {
    public readonly urlOrUuid: string

    public constructor(urlOrUuid: string) {
        this.urlOrUuid = urlOrUuid
    }

    public static validate(payload: ImportPaipuRawInput): ImportPaipuDto {
        /*_ GEMINI THINKING _*/
        if (payload === null || payload === undefined || typeof payload !== 'object' || Array.isArray(payload)) {
            throw new BadRequestException('Request body must be a non-null object')
        }

        if (!('urlOrUuid' in payload)) {
            throw new BadRequestException('Missing required field: urlOrUuid')
        }

        const rawUrlOrUuid = payload.urlOrUuid
        if (typeof rawUrlOrUuid !== 'string') {
            throw new BadRequestException('Field urlOrUuid must be a string')
        }

        const trimmed = rawUrlOrUuid.trim()
        if (trimmed.length < 1 || trimmed.length > 500) {
            throw new BadRequestException('Field urlOrUuid must have trimmed length between 1 and 500 characters')
        }

        return new ImportPaipuDto(trimmed)
    }
}

@Injectable()
export class ImportPaipuPipe implements PipeTransform<ImportPaipuRawInput, ImportPaipuDto> {
    public transform(value: ImportPaipuRawInput): ImportPaipuDto {
        return ImportPaipuDto.validate(value)
    }
}

export * from './import-batch-paipu.dto'
export * from './json.types'
