import { Feed } from "./Feed";

export interface FeedItem {
    name: string;
    displayName: string;
    date: string;
    type: number;
    feed: Feed;
}
