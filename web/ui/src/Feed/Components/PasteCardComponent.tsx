import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import { ActionIcon, Box, Button, Group, Progress, Stack, Text } from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { IconUpload } from "@tabler/icons-react";
import { clipboardFiles } from "../../paste";
import { useUploadQueue } from "../useUploadQueue";

function fileSize(bytes: number): string {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function PasteCardComponent({ onSaved, uploadContainer }: { onSaved?: () => void; uploadContainer?: HTMLElement | null }) {
    const { feedName = "" } = useParams();
    const { jobs, enqueue, retry, dismiss, clearSaved } = useUploadQueue(feedName, onSaved);
    const picker = useRef<HTMLInputElement>(null);
    useEffect(() => {
        const paste = (event: ClipboardEvent) => {
            const target = event.target;
            if (target instanceof Element && target.closest('input, textarea, [contenteditable="true"]')) return;
            const files = clipboardFiles(event);
            if (files.length) { event.preventDefault(); enqueue(files); }
        };
        document.addEventListener("paste", paste);
        return () => document.removeEventListener("paste", paste);
    }, [enqueue]);

    if (!feedName) return null;
    const pending = jobs.filter(job => job.status === "queued" || job.status === "uploading").length;
    const uploadButton = (
        <ActionIcon variant="outline" size="md" aria-label="Choose files" title="Choose files" onClick={() => picker.current?.click()}>
            <IconUpload size={18} />
        </ActionIcon>
    );
    return (
        <>
            {uploadContainer === undefined ? uploadButton : uploadContainer && createPortal(uploadButton, uploadContainer)}
            <input ref={picker} type="file" multiple hidden aria-label="Choose files to upload" onChange={event => {
                enqueue(Array.from(event.target.files ?? [])); event.target.value = "";
            }} />
            <Dropzone.FullScreen onDrop={enqueue} onReject={rejected => enqueue(rejected.map(entry => entry.file))} multiple>
                <Stack h="100vh" align="center" justify="center">
                    <IconUpload size={40} />
                    <Text fw={600}>Drop files to add them to this feed</Text>
                </Stack>
            </Dropzone.FullScreen>
            {jobs.length > 0 && <Stack gap="xs" mt="md">
                <Group justify="space-between">
                    <Text size="xs" fw={600} role="status">{pending ? `${pending} ${pending === 1 ? "upload" : "uploads"} remaining` : "Uploads finished"}</Text>
                    {jobs.some(job => job.status === "saved") && <Button size="compact-xs" variant="subtle" onClick={clearSaved}>Clear saved</Button>}
                </Group>
                {jobs.map(job => <Box key={job.id} p="xs" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
                    <Group justify="space-between" wrap="nowrap" gap="xs">
                        <Box style={{ minWidth: 0, flex: 1 }}>
                            <Text size="sm" truncate title={job.name}>{job.name}</Text>
                            <Text size="xs" c="dimmed">{fileSize(job.size)}</Text>
                        </Box>
                        <Text size="xs" c={job.status === "saved" ? "teal" : job.status === "failed" ? "red" : "dimmed"} role="status">
                            {job.status === "queued" ? "Queued" : job.status === "saved" ? "Saved to feed" :
                                job.status === "failed" ? "Needs attention" : job.progress === 100 ? "Saving…" : `Uploading ${job.progress}%`}
                        </Text>
                        {job.status === "failed" && <Button size="compact-xs" variant="light" onClick={() => retry(job.id)} aria-label={`Retry ${job.name}`}>Retry</Button>}
                        {job.status !== "uploading" && <Button size="compact-xs" variant="subtle" color="gray" onClick={() => dismiss(job.id)} aria-label={`Dismiss ${job.name}`}>Dismiss</Button>}
                    </Group>
                    {job.status === "uploading" && <Progress mt="xs" size="xs" value={job.progress} aria-label={`Upload progress for ${job.name}`} />}
                    {job.error && <Text size="xs" c="red" mt={4} role="alert">{job.error}</Text>}
                </Box>)}
            </Stack>}
        </>
    );
}
