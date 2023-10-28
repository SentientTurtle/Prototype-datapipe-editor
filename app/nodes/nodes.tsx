"use client";

import React, {ChangeEvent, ReactNode, useCallback, useEffect, useId, useRef, useState} from 'react';
import {Handle, Position} from 'reactflow';
import {client_fetch} from "@/app/util/client";
import {newDocument} from "@/app/feed/feedgenerator";
import {mapMessage, PipeMapper, PipeMessage, PipeState, PipeValue} from "@/app/feed/pipe";
import {DemoInputNode} from "@/app/nodes/demonode";

export interface Handles {
    source: HandleInfo[],
    target: HandleInfo[]
}

export interface HandleInfo {
    /**
     * Id for this handle, must be unique per node. Not displayed.
     */
    id: string,
    /**
     * Display name for this handle, may be shortened if longer than 5 characters.
     */
    label: string,
    /**
     * Handle group, absence indicates an ungrouped handle
     */
    group?: string,
    /**
     * True if this handle is optional, false or absent if not.
     */
    optional?: boolean
}

export interface NodeProperties {
    /**
     * Handles of this node, initialised from the 'handles' property on datanode react Components.
     */
    handles: Handles,
    /**
     * Current data state for this node's pipe. Initialised to "BadConfig", nodes with no configuration must fire an update
     */
    pipeValue: PipeValue,
    /**
     * Callback for updating pipe state
     * @param update Update message describing new state
     */
    onPipeUpdate: (update: PipeMessage<PipeMapper>) => void
}

/**
 * Background colours for handles
 *
 * Text is currently set to white, these colours should accordingly have low luminance
 */
export enum HandleColours {
    Normal = "#784be8",
    Optional = "#298415"
}

/**
 * Trims labels, if length is over 5 "characters"/code units, string is truncate to 4 characters and an ellipsis.
 */
function truncateLabel(label: string): string {
    if (label.length > 5) {
        return label.substring(0, 4) + "…"
    } else {
        return label;
    }
}

/**
 * Basic node "template" component
 *
 * Provides selection handling, basic label, and handle rendering
 *
 * @param selected True if this node is selected, false otherwise. Forwarded from ReactFlow node data
 * @param label Label for this node
 * @param pipeValue Current data pipe state of this node, forwarded from ReactFlow node data
 * @param handles Handles of this node, forwarded from ReactFlow node data. (Entries may be omitted to hide handles in the editor)
 * @param children Content of this node
 * @constructor
 */
