"use client";

import React, {ReactNode, useCallback, useRef, useState} from 'react';
import ReactFlow, {addEdge, applyEdgeChanges, applyNodeChanges, Background, BackgroundVariant, Connection, Controls, Edge, EdgeChange, Node, NodeChange,} from 'reactflow';

import 'reactflow/dist/style.css';
import {HandleColours, HandleInfo, nodeHandles, NodeProperties, nodeTypes} from "@/app/nodes/nodes";
import {PipeMapper, PipeMessage, PipeState} from "@/app/feed/pipe";

/**
 * Create a new ReactFlow-compliant Node object
 *
 * @param id ID for this node
 * @param type Node type
 * @param position Display position for this node
 * @param deletable If true, node can be deleted by the user
 * @param onPipeUpdate Callback for updating pipe state
 */
function newNode(
    id: string,
    type: string,
    position: { x: number, y: number },
    deletable: boolean,
    onPipeUpdate: (message: PipeMessage<PipeMapper>) => void
): Node<NodeProperties> {
    return {
        id: id,
        type: type,
        position: position,
        deletable: deletable,
        data: {
            pipeValue: {kind: PipeState.BadConfig},
            onPipeUpdate: onPipeUpdate,
            handles: nodeHandles[type]
        }
    }
}

/**
 * Inspection box message, displays a simple text message centered within parent
 * @param isError If true, the message is styled as an error (Default: false)
 * @param children Content of message, usually simple text
 * @constructor
 */
function InspectBoxMessage({isError = false, children}: { isError?: boolean, children: ReactNode }) {
    if (isError) {
        return (
            <div className="flex flex-col w-full p-1 items-center justify-center">
                <div className="p-1 rounded bg-red-50 border-red-500 border-2 flex flex-col items-center justify-center">
                    {children}
                </div>
            </div>
        )
    } else {
        return (
            <div className="flex flex-col w-full p-1 items-center justify-center">
                <div className="p-1 rounded flex flex-col items-center justify-center bg-gray-50">
                    {children}
                </div>
            </div>
        )
    }
}

/**
 * Editor's node selection bar
 * @param nodeTypes Array of node types and their displayName (These can be derived from {@link nodeTypes}
 * @param addNode Callback to add a node
 * @constructor
 */
function NodeBar({nodeTypes, addNode}: { nodeTypes: [string, string][], addNode: (nodeType: string) => void }) {
    return (
        <div className="flex flex-wrap divide-x divide-gray-900">
            {nodeTypes.map(([nodeType, nodeName], idx) => {
                return <button
                    className="flex-grow bg-gray-400 hover:bg-gray-500"
                    key={idx}
                    onClick={() => addNode(nodeType)}
                >
                    {nodeName}
                </button>
            })}
        </div>
    )
}

/**
 * Inspection box data preview
 * @param handles Handles for which to show data, if any data is not present in `pipe` it will be listed as absent, obtained from {@link NodeProperties.handles}
 * @param pipe Data pipe to preview
 * @constructor
 */
