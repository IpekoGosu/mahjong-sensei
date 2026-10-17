import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common'
import { JsonObject, JsonPrimitive, JsonValue } from './json.types'

export type ImportBatchPaipuRawInput =
    | ImportBatchPaipuDto
    | { readonly inputs?: JsonValue }
    | JsonObject
    | JsonPrimitive
    | readonly JsonValue[]

export class ImportBatchPaipuDto {
    public readonly inputs: readonly string[]

    public constructor(inputs: readonly string[]) {
        this.inputs = inputs
    }

    public static validate(payload: ImportBatchPaipuRawInput): ImportBatchPaipuDto {
        /*_ GEMINI THINKING _*/
        if (payload === null || payload === undefined || typeof payload !== 'object' || Array.isArray(payload)) {
            throw new BadRequestException('Request body must be a non-null object')
        }

        if (!('inputs' in payload)) {
            throw new BadRequestException('Missing required field: inputs')
        }

        const rawInputs = payload.inputs
        if (!Array.isArray(rawInputs)) {
            throw new BadRequestException('Field inputs must be an array of strings')
        }

        if (rawInputs.length < 1 || rawInputs.length > 100) {
            throw new BadRequestException('Field inputs must contain between 1 and 100 items')
        }

        const validatedInputs: string[] = []
        for (let i = 0; i < rawInputs.length; i++) {
            const item = rawInputs[i]
            if (typeof item !== 'string') {
                throw new BadRequestException(`Field inputs[${i}] must be a string`)
            }
            const trimmed = item.trim()
            if (trimmed.length < 1) {
                throw new BadRequestException(`Field inputs[${i}] must be a non-empty string`)
            }
            if (item.length > 500 || trimmed.length > 500) {
                throw new BadRequestException(`Field inputs[${i}] must not exceed 500 characters`)
            }
            validatedInputs.push(trimmed)
        }

        return new ImportBatchPaipuDto(validatedInputs)
    }
}

@Injectable()
export class ImportBatchPaipuPipe implements PipeTransform<ImportBatchPaipuRawInput, ImportBatchPaipuDto> {
    public transform(value: ImportBatchPaipuRawInput): ImportBatchPaipuDto {
        return ImportBatchPaipuDto.validate(value)
    }
}