export function BaseNode(
    {selected, label, pipeValue, handles, children}:
        { selected: boolean, label: string, pipeValue: PipeValue, handles: Handles, children?: ReactNode }
) {
    let borderColour;
    if (selected) {
        borderColour = " border-black";
    } else if (pipeValue.kind === PipeState.Err) {  // BadConfig state needs no highlighting; Individual inputs will be highlighted instead
        borderColour = " border-red-500";
    } else {
        borderColour = " border-gray-400";
    }

    // Dynamically calculating width is kind of clunky, but handles are position-absolute from ReactFlow, so they can't resize the node automatically
    let paddingLeft;
    if (handles.target.length > 0) {
        // If we have grouped, increase padding a bit more to accommodate the group indicator
        if (handles.target.some((handle) => handle.group != undefined)) {
            paddingLeft = "3.5rem";
        } else {
            paddingLeft = "3.25rem";
        }
    } else {
        paddingLeft = "0.25rem";
    }

    let paddingRight: string;
    if (handles.source.length > 0) {
        if (handles.source.some((handle) => handle.group != undefined)) {
            paddingRight = "3.5rem";
        } else {
            paddingRight = "3.25rem";
        }
    } else {
        paddingRight = "0.25rem";
    }

    /**
     * Function to render handles
     *
     * Returns the rendered handles, as well as the number of items/"slots"; This is used to expand the height of the node if necessary.
     *
     * @param handles Handles to render
     * @param handleType Type of these handles; "target" for input handles rendered on the left side of the node, "source" for output handles rendered on the right side of the node
     */
    function renderHandles(handles: HandleInfo[], handleType: "source" | "target"): [ReactNode[], number] {
        let ungroupedHandles = [] as HandleInfo[]
        let groupedHandles = {} as { [key: string]: HandleInfo[] }
        for (let handleInfo of handles) {
            if (handleInfo.group != undefined) {
                if (!groupedHandles[handleInfo.group]) {
                    groupedHandles[handleInfo.group] = [];
                }
                groupedHandles[handleInfo.group].push(handleInfo);
            } else {
                ungroupedHandles.push(handleInfo)
            }
        }

        const handleOffset = 1 / (1 + handles.length + (Object.keys(groupedHandles).length * 2));

        let handlePosition = 0;
        let elements = [];
        for (let handle of ungroupedHandles) {
            handlePosition += 1;
            elements.push(
                <Handle
                    key={handle.id} type={handleType} position={handleType == "target" ? Position.Left : Position.Right} id={handle.id}
                    className="px-1 flex items-center"
                    style={{top: `${handlePosition * handleOffset * 100}%`, backgroundColor: handle.optional ? HandleColours.Optional : HandleColours.Normal}}
                    title={handle.label}
                >
                    {truncateLabel(handle.label)}
                </Handle>
            );
        }

        for (let group in groupedHandles) {
            handlePosition += 1;

            let side = handleType == "source" ? "right" : "left";
            let sideCapital = handleType == "source" ? "Right" : "Left";
            elements.push(<div key={handlePosition} className="absolute -translate-y-1/2 bg-white z-10" style={{top: `${handlePosition * handleOffset * 100}%`, [side]: "0.5rem"}}>{group}</div>);
            elements.push(
                <div key={handlePosition + 0.5} className="absolute border-2 border-black rounded-lg w-14 z-0" style={{
                    top: `${handlePosition * handleOffset * 100}%`,
                    [side]: "0",
                    height: ((groupedHandles[group].length + 1) * handleOffset * 100) + "%",
                    ["border" + side]: "0",
                    ["borderTop" + sideCapital + "Radius"]: "0",
                    ["borderBottom" + sideCapital + "Radius"]: "0"
                }}/>
            )
            for (let handle of groupedHandles[group]) {
                handlePosition += 1;
                elements.push(
                    <Handle
                        key={handle.id} type={handleType} position={handleType == "target" ? Position.Left : Position.Right} id={handle.id}
                        className="px-1 flex items-center"
                        style={{top: `${handlePosition * handleOffset * 100}%`, backgroundColor: handle.optional ? HandleColours.Optional : HandleColours.Normal}}
                        title={handle.label}
                    >
                        {truncateLabel(handle.label)}
                    </Handle>
                );
            }
            handlePosition += 1;
        }

        return [elements, handlePosition];
    }

    let [sourceHandles, sourceHandleCount] = renderHandles(handles.source, "source");
    let [targetHandles, targetHandleCount] = renderHandles(handles.target, "target");

    const sideHandleCount = Math.max(sourceHandleCount, targetHandleCount);
    return (
        <div className={"flex flex-col bg-white gap-1 p-1 rounded border-[3px] " + borderColour}
             style={{
                 paddingLeft: paddingLeft,
                 paddingRight: paddingRight,
                 minHeight: ((sideHandleCount + 2) * 1.5) + "rem"
             }}
        >
            <div>{label}</div>
            <div className="flex flex-col gap-1 items-left">
                {children != undefined ? children : []}
            </div>
            {sourceHandles}
            {targetHandles}
        </div>
    );
}

/**
 * Datasource node for retrieving HTML
 *
 * HTTP calls are proxied through the server to avoid CORS issues
 *
 * This component is managed by ReactFlow and not directly instantiated itself.
 *
 * @param nodeID This node's ID
 * @param selected True if this node is selected, False otherwise
 * @param pipeValue Current data pipe state of this node
 * @param handles Handles of this node, initialized from {@link HTMLInputNode.handles}
 * @param onPipeUpdate Callback for updating pipe state
 * @constructor
 */
