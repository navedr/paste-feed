import linkifyHtml from "linkify-html";

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

export const YBFeedItemTextComponent = ({ content, type }: { content: string; type: string }) => {
    return (
        <div className="itemContainer">
            <div className="itemText">
                <pre
                    style={{ fontSize: "0.8em", whiteSpace: "break-spaces", wordWrap: "break-word" }}
                    dangerouslySetInnerHTML={{
                        __html: type === "json" ? syntaxHighlight(content) : linkifyHtml(content, { target: "_blank" }),
                    }}
                />
            </div>
        </div>
    );
};