function InspectBoxPreview({handles, pipe}: { handles: HandleInfo[], pipe: { [key: string]: string[] } }) {
    let ungroupedHandles = [] as HandleInfo[];
    let groupedHandles = {} as { [key: string]: HandleInfo[] };

    for (let handle of handles) {
        if (handle.group == undefined) {
            ungroupedHandles.push(handle);
        } else {
            (groupedHandles[handle.group] = (groupedHandles[handle.group] ?? []))
                .push(handle);
        }
    }

    /**
     * Render a single group of nodes
     * @param handles Subset of handles to render as a group
     * @param pipe Pipe value from {@link InspectBoxPreview} parameters
     */
    function renderGroup(handles: HandleInfo[], pipe: { [key: string]: string[] }) {
        return handles.map((handle) => {
            let handleColor = handle.optional ? HandleColours.Optional : HandleColours.Normal;
            let values = pipe[handle.id];
            if (values == undefined && !(handle.optional)) {
                return <div key={handle.id} className="border-2 flex flex-col items-start w-full" style={{borderColor: handleColor}}>
                    <div className="p-1 rounded-br text-white" style={{backgroundColor: handleColor}}>{handle.label}</div>
                    <div className="flex flex-col w-full p-1 items-start justify-center">
                        <div className="p-1 rounded bg-red-50 border-red-500 border-2 flex flex-col items-center justify-center">
                            Input Missing
                        </div>
                    </div>
                </div>
            } else if (values == undefined && handle.optional) {
                return <div key={handle.id} className="border-2 flex flex-col items-start w-full" style={{borderColor: handleColor}}>
                    <div className="p-1 rounded-br text-white" style={{backgroundColor: handleColor}}>{handle.label}</div>
                    <div className="flex flex-col w-full p-1 items-start justify-center">
                        <div className="p-1 rounded bg-gray-50 flex flex-col items-center justify-center">
                            No Input
                        </div>
                    </div>
                </div>
            } else {
                return <div key={handle.id} className="border-2 flex flex-col items-start w-full" style={{borderColor: handleColor}}>
                    <div className="p-1 rounded-br text-white" style={{backgroundColor: handleColor}}>{handle.label}</div>
                    <div className="flex flex-col w-full divide-y-2 divide-gray-400">
                        {
                            values.map((valueString, idx) => {
                                if (valueString.length == 0) {
                                    return <div key={idx} className="m-1"><i>&lt;empty string&gt;</i></div>
                                } else if (valueString.trim().length == 0) {
                                    if (valueString.length != 1) {
                                        return <div key={idx} className="m-1"><i>&lt;space ×{valueString.length}&gt;</i></div>
                                    } else {
                                        return <div key={idx} className="m-1"><i>&lt;space&gt;</i></div>
                                    }
                                } else {
                                    return <div key={idx} className="m-1">{valueString}</div>
                                }
                            })
                        }
                    </div>
                </div>
            }
        });
    }

    return [
        ...renderGroup(ungroupedHandles, pipe),
        Object.entries(groupedHandles)
            .map(([group, handles]) => {
                return <div key={group} className="border-blue-400 border-2 flex flex-col items-start w-full">
                    <div className="p-1 bg-blue-400 rounded-br">{group}</div>
                    <div className="flex flex-col w-full items-center justify-center gap-1">
                        {renderGroup(handles, pipe)}
                    </div>
                </div>
            })
    ];
}

/**
 * Type for "nodes" React state in {@link Home}
 */
interface Nodes {
    [key: string]: Node<NodeProperties>
}

/**
 * Main editor page component
 * @constructor
 */