function HTMLInputNode({id: nodeID, selected, data: {pipeValue, handles, onPipeUpdate}}: { id: string, selected: boolean, data: NodeProperties }) {
    const inputID = useId();

    return (
        <BaseNode selected={selected} label={"HTML Input"} pipeValue={pipeValue} handles={handles}>
            <label htmlFor={inputID} hidden>URL</label>
            <input
                id={inputID}
                type="url"
                placeholder="URL"
                onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === "Enter") {
                        event.currentTarget.blur()
                    }
                }}
                onBlur={(event: React.FocusEvent<HTMLInputElement>) => {
                    if (event.currentTarget.validity.valid) {
                        client_fetch(nodeID, event.currentTarget.value)
                            .then((message) => {
                                const callback = mapMessage(message, (documentText) => {
                                    return (_input: { [key: string]: string[] }) => ({"html-out": [documentText]})
                                })
                                onPipeUpdate(callback)
                            });
                    } else {
                        onPipeUpdate({
                            fromNode: nodeID,
                            kind: PipeState.BadConfig
                        })
                    }
                }}
                pattern="https?:\/\/.+\..+"
                className="nodrag border-gray-500 border-2 rounded valid:border-green-500 valid:bg-green-200 invalid:border-red-500 invalid:bg-red-200 ps-2 placeholder-gray-500"
                required
            />
        </BaseNode>
    );
}

HTMLInputNode.displayName = "HTML Input";
HTMLInputNode.handles = {
    source: [{id: "html-out", label: "HTML"}],
    target: []
} as Handles

/**
 * Datasource node for static plaintext input
 *
 * This component is managed by ReactFlow and not directly instantiated itself.
 *
 * @param nodeID This node's ID
 * @param selected True if this node is selected, False otherwise
 * @param pipeValue Current data pipe state of this node
 * @param handles Handles of this node, initialized from {@link TextInputNode.handles}
 * @param onPipeUpdate Callback for updating pipe state
 * @constructor
 */
function TextInputNode({id: nodeID, selected, data: {pipeValue, handles, onPipeUpdate}}: { id: string, selected: boolean, data: NodeProperties }) {
    const inputID = useId();

    return (
        <BaseNode selected={selected} label={"Text Input"} pipeValue={pipeValue} handles={handles}>
            <label htmlFor={inputID} hidden>Text</label>
            <textarea
                id={inputID}
                placeholder="Text"
                onBlur={(event: React.FocusEvent<HTMLTextAreaElement>) => {
                    if (event.currentTarget.validity.valid) {
                        const text = event.currentTarget.value;
                        onPipeUpdate({
                            fromNode: nodeID,
                            kind: PipeState.Ok,
                            value: () => ({"text-out": [text]})
                        })
                    } else {
                        onPipeUpdate({
                            fromNode: nodeID,
                            kind: PipeState.BadConfig
                        })
                    }
                }}
                className="nodrag resize border-gray-500 border-2 rounded valid:border-green-500 valid:bg-green-200 invalid:border-red-500 invalid:bg-red-200 ps-2 placeholder-gray-500"
                required
            />
        </BaseNode>
    );
}

TextInputNode.displayName = "Text Input";
TextInputNode.handles = {
    source: [{id: "text-out", label: "Text"}],
    target: []
} as Handles

/**
 * Processing node for Regex matching
 *
 * Applies the specified regex against each input value, yielding matches (or captures)
 *
 * This component is managed by ReactFlow and not directly instantiated itself.
 *
 * @param nodeID This node's ID
 * @param selected True if this node is selected, False otherwise
 * @param pipeValue Current data pipe state of this node
 * @param handles Handles of this node, initialized from {@link RegexNode.handles}
 * @param onPipeUpdate Callback for updating pipe state
 * @constructor
 */
