import { createContext, useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Space, TextInput, Box } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { FeedItemComponent } from ".";
import { Connector, Feed, FeedItem } from "../";
import { useNavigate } from "react-router-dom";

export const FeedItemContext = createContext<undefined | FeedItem>(undefined);

export interface FeedItemsComponentProps {
    feedName: string;
    secret: string;
    onDelete?: (item: FeedItem) => void;
    setEmpty?: (arg0: boolean) => void;
}

export interface FeedItemsComponentHandle {
    refreshItems: () => void;
}

export const FeedItemsComponent = forwardRef<FeedItemsComponentHandle, FeedItemsComponentProps>(
    function FeedItemsComponent(props, ref) {
        const { feedName, secret } = props;

        const navigate = useNavigate();
        const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
        const [searchTerm, setSearchTerm] = useState<string>("");
        // Setup websocket to receive feed events
        const ws = useRef<WebSocket | null>(null);

        useImperativeHandle(ref, () => ({
            refreshItems: () => ws.current && ws.current.readyState === WebSocket.OPEN && ws.current.send("feed"),
        }));

        // Do the actual item deletion callback
        const deleteItem = (item: FeedItem) => {
            Connector.DeleteItem(item);
        };

        const removeItem = (item: FeedItem) => {
            const newI = feedItems.filter(i => i.name !== item.name);
            setFeedItems(newI);
            props.setEmpty && props.setEmpty(newI.length === 0);
            props.setEmpty && props.setEmpty(newI.length === 0);
        };

        const addItem = (item: FeedItem) => {
            setFeedItems(items => [item].concat(items));
            props.setEmpty && props.setEmpty(false);
        };

        const updateItem = (item: FeedItem) => {
            const newI = feedItems.map(i => {
                if (i.name === item.name) {
                    return item;
                }
                return i;
            });
            setFeedItems(newI);
        };

        useEffect(() => {
            const webSocketURL =
                window.location.protocol.replace("http", "ws") +
                "//" +
                window.location.host +
                "/ws/" +
                feedName +
                "?secret=" +
                secret;

            function disconnect() {
                if (ws.current === null) {
                    return;
                }
                ws.current.close();
                ws.current = null;
            }

            function connect() {
                disconnect();
                ws.current = new WebSocket(webSocketURL);
                if (ws.current === null) {
                    return;
                }
                ws.current.onopen = () => {
                    console.log("websocket connected");
                    ws.current?.send("feed");
                };

                ws.current.onclose = e => {
                    console.log("websocket closed : ", e);

                    if (e.code > 4000) {
                        navigate("/");
                        return;
                    }
                    // Try to reconnect
                    setTimeout(() => {
                        console.log("reconnecting");
                        connect();
                    }, 1000);
                };
            }

            connect();

            return () => {
                const w = ws.current;
                if (!w) {
                    console.log("no websocket to close");
                    return;
                }
                console.log("closing websocket");
                w.onclose = null;
                w.close();
            };
        }, []);

        useEffect(() => {
            if (!ws.current) {
                return;
            }

            ws.current.onmessage = (m: WebSocketEventMap["message"]) => {
                const message_data = JSON.parse(m.data);
                if (message_data) {
                    if (Object.prototype.hasOwnProperty.call(message_data, "items")) {
                        const f = message_data as Feed;
                        setFeedItems(f.items);
                        props.setEmpty && props.setEmpty(f.items.length === 0);
                    }
                    if (Object.prototype.hasOwnProperty.call(message_data, "action")) {
                        interface ActionMessage {
                            action: string;
                            item: FeedItem;
                        }
                        const am = message_data as ActionMessage;
                        if (am.action === "remove") {
                            removeItem(am.item);
                        } else if (am.action === "add") {
                            addItem(am.item);
                        } else if (am.action === "update") {
                            updateItem(am.item);
                        } else if (am.action === "empty") {
                            setFeedItems([]);
                            props.setEmpty && props.setEmpty(true);
                        }
                    }
                }
            };
        }, [feedItems]);

        // Filter items based on search term
        const filteredItems = feedItems.filter(item =>
            !!searchTerm ? item.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) : true,
        );

        return (
            <>
                <Box mb="md">
                    <TextInput
                        placeholder="Search items..."
                        leftSection={<IconSearch size={16} />}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </Box>

                {filteredItems.map((f: FeedItem) => (
                    <FeedItemContext.Provider value={f} key={f.name}>
                        <FeedItemComponent onDelete={deleteItem} />
                    </FeedItemContext.Provider>
                ))}
                <Space h="md" />
            </>
        );
    },
);
