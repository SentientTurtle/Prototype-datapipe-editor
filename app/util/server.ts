'use server'

import {PipeState, PipeMessage} from "@/app/feed/pipe";

/**
 * Performs a fetch and returns the result as a PipeMessage
 *
 * On success, message contains the body text
 *
 * Caution: This function performs arbitrary fetch from the server, creating a significant SSRF risk.
 * See {@link client_fetch} for an equivalent that runs entirely on the client.
 *
 * @param fromNode NodeID of node that originates this call; Used as the source of the PipeMessage
 * @param url URL to fetch
 */
export async function server_fetch(fromNode: string, url: string): Promise<PipeMessage<string>> {
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
            // This is a bit clunky but this value is passed from server to client, so can only be a plain object; We must extract the message from the error object
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