function RegexNode({id: nodeID, selected, data: {pipeValue, handles, onPipeUpdate}}: { id: string, selected: boolean, data: NodeProperties }) {
    const inputID = useId();
    const ignorecaseFlagID = useId();
    const multilineFlagID = useId();
    const dotallFlagID = useId();
    const unicodeFlagID = useId();

    const prevRegex = useRef("");
    const [regexString, setRegex] = useState(null as string | null);
    const [regexOptions, setOptions] = useState(
        {
            ignorecase: false,
            multiline: false,
            dotall: false,
            unicode: false
        } as { [key: string]: boolean }
    );

    const updateCheckbox = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const name = event.currentTarget.name;
        setOptions((options) => ({...options, [name]: !options[name]}))
    }, [])

    useEffect(() => {
        if (regexString != null) {
            try {
                let flags = "g"
                    + (regexOptions.ignorecase ? "i" : "")
                    + (regexOptions.multiline ? "m" : "")
                    + (regexOptions.dotall ? "s" : "")
                    + (regexOptions.unicode ? "u" : "");

                const regexp = new RegExp(regexString, flags);

                function map(input: { [key: string]: string[] }): { [key: string]: string[] } {
                    let {"data-in": values} = input;
                    const output = values.flatMap((value) => {
                        let out = [];
                        for (let match of value.matchAll(regexp)) {
                            if (match.length > 1) { // If using captures, skip 0th "global" capture group
                                out.push(...match.slice(1))
                            } else { // No capture groups; Push the global match
                                out.push(...match);
                            }
                        }
                        return out;
                    });
                    return {"data-out": output}
                }

                onPipeUpdate({
                    fromNode: nodeID,
                    kind: PipeState.Ok,
                    value: map
                })
            } catch (error) {
                onPipeUpdate({
                    fromNode: nodeID,
                    kind: PipeState.Err,
                    error: (error as Error).message
                })
            }
        } else {
            onPipeUpdate({
                fromNode: nodeID,
                kind: PipeState.BadConfig
            })
        }
    }, [regexString, regexOptions, onPipeUpdate, nodeID]);

    return (
        <BaseNode selected={selected} label={"Regex"} pipeValue={pipeValue} handles={handles}>
            <label htmlFor={inputID} hidden>Regex</label>
            <input
                id={inputID}
                name="regex"
                type="text"
                placeholder="regex"
                onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === "Enter") {
                        event.currentTarget.blur()
                    }
                }}
                onBlur={(event: React.FocusEvent<HTMLInputElement>) => {
                    const regex = event.currentTarget.value;
                    if (regex.length > 0 && regex != prevRegex.current) {   // onBlur fires if the user clicks out of the input, but reporting invalid input sets focus back on this input; If the input is unchanged, do nothing to drop focus
                        prevRegex.current = regex;
                        try {
                            new RegExp(regex);
                            setRegex(regex);
                            event.currentTarget.setCustomValidity("");
                            event.currentTarget.reportValidity();
                        } catch (e) {
                            console.log(e);
                            setRegex(null);
                            event.currentTarget.setCustomValidity("Invalid Regex");
                            event.currentTarget.reportValidity();
                        }
                    }
                }}
                className="nodrag border-gray-500 border-2 rounded valid:border-green-500  valid:bg-green-200 invalid:border-red-500 invalid:bg-red-200 ps-2"
                required
            />
            <div className="flex flex-row gap-1">
                <input type="checkbox" name="ignorecase" id={ignorecaseFlagID} checked={regexOptions.ignorecase} onChange={updateCheckbox}/>
                <label htmlFor={ignorecaseFlagID}>Ignore Case</label>
            </div>
            <div className="flex flex-row gap-1">
                <input type="checkbox" name="multiline" id={multilineFlagID} checked={regexOptions.multiline} onChange={updateCheckbox}/>
                <label htmlFor={multilineFlagID}>Multi-line</label>
            </div>
            <div className="flex flex-row gap-1">
                <input type="checkbox" name="dotall" id={dotallFlagID} checked={regexOptions.dotall} onChange={updateCheckbox}/>
                <label htmlFor={dotallFlagID}>Dot matches newline</label>
            </div>
            <div className="flex flex-row gap-1">
                <input type="checkbox" name="unicode" id={unicodeFlagID} checked={regexOptions.unicode} onChange={updateCheckbox}/>
                <label htmlFor={unicodeFlagID}>Unicode</label>
            </div>
        </BaseNode>
    );
}

