import { APIClient } from "./APIClient";

class FeedClient extends APIClient {
    constructor() {
        super("/api");
    }
}

export const Y = new FeedClient();
