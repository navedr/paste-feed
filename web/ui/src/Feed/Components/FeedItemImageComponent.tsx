import { Image, Card } from "@mantine/core";

import { FeedItemContext } from ".";
import { useContext } from "react";

export function FeedItemImageComponent() {
    const item = useContext(FeedItemContext);

    return (
        <Card.Section mt="sm">
            <Image src={"/api/feeds/" + encodeURIComponent(item!.feed.name) + "/items/" + item!.name} />
        </Card.Section>
    );
}