RegexNode.displayName = "Regex";
RegexNode.handles = {
    source: [{id: "data-out", label: "OUT"}],
    target: [{id: "data-in", label: "IN"}]
} as Handles

enum ParseMode {
    HTML = "HTML",
    XML = "XML"
}

/**
 * Processing node for XPath matching
 *
 * Applies the specified XPath against the input, each input parsed as an XML or HTML document depending on user configuration.
 * If input is not valid XML or HTML, that input value is ignored.
 *
 * This component is managed by ReactFlow and not directly instantiated itself.
 *
 * @param nodeID This node's ID
 * @param selected True if this node is selected, False otherwise
 * @param pipeValue Current data pipe state of this node
 * @param handles Handles of this node, initialized from {@link XPathNode.handles}
 * @param onPipeUpdate Callback for updating pipe state
 * @constructor
 */
function XPathNode({id: nodeID, selected, data: {pipeValue, handles, onPipeUpdate}}: { id: string, selected: boolean, data: NodeProperties }) {
    const inputID = useId();
    const parseSelectID = useId();

    const prevXpath = useRef("");
    const [xpathString, setXPath] = useState(null as string | null);
    const [parseMode, setParseMode] = useState(ParseMode.HTML);

    useEffect(() => {
        if (xpathString != null) {
            try {
                function map(input: { [key: string]: string[] }): { [key: string]: string[] } {
                    let {"data-in": values} = input;
                    let output = [] as string[];
                    let parser = new DOMParser();

                    for (let value of values) {
                        try {
                            let document = parser.parseFromString(value, parseMode == ParseMode.HTML ? "text/html" : "text/xml");
                            let xPathResult = document.evaluate(xpathString as string, document, null, XPathResult.ANY_TYPE);

                            switch (xPathResult.resultType) {
                                case XPathResult.NUMBER_TYPE:
                                    output.push(xPathResult.numberValue.toString())
                                    break;
                                case XPathResult.STRING_TYPE:
                                    output.push(xPathResult.stringValue)
                                    break;
                                case XPathResult.BOOLEAN_TYPE:
                                    output.push(xPathResult.booleanValue.toString())
                                    break;
                                case XPathResult.UNORDERED_NODE_ITERATOR_TYPE:
                                    let node = xPathResult.iterateNext();
                                    while (node) {
                                        if (node instanceof Element) {
                                            output.push(node.outerHTML);
                                        } else if (node instanceof Text) {
                                            output.push(node.wholeText.trim());
                                        }
                                        node = xPathResult.iterateNext();
                                    }
                                    break;
                            }
                        } catch (e) {
                            // Silently drop input
                        }
                    }
                    return {"data-out": output}
                }

                onPipeUpdate({
                    fromNode: nodeID,
                    kind: PipeState.Ok,
                    value: map
                })
            } catch (error) {
                onPipeUpdate({
                    fromNode: nodeID,
                    kind: PipeState.Err,
                    error: (error as Error).message
                })
            }
        } else {
            onPipeUpdate({
                fromNode: nodeID,
                kind: PipeState.BadConfig
            })
        }
    }, [xpathString, parseMode, onPipeUpdate, nodeID]);

    return (
        <BaseNode selected={selected} label={"XPath"} pipeValue={pipeValue} handles={handles}>
            <label htmlFor={inputID} hidden>XPath</label>
            <input
                id={inputID}
                name="xpath"
                type="text"
                placeholder="XPath"
                onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === "Enter") {
                        event.currentTarget.blur()
                    }
                }}
                onBlur={(event: React.FocusEvent<HTMLInputElement>) => {
                    const xpath = event.currentTarget.value;
                    if (xpath.length > 0 && xpath != prevXpath.current) {   // onBlur fires if the user clicks out of the input, but reporting invalid input sets focus back on this input; If the input is unchanged, do nothing to drop focus
                        prevXpath.current = xpath;
                        try {
                            const emptyDocument = new Document();
                            emptyDocument.evaluate(xpath, emptyDocument);
                            setXPath(xpath);
                            event.currentTarget.setCustomValidity("");
                            event.currentTarget.reportValidity();
                        } catch (e) {
                            setXPath(null);
                            event.currentTarget.setCustomValidity("Invalid XPath");
                            event.currentTarget.reportValidity();
                        }
                    }
                }}
                className="nodrag border-gray-500 border-2 rounded valid:border-green-500  valid:bg-green-200 invalid:border-red-500 invalid:bg-red-200 ps-2"
                required
            />
            <div className="flex flex-row gap-1">
                <label htmlFor={parseSelectID}>Feed type</label>
                <select
                    id={parseSelectID}
                    name="parsemode"
                    placeholder="Parsing mode"
                    value={parseMode}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                        if (ParseMode[event.currentTarget.value as ParseMode]) {
                            setParseMode(event.currentTarget.value as ParseMode);
                        } else {
                            // Reset? Do nothing?
                        }
                    }}
                    className="nodrag border-gray-500 border-2 rounded ps-2"
                    required
                >
                    {
                        Object.entries(ParseMode)
                            .map(([index, label], key) => <option key={key} value={index}>{label}</option>)
                    }
                </select>
            </div>
        </BaseNode>
    );
}

