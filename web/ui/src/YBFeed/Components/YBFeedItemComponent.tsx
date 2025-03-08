import { useState, useEffect, useContext, useMemo } from 'react'

import { Group, Button, Card, Skeleton, Space } from "@mantine/core"
import { notifications } from '@mantine/notifications';
import { IconPhoto, IconTrash, IconTxt, IconClipboardCopy, IconFile, IconDownload } from "@tabler/icons-react"

import { YBFeedItemTextComponent, YBFeedItemImageComponent, copyImageItem, FeedItemContext } from '.'
import { Connector, YBFeedItem } from '../'

import { defaultNotificationProps } from '../config';
import { ConfirmPopoverButton } from './ConfirmPopoverButton';

//const connection = new YBFeedConnector()

// This is the heading component of a single item.
// Its how the item type, name and the Copy and Delete buttons
export interface FeedItemHeadingComponentProps {
    onDelete?: (item: YBFeedItem) => void,
    clipboardContent?: string,
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
            document.execCommand('copy');
        } catch (error) {
            console.error(error);
        } finally {
            textArea.remove();
        }
    }
}

function YBHeadingComponent(props: FeedItemHeadingComponentProps) {
    const item = useContext(FeedItemContext)
    
    const { clipboardContent } = props

    let name, type = undefined

    if (item) {
        ({name,type} = item)
    }

    // Copy item to pasteboard
    // if `clipboardContent` is set as an attribute, this is what will be put
    // in the clipboard, otherwise, we are assuming that's an image.
    function doCopyItem() {
        if (clipboardContent) {
            copyToClipboard(clipboardContent)
            notifications.show({message:"Copied to clipboard!", ...defaultNotificationProps})
        }
        else {
            if (item!.type === 1) {
                copyImageItem(item!)
                .then(() => {
                    notifications.show({message:"Copied to clipboard!", ...defaultNotificationProps})
                })
            }
        }
    }

    return (
        <FeedItemContext.Provider value={item}>
            <Card.Section >
                <Group ml="1em" mr="1em"  mt="sm" justify="space-between">
                    <Group>
                        {(type === undefined)?
                        <Skeleton width={20} height={20} />
                        :""}
                        {(type === 0)&&
                        <IconTxt />
                        }
                        {(type === 1)&&
                        <IconPhoto />
                        }
                        {(type === 2)&&
                        <IconFile />
                        }
                        &nbsp;{name}
                    </Group>
                    <Group>
                        {item===undefined?
                        <>
                        <Skeleton width={80} height={20} mr="1em"/>
                        <Skeleton width={80} height={20} />
                        </>
                        :
                        <>
                        {(type === 2)?
                        <Button component="a" href={"/api/feeds/"+encodeURIComponent(item.feed.name)+"/items/"+item.name} size="xs" leftSection={<IconDownload size={14} />} variant="default" >
                        Download
                        </Button>
                        :
                        <Button onClick={doCopyItem} size="xs" leftSection={<IconClipboardCopy size={14} />} variant="default" >
                            Copy
                        </Button>
        }
                        <ConfirmPopoverButton buttonTitle='Delete' message='Do you really want to delete item ?' onConfirm={() => props.onDelete&&props.onDelete(item!)}>
                            <Button size="xs" leftSection={<IconTrash size={14} />} variant="light" color="red">
                                Delete
                            </Button>
                        </ConfirmPopoverButton>
                        
                        </>}
                    </Group>
                </Group>
            </Card.Section>
        </FeedItemContext.Provider>
    )
}

export interface YBFeedItemComponentProps {
    showCopyButton?: boolean
    onDelete?: (item: YBFeedItem) => void
}

export function YBFeedItemComponent(props: YBFeedItemComponentProps) {
    const item = useContext(FeedItemContext)

    const [textContent,setTextContent] = useState<string|undefined>(undefined)
    // const [timedOut, setTimedOut] = useState(false)

    // useEffect(()=> {
    //     window.setTimeout(() => setTimedOut(true),1000)
    // })
    
    useEffect(() => {
        if (item && item!.type === 0) {
            Connector.GetItem(item!)
            .then((text) => {
                setTextContent(text)
            })     
        }
    }, [item])

    if (! item) {
        return(
        <Card mt="2em" withBorder shadow="sm" radius="md" mb="2em">
            <YBHeadingComponent onDelete={props.onDelete} clipboardContent={textContent}/>
            <Skeleton mt="2em" height={50}/>
        </Card>
        )
    }

    const renderedContent = useMemo(() => {
        if (typeof textContent === "object") {
            try {
                return JSON.stringify(textContent, null, '\t');
            } catch(e) {
                console.error("failed parsing object", textContent);
            }
        }
        return textContent;
    }, [textContent])
    
    return(
        <Card withBorder shadow="sm" radius="md" mb="2em">
            <YBHeadingComponent onDelete={props.onDelete} clipboardContent={renderedContent}/>
            {(item.type===0)&&
            <YBFeedItemTextComponent>
                {renderedContent}
            </YBFeedItemTextComponent>
            }
            {(item.type===1)&&
            <YBFeedItemImageComponent/>
            }
            {(item.type===2)&&
            <Space/>
            }
        </Card>
    )
}
