import { AxiosResponseHeaders } from "axios";
import { Feed, FeedItem, FeedError } from ".";
import { Y } from "../FeedClient";

class FeedConnector {
    feedUrl(feedName: string): string {
        return "/api/feeds/" + encodeURIComponent(feedName);
    }
    async Ping(): Promise<AxiosResponseHeaders> {
        return new Promise((resolve, reject) => {
            Y.request({
                url: "/api",
                method: "GET",
            })
                // fetch("/api",{
                //     credentials: "include"
                // })
                .then(f => {
                    if (f) {
                        f.headers.then((h: AxiosResponseHeaders) => {
                            resolve(h);
                        });
                    }
                })
                .catch(e => reject(e));
        });
    }
    async GetFeed(feedName: string): Promise<Feed | null> {
        return new Promise((resolve, reject) => {
            Y.get("/feeds/" + encodeURIComponent(feedName))
                .then(f => {
                    resolve(f as Feed);
                })

                .catch(e => {
                    console.log(e);
                    reject(new FeedError(e.status, "Server Unavailable"));
                });
        });
    }
    async AuthenticateFeed(feedName: string, secret: string): Promise<string | FeedError> {
        return new Promise((resolve, reject) => {
            Y.get("/feeds/" + encodeURIComponent(feedName) + "?secret=" + encodeURIComponent(secret))
                .then(f => {
                    const fe = f as Feed;
                    if (fe.secret) {
                        resolve(fe.secret);
                    }
                })
                .catch(error => {
                    if (error.status === 401) {
                        reject(new FeedError(401, "Unauthorized"));
                    } else {
                        reject(new FeedError(error.status, "Server Unavailable"));
                    }
                });
        });
    }
    async GetItem(item: FeedItem): Promise<string> {
        return new Promise((resolve, reject) => {
            Y.get("/feeds/" + encodeURIComponent(item.feed.name) + "/items/" + item.name)
                .then(i => {
                    resolve(i as string);
                })
                .catch(error => {
                    reject(new FeedError(error.status, "Error while getting item"));
                });

            // fetch(this.feedUrl(item.feed.name)+"/items/"+item.name,{
            //     credentials: "include"
            // })
            // .then(r => {
            //     if (r.status !== 200) {
            //         reject(new FeedError(r.status, "Error while getting item"))
            //     }
            //     r.text()
            //     .then(t => {
            //         resolve(t)
            //     })
            //     .catch(e => {
            //         reject(new FeedError(e.status, "Error while getting item"))
            //     })
            // })
        });
    }
    async DeleteItem(item: FeedItem) {
        return new Promise((resolve, reject) => {
            Y.delete("/feeds/" + encodeURIComponent(item.feed.name) + "/items/" + encodeURIComponent(item.name))
                .then(() => {
                    resolve(true);
                })
                .catch(error => {
                    reject(new FeedError(error.status, "Error while getting item"));
                });

            // fetch(this.feedUrl(item.feed.name)+"/items/"+encodeURIComponent(item.name),{
            //     method: "DELETE",
            //     credentials: "include"
            // })
            // .then((f) => {
            //     if (f.status !== 200) {
            //         f.text()
            //         .then(text => {
            //             reject(new FeedError(f.status, text))
            //         })
            //         .catch(() => {
            //             reject(new FeedError(f.status, "Server Unavailable"))
            //         })
            //     } else {
            //         resolve(true)
            //     }
            // })
        });
    }
    async EmptyFeed(feedName: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            Y.delete("/feeds/" + encodeURIComponent(feedName) + "/items")
                .then(() => {
                    resolve(true);
                })
                .catch(error => {
                    reject(new FeedError(error.status, "Error while deleting item"));
                });

            // fetch(this.feedUrl(feedName)+
            //     "/items",{
            //     method: "DELETE",
            //     credentials: "include"
            // })
            // .then((f) => {
            //     if (f.status !== 200) {
            //         f.text()
            //         .then(text => {
            //             reject(new FeedError(f.status, text))
            //         })
            //         .catch(() => {
            //             reject(new FeedError(f.status, "Server Unavailable"))
            //         })
            //     } else {
            //         resolve(true)
            //     }
            // })
        });
    }

    async SetPIN(feedName: string, pin: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            Y.patch("/feeds/" + encodeURIComponent(feedName), pin)
                .then(() => {
                    resolve(true);
                })
                .catch(error => {
                    reject(new FeedError(error.status, "Error while setting PIN"));
                });

            // fetch(this.feedUrl(feedName),{
            //     method: "PATCH",
            //     credentials: "include",
            //     body: pin
            // })
            // .then((f) => {
            //     if (f.status !== 200) {
            //         f.text().then((b) => {
            //             reject(new FeedError(f.status, b))
            //         })
            //         .catch(() => {
            //             reject(new FeedError(f.status, "Server Unavailable"))
            //         })
            //     }
            //     resolve(true)
            // })
            // .catch((e) => {
            //     reject(new FeedError(e.status, "Server Unavailable"))
            // })
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async AddSubscription(feedName: string, subscription: any): Promise<boolean> {
        return new Promise((resolve, reject) => {
            Y.post("/feeds/" + encodeURIComponent(feedName) + "/subscription", subscription)
                .then(() => {
                    resolve(true);
                })
                .catch(error => {
                    reject(new FeedError(error.status, "Error while adding subscription"));
                });

            // fetch(this.feedUrl(feedName)+"/subscription",{
            //     method: "POST",
            //     credentials: "include",
            //     body: subscription
            // })
            // .then((f) => {
            //     if (f.status !== 200) {
            //         f.text().then((b) => {
            //             reject(new FeedError(f.status, b))
            //         })
            //         .catch(() => {
            //             reject(new FeedError(f.status, "Server Unavailable"))
            //         })
            //     }
            //     resolve(true)
            // })
            // .catch((e) => {
            //     reject(new FeedError(e.status, "Server Unavailable"))
            // })
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async RemoveSubscription(feedName: string, subscription: any): Promise<boolean> {
        return new Promise((resolve, reject) => {
            Y.delete("/feeds/" + encodeURIComponent(feedName) + "/subscription", subscription)
                .then(() => {
                    resolve(true);
                })
                .catch(error => {
                    reject(new FeedError(error.status, "Error while adding subscription"));
                });

            // fetch(this.feedUrl(feedName)+"/subscription",{
            //     method: "DELETE",
            //     credentials: "include",
            //     body: subscription
            // })
            // .then((f) => {
            //     if (f.status !== 200) {
            //         f.text().then((b) => {
            //             reject(new FeedError(f.status, b))
            //         })
            //         .catch(() => {
            //             reject(new FeedError(f.status, "Server Unavailable"))
            //         })
            //     }
            //     resolve(true)
            // })
            // .catch((e) => {
            //     reject(new FeedError(e.status, "Server Unavailable"))
            // })
        });
    }

    async UpdateItem(item: FeedItem, newName: string): Promise<{ originalName: string; displayName: string }> {
        return new Promise((resolve, reject) => {
            Y.post("/feeds/" + encodeURIComponent(item.feed.name) + "/items/" + encodeURIComponent(item.name), {
                name: newName,
            })
                .then(response => {
                    resolve(response as { originalName: string; displayName: string });
                })
                .catch(error => {
                    reject(new FeedError(error.status, "Error updating item name"));
                });
        });
    }
}

export const Connector = new FeedConnector();