XPathNode.displayName = "XPath";
XPathNode.handles = {
    source: [{id: "data-out", label: "OUT"}],
    target: [{id: "data-in", label: "IN"}]
} as Handles

enum FeedType {
    RSS = "RSS",
    Atom = "Atom"
}

/**
 * Output node
 *
 * Takes input and generates an RSS or Atom (depending on user configuration) web feed.
 *
 * The `feed-out` handle cannot be connected, and serves as final data output
 *
 * This component is managed by ReactFlow and not directly instantiated itself.
 *
 * @param nodeID This node's ID
 * @param selected True if this node is selected, False otherwise
 * @param pipeValue Current data pipe state of this node
 * @param handles Handles of this node, initialized from {@link FeedOutputNode.handles}
 * @param onPipeUpdate Callback for updating pipe state
 * @constructor
 */
function FeedOutputNode({id: nodeID, selected, data: {pipeValue, handles, onPipeUpdate}}: { id: string, selected: boolean, data: NodeProperties }) {
    const [feedType, setFeedType] = useState(FeedType.RSS);

    const feedTypeInputID = useId();

    useEffect(() => {
        try {
            function map(input: { [key: string]: string[] }): { [key: string]: string[] } {
                let {
                    "title": titleList,
                    "link": linkList,
                    "description": descriptionList,
                    "language": languageList,
                    "item-title": itemTitle,
                    "item-link": itemLink,
                    "item-description": itemDescription,
                    "item-author": itemAuthor
                } = input as {
                    title: string[],
                    link: string[],
                    description: string[],
                    language?: string[],
                    "item-title": string[],
                    "item-link": string[],
                    "item-description"?: string[],
                    "item-author"?: string[]
                };

                let [feedDocument, E] = newDocument();
                switch (feedType) {
                    case FeedType.Atom: {
                        let items = [] as Element[];

                        let itemCount = Math.max(itemTitle.length, itemDescription?.length ?? 0);
                        for (let i = 0; i < itemCount; i++) {
                            items.push(E("entry", [
                                ...itemTitle[i] != undefined ? [E("title", [], {type: "text"}, itemTitle[i])] : [],
                                ...itemLink[i] != undefined ? [E("link", [], {href: itemLink[i]})] : [],
                                ...itemDescription?.[i] != undefined ? [E("summary", [], {type: "text"}, itemDescription[i])] : [],
                                ...itemAuthor?.[i] != undefined ? [E("author", [E("name", [], {type: "text"}, itemAuthor[i])])] : [],
                            ]))
                        }

                        let rss = E(
                            "feed",
                            [
                                E("title", [], {type: "text"}, titleList[0]),
                                E("subtitle", [], {type: "text"}, descriptionList[0]),
                                E("link", [], {href: linkList[0]}),
                                ...items
                            ],
                            {
                                xmlns: "http://www.w3.org/2005/Atom",
                                ...languageList != undefined ? { lang: languageList[0]} : {}
                            }
                        );
                        feedDocument.appendChild(rss);
                        break;
                    }
                    case FeedType.RSS: {
                        let items = [] as Element[];

                        let itemCount = Math.max(itemTitle.length, itemDescription?.length ?? 0);
                        for (let i = 0; i < itemCount; i++) {
                            items.push(E("item", [
                                ...itemTitle[i] != undefined ? [E("title", [], {}, itemTitle[i])] : [],
                                ...itemLink[i] != undefined ? [E("link", [], {}, itemLink[i])] : [],
                                ...itemDescription?.[i] != undefined ? [E("description", [], {}, itemDescription[i])] : [],
                                ...itemAuthor?.[i] != undefined ? [E("author", [], {}, itemAuthor[i])] : [],
                            ]))
                        }

                        let rss = E("rss", [
                            E("channel", [
                                E("title", [], {}, titleList[0]),
                                E("link", [], {}, linkList[0]),
                                E("description", [], {}, descriptionList[0]),
                                ...languageList != undefined ? [E("language", [], {}, languageList[0])] : [],
                                ...items
                            ])
                        ]);
                        feedDocument.appendChild(rss);
                        break;
                    }
                }


                return {"feed-out": [new XMLSerializer().serializeToString(feedDocument)]}
            }

            onPipeUpdate({
                fromNode: nodeID,
                kind: PipeState.Ok,
                value: map
            })
        } catch (error) {
            onPipeUpdate({
                fromNode: nodeID,
                kind: PipeState.Err,
                error: (error as Error).message
            })
        }
    }, [feedType, nodeID, onPipeUpdate]);

    return (
        // Pass only the target "input" handles to rendering. Output is special-case invisible for this node.
        <BaseNode selected={selected} label={"Feed Output"} pipeValue={pipeValue} handles={{target: handles.target, source: []}}>
            <div className="flex gap-1">
                <label htmlFor={feedTypeInputID}>Feed type</label>
                <select
                    id={feedTypeInputID}
                    name="feedtype"
                    placeholder="Feed type"
                    value={feedType}
                    onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                        if (FeedType[event.currentTarget.value as FeedType]) {
                            setFeedType(event.currentTarget.value as FeedType);
                        } else {
                            // Reset? Do nothing?
                        }
                    }}
                    className="nodrag border-gray-500 border-2 rounded ps-2"
                    required
                >
                    {
                        Object.entries(FeedType)
                            .map(([index, label], key) => <option key={key} value={index}>{label}</option>)
                    }
                </select>
            </div>
        </BaseNode>
    );
}

