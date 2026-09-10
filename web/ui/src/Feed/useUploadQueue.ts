import { useCallback, useEffect, useRef, useState } from "react";
import { Y } from "../FeedClient";

export interface UploadJob {
    id: string;
    name: string;
    size: number;
    file?: File;
    status: "queued" | "uploading" | "saved" | "failed";
    progress: number;
    error?: string;
    feedName: string;
}

function uploadError(error: unknown): string {
    const e = error as { response?: { status?: number }; code?: string };
    if (e.response?.status === 413) return "This file exceeds the server’s size limit.";
    if (e.response?.status === 401) return "Feed access expired. Unlock the feed, then retry.";
    if (e.response?.status === 400) return "The server could not accept this file. Check that it is not empty.";
    return "Could not confirm the save. Check the feed before retrying.";
}

export function useUploadQueue(feedName: string, onSaved?: () => void) {
    const [jobs, setJobs] = useState<UploadJob[]>([]);
    const latestJobs = useRef(jobs);
    latestJobs.current = jobs;
    const savedCallback = useRef(onSaved);
    savedCallback.current = onSaved;
    const nextId = useRef(0);
    const activeId = (jobs.find(job => job.feedName === feedName && job.status === "uploading") ??
        jobs.find(job => job.feedName === feedName && job.status === "queued"))?.id;

    useEffect(() => setJobs([]), [feedName]);
    useEffect(() => {
        const job = latestJobs.current.find(candidate => candidate.id === activeId);
        if (!job?.file) return;
        const controller = new AbortController();
        let disposed = false;
        const update = (patch: Partial<UploadJob>) => {
            if (!disposed) setJobs(current => current.map(item => item.id === job.id ? { ...item, ...patch } : item));
        };
        update({ status: "uploading", progress: 0, error: undefined });
        const form = new FormData();
        form.append("file", job.file);
        Y.post("/feeds/" + encodeURIComponent(job.feedName), form, {
            signal: controller.signal,
            timeout: 120000,
            onUploadProgress: event => update({ progress: Math.min(100, Math.round((event.progress ?? 0) * 100)) }),
        }).then(() => {
            if (disposed) return;
            update({ status: "saved", progress: 100, file: undefined });
            try { savedCallback.current?.(); }
            catch (error) { console.error("Upload saved, but feed refresh failed", error); }
        }).catch(error => update({ status: "failed", error: uploadError(error) }));
        return () => { disposed = true; controller.abort(); };
    }, [activeId, feedName]);

    const enqueue = useCallback((files: File[]) => {
        setJobs(current => [...current, ...files.map(file => ({
            id: String(++nextId.current), name: file.name, size: file.size, file,
            status: "queued" as const, progress: 0, feedName,
        }))]);
    }, [feedName]);
    const retry = (id: string) => setJobs(current => current.map(job =>
        job.id === id && job.status === "failed" ? { ...job, status: "queued", progress: 0, error: undefined } : job));
    const dismiss = (id: string) => setJobs(current => current.filter(job =>
        job.id !== id || job.status === "uploading"));
    const clearSaved = () => setJobs(current => current.filter(job => job.status !== "saved"));
    return { jobs: jobs.filter(job => job.feedName === feedName), enqueue, retry, dismiss, clearSaved };
}
