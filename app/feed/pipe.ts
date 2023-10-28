// These live here instead of nodes.tsx so that they are available on both client and server

/**
 * Mapper function type for data pipes; Data for each input handle is collected into a single string array
 */
export type PipeMapper = (input: { [key: string]: string[] }) => ({ [key: string]: string[] })

/**
 * Message describing a state change in the data pipe of a node.
 */
export type PipeMessage<T> = OkMessage<T> | BadConfigMessage | ErrMessage;

/**
 * "Map" function for PipeMessages, performing a map over T into U if the message is of kind Ok, leaving Error/BadConfig messages as-is
 * @param message Message to map
 * @param map Map function
 */
export function mapMessage<T, U>(message: PipeMessage<T>, map: (t: T) => U): PipeMessage<U> {
    switch (message.kind) {
        case PipeState.Ok:
            return {
                fromNode: message.fromNode,
                kind: PipeState.Ok,
                value: map(message.value)
            };
        case PipeState.BadConfig:
        case PipeState.Err:
            return message;
    }
}

/**
 * Ok-state message, containing the updated value T
 */
export interface OkMessage<T>{
    fromNode: string,
    kind: PipeState.Ok
    value: T
}

/**
 * BadConfig-state message, indicating the originating node is not fully/correctly configured
 */
export interface BadConfigMessage {
    fromNode: string,
    kind: PipeState.BadConfig
}

/**
 * Error-state message, indicating an error in the node's data processing; Invalid or missing input, external web/API request failure, etc.
 */
export interface ErrMessage {
    fromNode: string,
    kind: PipeState.Err
    error: string
}

/**
 * Data pipe state kind
 */
export enum PipeState {
    Ok,
    BadConfig,
    Err
}

/**
 * State value for data pipes
 */
export type PipeValue = OkPipe | BadConfigPipe | ErrPipe;

interface OkPipe {
    kind: PipeState.Ok
    mapper: PipeMapper
}

interface BadConfigPipe {
    kind: PipeState.BadConfig
}

interface ErrPipe {
    kind: PipeState.Err,
    error: string
}