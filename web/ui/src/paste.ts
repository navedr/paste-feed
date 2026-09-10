import { Y } from "./FeedClient";

export function clipboardFiles(event: ClipboardEvent): File[] {
    const clipboard = event.clipboardData;
    if (!clipboard) return [];
    const files = Array.from(clipboard.items)
        .filter(item => item.kind === "file")
        .map(item => item.getAsFile())
        .filter((file): file is File => file !== null);
    if (files.length) return files;
    const text = clipboard.getData("text/plain") || clipboard.getData("text");
    return text ? [new File([text], "Pasted Text.txt", { type: "text/plain" })] : [];
}

export const PasteToFeed = (event: ClipboardEvent, feedName: string) =>
    Promise.all(clipboardFiles(event).map(file => {
        const formData = new FormData();
        formData.append("file", file);
        return Y.post("/feeds/" + encodeURIComponent(feedName), formData);
    }));
