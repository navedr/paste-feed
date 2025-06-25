import { useState, useEffect } from "react";

import { redirect, useParams } from "react-router-dom";

import { Textarea, Center } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
// import { useForm } from '@mantine/form';

import "./YBPasteCardComponent.css";
import { PasteToFeed } from "../../paste";
import { Y } from "../../YBFeedClient";

export function YBPasteCardComponent() {
    const [isMobile, setIsMobile] = useState(false);
    const { feedName } = useParams();

    if (!feedName) {
        redirect("/");
        return;
    }

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 734); // Adjust the breakpoint as needed
        };

        handleResize(); // Initial call to set the initial state

        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    useEffect(() => {
        document.onpaste = e => {
            PasteToFeed(e, feedName);
        };
        return () => {
            document.onpaste = null;
        };
    });

    return (
        <Center my="2em" h="100%" style={{ flexDirection: "column" }}>
            {isMobile && (
                <Textarea
                    ta="center"
                    pt="1em"
                    variant="unstyled"
                    placeholder="Paste Here"
                    value={""}
                    onChange={() => {}}
                    style={{
                        textAlign: "center",
                        textAlignLast: "center",
                        color: "transparent",
                        textShadow: "0px 0px 0px tomato",
                        caretColor: "transparent",
                    }}
                />
            )}
            <Dropzone.FullScreen
                w="100%"
                ta="center"
                onDrop={files => {
                    const formData = new FormData();
                    formData.append("file", files[0]);
                    Y.post("/feeds/" + encodeURIComponent(feedName), formData);
                }}
                onReject={files => console.log("rejected files", files)}
                maxSize={5 * 1024 ** 2}>
                <Center h={"100vh"}>Drop files here</Center>
            </Dropzone.FullScreen>
        </Center>
    );
}
