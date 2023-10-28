'use client'

import {PipeState, PipeMessage} from "@/app/feed/pipe";

/**
 * Performs a fetch and returns the result as a PipeMessage
 *
 * On success, message contains the body text
 *
 * Caution: This function performs fetch from the client, and is thus subject to CORS constraints.
 * See {@link server_fetch} for an equivalent running on the server.
 *
 * @param fromNode NodeID of node that originates this call; Used as the source of the PipeMessage
 * @param url URL to fetch
 */
export async function client_fetch(fromNode: string, url: string): Promise<PipeMessage<string>> {
    return fetch(url, {credentials: "omit"})
        .then(async response => {
            if (response.ok) {
                response.type
                return {fromNode: fromNode, kind: PipeState.Ok, value: await response.text()} as PipeMessage<string>;
            } else {
                return {fromNode: fromNode, kind: PipeState.Err, error: response.status + " " + response.statusText} as PipeMessage<string>;
            }
        })
        .catch((error) => {
            // This matches the API of @/app/util/server/server_fetch, whose API has to return plain objects as a limitation of server actions
            if (typeof error == "string") {
                return ({fromNode: fromNode, kind: PipeState.Err, error: error})
            }else if (typeof error.message == "string") {
                return ({fromNode: fromNode, kind: PipeState.Err, error: error.message})
            } else if (typeof error.toString == "function") {
                return ({fromNode: fromNode, kind: PipeState.Err, error: error.toString()})
            } else {
                try {
                    return ({fromNode: fromNode, kind: PipeState.Err, error: String(error)})
                } catch (e) {
                    return ({fromNode: fromNode, kind: PipeState.Err, error: "unknown error: " + typeof error})
                }
            }
        })
}