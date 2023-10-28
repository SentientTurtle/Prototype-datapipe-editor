/**
 * Utility to build XML documents
 *
 * Returns a tuple of the newly created XMLDocument, and a function to create elements (See {@link createElement})
 */
export function newDocument(): [XMLDocument, (name: string, children?: Element[], attributes?: {[key: string]: string}, text?: string) => Element] {
    let xmlDocument = document.implementation.createDocument(null, null);

    /**
     * Creates a new element within the parent document
     * @param name Tag name for this element
     * @param children Children of this element, if any. Usually created by another invocation of this function.
     * @param attributes Attributes of this element, if any.
     * @param text Text content of this element, set through {@link XMLDocument.createTextNode}
     */
    function createElement(name: string, children?: Element[], attributes?: {[key: string]: string}, text?: string): Element {
        let element: Element = xmlDocument.createElement(name);
        if (children != undefined) {
            for (const child of children) {
                element.appendChild(child);
            }
        }
        if (attributes != undefined) {
            for (let attributeName in attributes) {
                element.setAttribute(attributeName, attributes[attributeName])
            }
        }
        if (text != undefined) {
            let textNode = xmlDocument.createTextNode(text);
            element.appendChild(textNode);
        }
        return element;
    }

    return [xmlDocument, createElement];
}