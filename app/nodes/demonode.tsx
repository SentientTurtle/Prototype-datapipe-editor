import {BaseNode, Handles, NodeProperties} from "@/app/nodes/nodes";
import React, {useEffect} from "react";
import {PipeState} from "@/app/feed/pipe";

const DEMO_DOCUMENT = `
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>
            Demo Document
        </title>
    </head>
    <body>
        <div class="column">
            <div class="title">
                Demo Document
            </div>
            <div class="navbar">
                <button>Navigation 1</button>
                <button>Navigation 2</button>
                <button>Navigation 3</button>
            </div>
            <div class="content">
                <div class="item">
                    <div class="item-title">
                        Item 1
                    </div>
                    <div class="item-author">
                        Author
                    </div>
                    <div class="item-content">
                        Lorem ipsum
                    </div>
                    <a class="item-link" href="http://demo.example/item1.html">http://demo.example/item1.html</a>
                </div>
                <div class="item">
                    <div class="item-title">
                        Item 2
                    </div>
                    <div class="item-author">
                        Author
                    </div>
                    <div class="item-content">
                        dolor sit amet
                    </div>
                    <a class="item-link" href="http://demo.example/item2.html">http://demo.example/item2.html</a>
                </div>
                <div class="item">
                    <div class="item-title">
                        Item 3
                    </div>
                    <div class="item-author">
                        Author
                    </div>
                    <div class="item-content">
                        consectetur adipiscing elit
                    </div>
                    <a class="item-link" href="http://demo.example/item3.html">http://demo.example/item3.html</a>
                </div>
            </div>
        </div>
    </body>
</html>
`

/**
 * Datasource node for demo use; Provides the above static HTML document as input.
 * HTMLInputNode is constrained by CORS rules when in client mode.
 *
 * This component is managed by ReactFlow and not directly instantiated itself.
 *
 * @param nodeID This node's ID
 * @param selected True if this node is selected, False otherwise
 * @param pipeValue Current data pipe state of this node
 * @param handles Handles of this node, initialized from {@link DemoInputNode.handles}
 * @param onPipeUpdate Callback for updating pipe state
 * @constructor
 */
export function DemoInputNode({id: nodeID, selected, data: {pipeValue, handles, onPipeUpdate}}: { id: string, selected: boolean, data: NodeProperties }) {
    useEffect(() => {
        if (pipeValue.kind != PipeState.Ok) {
            onPipeUpdate({fromNode: nodeID, kind: PipeState.Ok, value: input => ({"text-out": [DEMO_DOCUMENT]})})
        }
    });

    return (
        <BaseNode selected={selected} label={"Demo Document Input"} pipeValue={pipeValue} handles={handles}/>
    );
}

DemoInputNode.displayName = "Demo Document Input";
DemoInputNode.handles = {
    source: [{id: "text-out", label: "HTML"}],
    target: []
} as Handles