FeedOutputNode.handles = {
    source: [{id: "feed-out", label: "Feed"}],
    target: [
        {id: "title", label: "Title", group: "feed"},
        {id: "link", label: "Link", group: "feed"},
        {id: "description", label: "Description", group: "feed"},
        {id: "language", label: "Language", group: "feed", optional: true},
        {id: "item-title", label: "Title", group: "item"},
        {id: "item-link", label: "Link", group: "item"},
        {id: "item-description", label: "Description", group: "item", optional: true},
        {id: "item-author", label: "Author", group: "item", optional: true},
    ]
} as Handles

/**
 * Export a mapping of nodeTypes for ReactFlow
 */
export const nodeTypes = {
    demoInputNode: DemoInputNode,
    htmlInputNode: HTMLInputNode,
    textInputNode: TextInputNode,
    regexNode: RegexNode,
    xpathNode: XPathNode,
    feedOutputNode: FeedOutputNode
};

/**
 * Generated mapping of nodeHandles, assumes each node React Component function has a 'handles' property
 */
export const nodeHandles: { [key: string]: Handles } = Object.fromEntries(
    Object.entries(nodeTypes)
        .map(([name, component]) => {
            if (component.handles != undefined) {
                return [name, component.handles];
            } else {
                throw new Error("Each node must have handles specified!")
            }
        })
)