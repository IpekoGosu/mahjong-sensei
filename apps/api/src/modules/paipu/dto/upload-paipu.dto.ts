import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common'
import { JsonObject, JsonPrimitive, JsonValue } from './json.types'

export type UploadPaipuFormat = 'json' | 'protobuf' | 'base64'

export type UploadPaipuRawInput =
    | UploadPaipuDto
    | { readonly content?: JsonValue; readonly format?: JsonValue }
    | JsonObject
    | JsonPrimitive
    | readonly JsonValue[]

export class UploadPaipuDto {
    public readonly content: string
    public readonly format: UploadPaipuFormat

    public constructor(content: string, format: UploadPaipuFormat = 'json') {
        this.content = content
        this.format = format
    }

    public static validate(payload: UploadPaipuRawInput): UploadPaipuDto {
        /*_ GEMINI THINKING _*/
        if (payload instanceof UploadPaipuDto) {
            return payload
        }

        if (payload === null || payload === undefined || typeof payload !== 'object' || Array.isArray(payload)) {
            throw new BadRequestException('Request body must be a non-null object')
        }

        if (!('content' in payload)) {
            throw new BadRequestException('Missing required field: content')
        }

        const rawContent = payload.content
        if (typeof rawContent !== 'string') {
            throw new BadRequestException('Field content must be a string')
        }

        const trimmed = rawContent.trim()
        if (trimmed.length < 1) {
            throw new BadRequestException('Field content cannot be empty')
        }

        let format: UploadPaipuFormat = 'json'
        if ('format' in payload && payload.format !== undefined && payload.format !== null) {
            const rawFormat = payload.format
            if (rawFormat === 'json' || rawFormat === 'protobuf' || rawFormat === 'base64') {
                format = rawFormat
            } else {
                throw new BadRequestException('Field format must be one of: json, protobuf, base64')
            }
        } else if (!trimmed.startsWith('{')) {
            format = 'base64'
        }

        return new UploadPaipuDto(trimmed, format)
    }
}

@Injectable()
export class UploadPaipuPipe implements PipeTransform<UploadPaipuRawInput, UploadPaipuDto> {
    public transform(value: UploadPaipuRawInput): UploadPaipuDto {
        return UploadPaipuDto.validate(value)
    }
}
