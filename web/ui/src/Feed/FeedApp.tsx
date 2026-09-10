import { AppShell, Container } from "@mantine/core";

import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { FeedHome } from "./FeedHome";
import { FeedFeed } from "./FeedFeed";
import { FeedVersionComponent } from "./Components";

const router = createBrowserRouter([
    {
        path: "/",
        element: <FeedHome />,
    },
    {
        path: "/:feedName",
        element: <FeedFeed />,
    },
]);

export function FeedApp() {
    return (
        <AppShell withBorder={false}>
            <AppShell.Main>
                <Container size="xl" mx="auto">
                    <RouterProvider router={router} />
                </Container>
            </AppShell.Main>
            <AppShell.Footer style={{ backgroundColor: "transparent" }} zIndex={100}>
                <FeedVersionComponent />
            </AppShell.Footer>
        </AppShell>
    );
}