export default function Home() {
    /**
     * Callback that handles node pipe updates, passed into {@link NodeProperties.onPipeUpdate}
     */
    const handleNodeMessage = useCallback((message: PipeMessage<PipeMapper>) => {
        pipeCacheValid.current = false;
        switch (message.kind) {
            case PipeState.Ok:
                setNodes((nodes) => ({
                    ...nodes,
                    [message.fromNode]: {
                        ...nodes[message.fromNode],
                        data: {
                            ...nodes[message.fromNode].data,
                            pipeValue: {
                                kind: PipeState.Ok,
                                mapper: message.value
                            }
                        }
                    }
                }));
                break;
            case PipeState.BadConfig:
                setNodes((nodes) => ({
                    ...nodes,
                    [message.fromNode]: {
                        ...nodes[message.fromNode],
                        data: {
                            ...nodes[message.fromNode].data,
                            pipeValue: {kind: PipeState.BadConfig}
                        }
                    }
                }));
                break;
            case PipeState.Err:
                setNodes((nodes) => ({
                    ...nodes,
                    [message.fromNode]: {
                        ...nodes[message.fromNode],
                        data: {
                            ...nodes[message.fromNode].data,
                            pipeValue: {
                                kind: PipeState.Err,
                                error: message.error
                            }
                        }
                    }
                }));
                break;
        }
    }, [])

    /**
     * Current nodeID; Node IDs must be unique so we simply increment this number for every new node to obtain a unique ID
     */
    const currentNodeId = useRef(0);

    /**
     * Editor is initialized to only having a Feed output node
     */
    const initialNodes: Nodes = {"Feed": newNode("Feed", "feedOutputNode", {x: 600, y: 50}, false, handleNodeMessage)}

    /**
     * State containing ReactFlow nodes
     */
    const [nodes, setNodes] = useState(initialNodes);
    const [edges, setEdges] = useState([] as Edge[]);

    /**
     * ReactFlow callback handling node changes
     */
    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            // If these changes add or remove a node, invalidate pipe data cache
            if (changes.some((change) => change.type == "remove" || change.type == "add")) {
                pipeCacheValid.current = false;
            }
            setNodes(
                (nds) =>
                    applyNodeChanges(changes, Object.values(nds))
                        .reduce((prev: Nodes, curr) => ({...prev, [curr.id]: curr}), {})
            )
        },
        [setNodes]
    );

    /**
     * ReactFlow callback handling edge changes
     */
    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            // If these changes add or remove an edge, invalidate pipe data cache
            if (changes.some((change) => change.type == "remove" || change.type == "add")) {    // Maybe also reset type?
                pipeCacheValid.current = false;
            }
            setEdges((eds) => applyEdgeChanges(changes, eds))
        },
        [setEdges]
    );

    /**
     * ReactFlow callback handling edge additions
     */
    const onConnect = useCallback((newEdge: Edge | Connection) => {
        // Do not add edges targeting itself
        if (newEdge.source == newEdge.target) {
            return;
        }

        setEdges((edges) => {
            // Do not add duplicate edges
            for (const edge of edges) {
                if (
                    edge.source == newEdge.source
                    && edge.target == newEdge.target
                    && edge.sourceHandle == newEdge.sourceHandle
                    && edge.targetHandle == newEdge.targetHandle
                ) {
                    return edges;
                }
            }

            // @ts-ignore
            newEdge.animated = true;
            // Invalidate pipe data cache as we are adding a new edge
            pipeCacheValid.current = false;
            return addEdge(newEdge, edges);
        })
    }, [setEdges]);

    type CacheEntry = OutputCacheEntry | ErrorCacheEntry;

    type OutputCacheEntry = {
        kind: "output",
        input: { [key: string]: string[] },
        output: { [key: string]: string[] },
    }

    type ErrorCacheEntry = {
        kind: "error",
        input: { [key: string]: string[] },
        error: string
    }

    /**
     * Cache for data pipe values.
     *
     * Has manual invalidation; ReactFlow fires a lot of state changes (once per frame when dragging nodes) and recalculating the dataflow is rather costly
     */
    const pipeCache = useRef({} as { [key: string]: CacheEntry });
    const pipeCacheValid = useRef(false);

    const loadCache = useCallback((nodeID: string): CacheEntry => {
        if (pipeCache.current[nodeID]) {
            return pipeCache.current[nodeID];
        } else {
            let inputHandles = nodes[nodeID].data.handles.target;

            let inputData = {} as { [key: string]: string[] };
            for (let edge of edges) {
                if (edge.target == nodeID) {
                    // @ts-ignore
                    const handleInput = loadCache(edge.source).output?.[edge.sourceHandle as string];
                    if (handleInput != undefined) {
                        // Multiple inputs get appended
                        if (inputData[edge.targetHandle as string]) {
                            inputData[edge.targetHandle as string].push(...handleInput);
                        } else {
                            inputData[edge.targetHandle as string] = handleInput;
                        }
                    }
                }
            }

            let outputHandles = nodes[nodeID].data.handles.source;
            let pipeValue = nodes[nodeID].data.pipeValue;
            let cacheEntry: CacheEntry;
            calcCache:
                switch (pipeValue.kind) {
                    case PipeState.BadConfig:
                        cacheEntry = {
                            kind: "error",
                            input: inputData,
                            error: "Node configuration is invalid"
                        };
                        break
                    case PipeState.Err:
                        cacheEntry = {
                            kind: "error",
                            input: inputData,
                            error: pipeValue.error
                        };
                        break;
                    case PipeState.Ok:
                        for (let handle of inputHandles) {
                            if ((!handle.optional) && (inputData[handle.id] == undefined || inputData[handle.id].length == 0)) {
                                cacheEntry = {
                                    kind: "error",
                                    input: inputData,
                                    error: "Missing input"
                                };
                                break calcCache;
                            }
                        }
                        try {
                            const outputData = pipeValue.mapper(inputData);
                            for (let handle of outputHandles) {
                                if (outputData[handle.id] == undefined) {
                                    // Missing output is a fault in the implementation of Node
                                    // noinspection ExceptionCaughtLocallyJS; We have to catch any errors originating from the node's data mapper anyway
                                    throw new Error("Missing output data for node " + nodeID + " handle " + handle.id);
                                }
                            }
                            cacheEntry = {
                                kind: "output",
                                input: inputData,
                                output: outputData
                            };
                        } catch (e) {
                            console.log("ERR in node implementation: ", e);
                            cacheEntry = {
                                kind: "error",
                                input: inputData,
                                error: "Error in node implementation"
                            };
                            break;
                        }
                        break;
                }

            pipeCache.current[nodeID] = cacheEntry;
            return cacheEntry;
        }
    }, [edges, nodes]);

    // If cache has been marked invalid, re-calculate it
    if (!pipeCacheValid.current) {
        pipeCache.current = {};
        for (let nodeID in nodes) {
            loadCache(nodeID);
        }
        pipeCacheValid.current = true;
    }

    /**
     * List of currently selected nodes, may be more than one node
     */
    const selectedNodes = Object.values(nodes).filter((node) => node.selected).map((node) => node.id);

    return (
        <div className="flex flex-col h-screen w-screen">
            <div className="flex flex-row resize-y overflow-auto h-2/4 justify-center">
                {(() => {
                    if (selectedNodes.length == 1) {
                        const [nodeID] = selectedNodes;
                        const selectedNode = nodes[nodeID];
                        const cacheEntry = (pipeCache.current)[nodeID] as CacheEntry | undefined;

                        if (cacheEntry == undefined) {
                            // Unreachable; All nodes should have a cache entry, containing any applicable error
                            return (<InspectBoxMessage isError={true}>Internal error: No cache</InspectBoxMessage>);
                        } else {
                            let inspectbox = [] as ReactNode[];
                            const showInput = selectedNode.data.handles.target.length > 0;

                            if (showInput) {
                                inspectbox.push(
                                    <div key={1} className="flex flex-col gap-2 pt-2 resize-x w-2/4 overflow-y-scroll overflow-x-clip break-all items-center">
                                        <div className="px-1 rounded bg-gray-50">Input</div>
                                        <InspectBoxPreview handles={selectedNode.data.handles.target} pipe={cacheEntry.input}/>
                                    </div>
                                );
                            }

                            switch (cacheEntry.kind) {
                                case "output":
                                    if (showInput) {
                                        inspectbox.push(
                                            <div key={2} className="flex flex-col gap-2 pt-2 grow resize-width-zero overflow-y-scroll overflow-x-clip break-all items-center">
                                                <div className="px-1 rounded bg-gray-50">Output</div>
                                                <InspectBoxPreview handles={selectedNode.data.handles.source} pipe={cacheEntry.output}/>
                                            </div>
                                        );
                                    } else {
                                        inspectbox.push(
                                            <div key={2} className="flex flex-col gap-2 pt-2 w-2/4 overflow-y-scroll overflow-x-clip break-all items-center">
                                                <div className="px-1 rounded bg-gray-50">Output</div>
                                                <InspectBoxPreview handles={selectedNode.data.handles.source} pipe={cacheEntry.output}/>
                                            </div>
                                        );
                                    }
                                    break;
                                case "error":
                                    if (showInput) {
                                        inspectbox.push(
                                            <div key={2} className="flex flex-col gap-2 pt-2 grow resize-width-zero overflow-y-scroll overflow-x-clip break-all items-center">
                                                <div className="px-1 rounded bg-gray-50">Output</div>
                                                <InspectBoxMessage isError={true}>
                                                    <div className="bg-red-400 text-white rounded px-2">Error</div>
                                                    <div>{cacheEntry.error}</div>
                                                </InspectBoxMessage>
                                            </div>
                                        );
                                    } else {
                                        inspectbox.push(
                                            <div key={2} className="flex flex-col gap-2 pt-2 w-2/4 overflow-y-scroll overflow-x-clip break-all items-center">
                                                <div className="px-1 rounded bg-gray-50">Output</div>
                                                <InspectBoxMessage isError={true}>
                                                    <div className="bg-red-400 text-white rounded px-2">Error</div>
                                                    <div>{cacheEntry.error}</div>
                                                </InspectBoxMessage>
                                            </div>
                                        );
                                    }
                                    break;
                            }

                            return inspectbox;
                        }
                    } else {
                        return (<InspectBoxMessage>Select a node</InspectBoxMessage>);
                    }
                })()}
            </div>
            <NodeBar
                nodeTypes={
                    Object.entries(nodeTypes)
                        .flatMap(([nodeType, nodeFn]) => {
                            if (nodeType == "feedOutputNode") {
                                return [];
                            } else {
                                // @ts-ignore;  Not all nodes have a displayName, but we check it to be not-undefined
                                if (nodeFn.displayName != undefined) {
                                    // @ts-ignore;  See above
                                    return [[nodeType, nodeFn.displayName]];
                                } else if (nodeFn.name != "anonymous" && nodeFn.name.length > 0) {
                                    return [[nodeType, nodeFn.name]];
                                } else {
                                    return [[nodeType, nodeType]];
                                }
                            }
                        })
                }
                addNode={(nodeType: string) => {
                    const nodeId = currentNodeId.current++;
                    onNodesChange([{
                        type: "add",
                        item: newNode(nodeId.toString(), nodeType, {x: 100 + (25 * (nodeId % 10)), y: 100 + (25 * (nodeId % 10))}, true, handleNodeMessage)
                    }])
                }}
            />
            <ReactFlow
                className="bg-gray-50 grow resize-height-zero"
                nodeTypes={nodeTypes}
                nodes={Object.values(nodes)}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                deleteKeyCode={["Backspace", "Delete"]}
            >
                <Controls/>
                <Background variant={BackgroundVariant.Dots} gap={12} size={1}/>
            </ReactFlow>
        </div>
    )
}
