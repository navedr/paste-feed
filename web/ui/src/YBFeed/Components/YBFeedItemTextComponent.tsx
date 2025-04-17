import React from "react";
import linkifyHtml from "linkify-html";
import highlighter from "highlight.js";
import "highlight.js/styles/github-dark.min.css";

const syntaxHighlight = (json: string) => {
    json = json.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        function (match) {
            var cls = "number";
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = "key";
                } else {
                    cls = "string";
                }
            } else if (/true|false/.test(match)) {
                cls = "boolean";
            } else if (/null/.test(match)) {
                cls = "null";
            }
            return linkifyHtml('<span class="' + cls + '">' + match + "</span>", { target: "_blank" });
        },
    );
};

function isValidUrl(str: string) {
    try {
        const url = new URL(str);
        return /^https?:\/\//.test(url.href); // Ensure it starts with http or https
    } catch (e) {
        return false;
    }
}

export const YBFeedItemTextComponent = ({ content, type }: { content: string; type: string }) => {
    React.useEffect(() => {
        highlighter.configure({ ignoreUnescapedHTML: true, noHighlightRe: /https?:\/\/[^\s]+/g });
    }, []);

    return (
        <div className="itemContainer">
            <div className="itemText">
                <pre
                    style={{ fontSize: "0.8em", whiteSpace: "break-spaces", wordWrap: "break-word" }}
                    dangerouslySetInnerHTML={{
                        __html:
                            type === "json"
                                ? syntaxHighlight(content)
                                : isValidUrl(content)
                                  ? linkifyHtml(content, { target: "_blank" })
                                  : linkifyHtml(highlighter.highlightAuto(content).value, { target: "_blank" }),
                    }}
                />
            </div>
        </div>
    );
};
