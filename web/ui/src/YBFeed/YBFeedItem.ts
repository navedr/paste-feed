import { YBFeed } from "./YBFeed";

export interface YBFeedItem {
    name: string;
    displayName: string;
    date: string;
    type: number;
    feed: YBFeed;
}
