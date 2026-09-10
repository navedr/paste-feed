import { FeedItem } from "./FeedItem";

export class FeedError extends Error {
    status: number;
    constructor(status: number, message?: string) {
        super(message);
        this.status = status;
    }
}

export class Feed {
    name: string;
    secret: string | undefined;
    items: FeedItem[];
    vapidpublickey: string | undefined;
    constructor(name: string) {
        this.name = name;
        this.items = [];
    }
    webSocketUrl(): string {
        const path = window.location.origin + "/ws/" + self.name;
        return path;
    }
}
