/**
 * Basic progress-alike element.
 *
 * HTML <progress>'s indeterminate state is broken when styled. This component has a basic indeterminate animation (in globals.css)
 *
 * @param value Number in range of 0 to 1 (inclusive), or null for indeterminate progress
 * @constructor
 */
export function Progress({value}: {value: number | null}) {
    if (typeof value == "number") {
        return (
            <div className="flex border-2 rounded border-blue-500 bg-blue-200 h-4">
                <div className="bg-blue-500" style={{ width: (100 * Math.max(Math.min(value, 1), 0)) + "%"}}></div>
            </div>
        )
    } else {
        return (
            <div className="flex border-2 rounded border-blue-500 bg-blue-200 h-4">
                <div className="bg-blue-500 progress-inner-animate"></div>
            </div>
        )
    }
}