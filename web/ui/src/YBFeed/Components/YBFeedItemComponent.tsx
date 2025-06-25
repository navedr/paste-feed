import { useContext, useEffect, useMemo, useState, KeyboardEvent } from "react";
import moment from "moment";
import { Button, Card, Chip, Group, Skeleton, Space, TextInput, Tooltip, UnstyledButton } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
    IconCheck,
    IconClipboardCopy,
    IconDownload,
    IconFile,
    IconPhoto,
    IconTrash,
    IconTxt,
    IconX,
} from "@tabler/icons-react";

import { copyImageItem, FeedItemContext, YBFeedItemImageComponent, YBFeedItemTextComponent } from ".";
import { Connector, YBFeedItem } from "../";

import { defaultNotificationProps } from "../config";
import { ConfirmPopoverButton } from "./ConfirmPopoverButton";

export interface FeedItemHeadingComponentProps {
    onDelete?: (item: YBFeedItem) => void;
    clipboardContent?: string;
}

export const copyToClipboard = async (textToCopy: string) => {
    // Navigator clipboard api needs a secure context (https)
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
    } else {
        // Use the 'out of viewport hidden text area' trick
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;

        // Move textarea out of the viewport so it's not visible
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";

        document.body.prepend(textArea);
        textArea.select();

        try {
            document.execCommand("copy");
        } catch (error) {
            console.error(error);
        } finally {
            textArea.remove();
        }
    }
};

function YBHeadingComponent(props: FeedItemHeadingComponentProps) {
    const item = useContext(FeedItemContext);
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState("");

    const { clipboardContent } = props;

    const { type, date, name = "", displayName = "" } = item || {};

    const nameToShow = useMemo(() => displayName || name.split(".")[0], [displayName, name]);

    // Start editing mode
    const handleStartEdit = () => {
        setNewName(nameToShow); // Set initial name without extension
        setIsEditing(true);
    };

    // Cancel editing
    const handleCancelEdit = () => {
        setIsEditing(false);
    };

    // Save updated name
    const handleSaveEdit = () => {
        if (!item || !newName.trim()) return;

        Connector.UpdateItem(item, newName)
            .then(() => {
                setIsEditing(false);
                notifications.show({
                    message: "Name updated successfully!",
                    ...defaultNotificationProps,
                });
                // setNameToShow(newName); // Update the displayed name
            })
            .catch(error => {
                console.error("Failed to update name", error);
                notifications.show({
                    message: "Failed to update name",
                    color: "red",
                    ...defaultNotificationProps,
                });
            });
    };

    // Handle key press events in the input field
    const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSaveEdit();
        } else if (e.key === "Escape") {
            handleCancelEdit();
        }
    };

    // Copy item to pasteboard
    // if `clipboardContent` is set as an attribute, this is what will be put
    // in the clipboard, otherwise, we are assuming that's an image.
    function doCopyItem() {
        if (clipboardContent) {
            copyToClipboard(clipboardContent);
            notifications.show({ message: "Copied to clipboard!", ...defaultNotificationProps });
        } else {
            if (item!.type === 1) {
                copyImageItem(item!).then(() => {
                    notifications.show({ message: "Copied to clipboard!", ...defaultNotificationProps });
                });
            }
        }
    }

    return (
        <FeedItemContext.Provider value={item}>
            <Card.Section>
                <Group ml="1em" mr="1em" mt="sm" justify="space-between">
                    <Group>
                        {type === undefined ? <Skeleton width={20} height={20} /> : ""}
                        {type === 0 && <IconTxt />}
                        {type === 1 && <IconPhoto />}
                        {type === 2 && <IconFile />}

                        {isEditing ? (
                            <Button.Group>
                                <TextInput
                                    value={newName}
                                    onChange={e => setNewName(e.currentTarget.value)}
                                    onKeyDown={handleKeyPress}
                                    autoFocus
                                    onFocus={e => e.target.select()}
                                    size="xs"
                                    style={{ width: "300px" }}
                                    variant="filled"
                                />
                                <Button size="xs" variant="filled" color="green" onClick={handleSaveEdit} p="xs">
                                    <IconCheck size={16} />
                                </Button>
                                <Button size="xs" variant="filled" color="red" onClick={handleCancelEdit} p="xs">
                                    <IconX size={16} />
                                </Button>
                            </Button.Group>
                        ) : (
                            <Tooltip label="Click to Edit" position="bottom" withArrow>
                                <UnstyledButton
                                    onClick={handleStartEdit}
                                    style={{
                                        borderBottom: "1px dashed #ccc",
                                        paddingBottom: "2px",
                                    }}>
                                    {nameToShow}
                                </UnstyledButton>
                            </Tooltip>
                        )}
                    </Group>
                    <Group>
                        {item === undefined ? (
                            <>
                                <Skeleton width={80} height={20} mr="1em" />
                                <Skeleton width={80} height={20} />
                            </>
                        ) : (
                            <>
                                <Chip>{moment(date).fromNow()}</Chip>
                                {type === 2 ? (
                                    <Button
                                        component="a"
                                        href={
                                            "/api/feeds/" + encodeURIComponent(item.feed.name) + "/items/" + item.name
                                        }
                                        size="xs"
                                        leftSection={<IconDownload size={14} />}
                                        variant="default">
                                        Download
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={doCopyItem}
                                        size="xs"
                                        leftSection={<IconClipboardCopy size={14} />}
                                        variant="default">
                                        Copy
                                    </Button>
                                )}
                                <ConfirmPopoverButton
                                    buttonTitle="Delete"
                                    message="Do you really want to delete item ?"
                                    onConfirm={() => props.onDelete && props.onDelete(item!)}>
                                    <Button size="xs" leftSection={<IconTrash size={14} />} variant="light" color="red">
                                        Delete
                                    </Button>
                                </ConfirmPopoverButton>
                            </>
                        )}
                    </Group>
                </Group>
            </Card.Section>
        </FeedItemContext.Provider>
    );
}

export interface YBFeedItemComponentProps {
    showCopyButton?: boolean;
    onDelete?: (item: YBFeedItem) => void;
}

export function YBFeedItemComponent(props: YBFeedItemComponentProps) {
    const item = useContext(FeedItemContext);

    const [textContent, setTextContent] = useState<string | undefined>(undefined);

    useEffect(() => {
        if (item && item!.type === 0) {
            Connector.GetItem(item!).then(text => {
                setTextContent(text);
            });
        }
    }, [item]);

    if (!item) {
        return (
            <Card mt="2em" withBorder shadow="sm" radius="md" mb="2em">
                <YBHeadingComponent onDelete={props.onDelete} clipboardContent={textContent} />
                <Skeleton mt="2em" height={50} />
            </Card>
        );
    }

    const renderedContent = useMemo(() => {
        if (typeof textContent === "object") {
            try {
                return {
                    content: JSON.stringify(textContent, null, "\t"),
                    type: "json",
                };
            } catch (e) {
                console.error("failed parsing object", textContent);
            }
        }
        return { content: textContent?.toString(), type: "string" };
    }, [textContent]);

    const { content, type } = renderedContent;

    return (
        <Card withBorder shadow="sm" radius="md" mb="2em">
            <YBHeadingComponent onDelete={props.onDelete} clipboardContent={content} />
            {content && item.type === 0 && <YBFeedItemTextComponent content={content} type={type} />}
            {item.type === 1 && <YBFeedItemImageComponent />}
            {item.type === 2 && <Space />}
        </Card>
    );
}
