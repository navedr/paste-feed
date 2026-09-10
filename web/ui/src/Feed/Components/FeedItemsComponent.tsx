import { createContext, useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Space, TextInput, Box } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { FeedItemComponent } from ".";
import { Connector, FeedItem } from "../";
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

        useEffect(() => {
            props.setEmpty?.(feedItems.length === 0);
        }, [feedItems, props.setEmpty]);

        useEffect(() => {
            const webSocketURL =
                window.location.protocol.replace("http", "ws") +
                "//" + window.location.host + "/ws/" + encodeURIComponent(feedName) +
                "?secret=" + encodeURIComponent(secret);
            let disposed = false;
            let retryTimer: ReturnType<typeof setTimeout> | undefined;
            let heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
            let deadlineTimer: ReturnType<typeof setTimeout> | undefined;

            function disconnect(socket: WebSocket) {
                clearTimeout(heartbeatTimer);
                clearTimeout(deadlineTimer);
                socket.onopen = socket.onclose = socket.onmessage = socket.onerror = null;
                socket.close();
                if (ws.current === socket) ws.current = null;
            }

            function retry(socket: WebSocket) {
                if (disposed || ws.current !== socket) return;
                disconnect(socket);
                clearTimeout(retryTimer);
                retryTimer = setTimeout(connect, 1000);
            }

            function scheduleHeartbeat(socket: WebSocket) {
                clearTimeout(heartbeatTimer);
                heartbeatTimer = setTimeout(() => {
                    if (disposed || ws.current !== socket) return;
                    try {
                        socket.send("ping");
                        deadlineTimer = setTimeout(() => retry(socket), 10000);
                    } catch {
                        retry(socket);
                    }
                }, 25000);
            }

            function connect() {
                if (disposed) return;
                const socket = new WebSocket(webSocketURL);
                ws.current = socket;
                // Also recover when the opening handshake never completes.
                deadlineTimer = setTimeout(() => retry(socket), 10000);
                socket.onopen = () => {
                    if (disposed || ws.current !== socket) return;
                    clearTimeout(deadlineTimer);
                    socket.send("feed");
                    scheduleHeartbeat(socket);
                };
                socket.onmessage = event => {
                    if (disposed || ws.current !== socket) return;
                    if (event.data === "pong") {
                        clearTimeout(deadlineTimer);
                        scheduleHeartbeat(socket);
                        return;
                    }
                    try {
                        const message = JSON.parse(event.data);
                        if (Array.isArray(message?.items)) {
                            setFeedItems(message.items);
                        } else if (message?.action === "empty") {
                            setFeedItems([]);
                        } else if (message?.item && typeof message.item.name === "string") {
                            const item = message.item as FeedItem;
                            if (message.action === "add") {
                                setFeedItems(items => [item, ...items.filter(i => i.name !== item.name)]);
                            } else if (message.action === "remove") {
                                setFeedItems(items => items.filter(i => i.name !== item.name));
                            } else if (message.action === "update") {
                                setFeedItems(items => items.map(i => i.name === item.name ? item : i));
                            }
                        }
                    } catch {
                        // Recover a fresh snapshot rather than leaving partially updated state.
                        retry(socket);
                    }
                };
                socket.onerror = () => retry(socket);
                socket.onclose = event => {
                    if (disposed || ws.current !== socket) return;
                    if (event.code === 4401 || event.code === 4404) {
                        disconnect(socket);
                        navigate("/");
                        return;
                    }
                    retry(socket);
                };
            }

            setFeedItems([]);
            connect();
            return () => {
                disposed = true;
                clearTimeout(retryTimer);
                clearTimeout(heartbeatTimer);
                clearTimeout(deadlineTimer);
                if (ws.current) disconnect(ws.current);
            };
        }, [feedName, secret, navigate]);

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
