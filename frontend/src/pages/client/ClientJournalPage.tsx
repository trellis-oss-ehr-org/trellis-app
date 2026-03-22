import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useApi } from "../../hooks/useApi";
import { useVoiceSession } from "../../hooks/useVoiceSession";
import { API_BASE } from "../../lib/api-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JournalEntry {
  id: string;
  preview: string;
  emotions: string[] | null;
  ai_feedback: boolean;
  exchange_count: number;
  created_at: string;
  updated_at: string;
}

interface ThreadMessage {
  role: "client" | "ai";
  content: string;
}

interface ThreadData {
  id: string;
  messages: ThreadMessage[];
  emotions: string[] | null;
  ai_feedback: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EMOTION_OPTIONS = [
  "anxious", "calm", "sad", "hopeful", "overwhelmed", "grateful",
  "angry", "numb", "lonely", "content", "frustrated", "motivated",
  "scared", "relieved", "exhausted", "curious",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Dictation hook (Vertex STT)
// ---------------------------------------------------------------------------

function useDictation(onTranscript: (text: string) => void) {
  const { getIdToken } = useAuth();
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      chunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        if (blob.size === 0) return;

        setTranscribing(true);
        try {
          const token = await getIdToken();
          const form = new FormData();
          form.append("audio", blob, "dictation.webm");
          const res = await fetch(`${API_BASE}/api/journal/transcribe`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: form,
          });
          if (!res.ok) throw new Error(`Transcription failed: ${res.status}`);
          const data = await res.json();
          if (data.transcript) onTranscript(data.transcript);
        } catch (e) {
          console.error("Dictation failed:", e);
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      mediaRecorder.current = recorder;
      setRecording(true);
    } catch (e) {
      console.error("Microphone access denied:", e);
    }
  }, [getIdToken, onTranscript]);

  const stop = useCallback(() => {
    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.stop();
      mediaRecorder.current = null;
      setRecording(false);
    }
  }, []);

  return { recording, transcribing, start, stop };
}

// ---------------------------------------------------------------------------
// Auto-complete hook — marks encounter complete on unmount / tab hide
// ---------------------------------------------------------------------------

function useAutoComplete(encounterId: string | null, api: ReturnType<typeof useApi>) {
  const idRef = useRef(encounterId);
  idRef.current = encounterId;

  useEffect(() => {
    if (!encounterId) return;

    const complete = () => {
      if (!idRef.current) return;
      // Use sendBeacon for reliability on page unload
      const token = document.cookie; // won't work — use fetch instead
      api.post(`/api/journal/${idRef.current}/complete`, {}).catch(() => {});
    };

    const handleVisChange = () => {
      if (document.visibilityState === "hidden") complete();
    };

    document.addEventListener("visibilitychange", handleVisChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisChange);
      complete(); // fires on component unmount
    };
  }, [encounterId, api]);
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ClientJournalPage() {
  const api = useApi();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThread, setActiveThread] = useState<ThreadData | null>(null);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [showVoiceJournal, setShowVoiceJournal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadEntries(); }, []);

  async function loadEntries() {
    try {
      const data = await api.get<{ entries: JournalEntry[] }>("/api/journal");
      setEntries(data.entries);
    } catch (e) {
      console.error("Failed to load journal entries:", e);
    } finally {
      setLoading(false);
    }
  }

  async function openThread(id: string) {
    try {
      const data = await api.get<ThreadData>(`/api/journal/${id}`);
      setActiveThread(data);
      setShowNewEntry(false);
    } catch (e) {
      console.error("Failed to load thread:", e);
    }
  }

  function handleBack() {
    setActiveThread(null);
    setShowVoiceJournal(false);
    loadEntries();
  }

  function handleDelete(id: string) {
    setDeleteTarget(id);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/api/journal/${deleteTarget}`);
      setEntries((prev) => prev.filter((e) => e.id !== deleteTarget));
      if (activeThread?.id === deleteTarget) setActiveThread(null);
    } catch (e) {
      console.error("Failed to delete:", e);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (showVoiceJournal) {
    return <VoiceJournalView onBack={handleBack} />;
  }

  if (activeThread) {
    return (
      <ThreadView
        thread={activeThread}
        onBack={handleBack}
        onUpdate={(updated) => setActiveThread(updated)}
        api={api}
      />
    );
  }

  if (showNewEntry) {
    return (
      <NewEntryForm
        onCreated={(id) => { setShowNewEntry(false); loadEntries(); openThread(id); }}
        onCancel={() => setShowNewEntry(false)}
        api={api}
      />
    );
  }

  // ── Journal list ──
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-display font-semibold text-warm-800">Journal</h1>
          <p className="text-sm text-warm-400 mt-0.5">
            Share your thoughts between sessions — your therapist can see these too
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNewEntry(true)}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors"
          >
            Write
          </button>
          <button
            onClick={() => setShowVoiceJournal(true)}
            className="px-4 py-2 bg-white text-teal-700 text-sm font-medium rounded-xl border border-teal-200 hover:bg-teal-50 transition-colors flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="2" />
              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Voice
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 bg-teal-50 rounded-2xl flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-teal-400">
              <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-warm-600 font-medium">No journal entries yet</p>
          <p className="text-sm text-warm-400 mt-1 max-w-xs mx-auto">
            Write about how you're feeling, what you're thinking, or anything on your mind.
          </p>
          <div className="flex gap-3 justify-center mt-4">
            <button onClick={() => setShowNewEntry(true)} className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors">Start writing</button>
            <button onClick={() => setShowVoiceJournal(true)} className="px-4 py-2 bg-white text-teal-700 text-sm font-medium rounded-xl border border-teal-200 hover:bg-teal-50 transition-colors flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" strokeWidth="2" /><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              Talk it out
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="relative group">
              <button
                onClick={() => openThread(entry.id)}
                className="w-full text-left px-4 py-3.5 pr-10 bg-white rounded-xl border border-warm-100 hover:border-teal-200 hover:shadow-sm transition-all"
              >
                <p className="text-sm text-warm-700 line-clamp-2">{entry.preview}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs text-warm-400">{formatDate(entry.created_at)}</span>
                  {entry.emotions && entry.emotions.length > 0 && (
                    <span className="text-xs text-warm-400">&middot; {entry.emotions.join(", ")}</span>
                  )}
                  {entry.exchange_count > 2 && (
                    <span className="text-xs text-warm-400">&middot; {entry.exchange_count} exchanges</span>
                  )}
                </div>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                className="absolute right-3 top-3.5 p-1 rounded-lg text-warm-300 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                title="Delete entry"
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                  <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm mx-4 p-6">
            <h3 className="text-lg font-display font-semibold text-warm-800 mb-2">Delete this entry?</h3>
            <p className="text-sm text-warm-500 mb-5">
              This will permanently remove this journal entry. If its themes have already been absorbed into your profile, those will remain.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-warm-600 bg-warm-50 rounded-xl hover:bg-warm-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New Entry Form
// ---------------------------------------------------------------------------

function NewEntryForm({
  onCreated,
  onCancel,
  api,
}: {
  onCreated: (id: string) => void;
  onCancel: () => void;
  api: ReturnType<typeof useApi>;
}) {
  const [content, setContent] = useState("");
  const [emotions, setEmotions] = useState<string[]>([]);
  const [aiFeedback, setAiFeedback] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTranscript = useCallback((text: string) => {
    setContent((prev) => (prev ? prev + " " + text : text));
  }, []);
  const dictation = useDictation(handleTranscript);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  async function handleSubmit() {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ encounter_id: string }>("/api/journal", {
        content: content.trim(),
        emotions: emotions.length > 0 ? emotions : undefined,
        ai_feedback: aiFeedback,
      });
      onCreated(res.encounter_id);
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
      <button onClick={onCancel} className="flex items-center gap-1 text-sm text-warm-400 hover:text-warm-600 mb-4 transition-colors">
        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back
      </button>

      <h1 className="text-xl font-display font-semibold text-warm-800 mb-6">New journal entry</h1>

      {/* Emotion tags */}
      <div className="mb-5">
        <label className="text-sm font-medium text-warm-600 block mb-2">How are you feeling? (optional)</label>
        <div className="flex flex-wrap gap-1.5">
          {EMOTION_OPTIONS.map((emotion) => (
            <button
              key={emotion}
              onClick={() => setEmotions((prev) => prev.includes(emotion) ? prev.filter((e) => e !== emotion) : [...prev, emotion])}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${emotions.includes(emotion) ? "bg-teal-600 text-white shadow-sm" : "bg-warm-50 text-warm-500 hover:bg-warm-100"}`}
            >
              {emotion}
            </button>
          ))}
        </div>
      </div>

      {/* Textarea with dictation */}
      <div className="mb-5">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind? Type or tap the mic to dictate..."
            rows={8}
            className="w-full px-4 py-3 pr-14 rounded-xl border border-warm-200 text-warm-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 placeholder:text-warm-300"
          />
          <button
            onClick={dictation.recording ? dictation.stop : dictation.start}
            disabled={dictation.transcribing}
            className={`absolute right-3 top-3 p-2 rounded-xl transition-all ${dictation.recording ? "bg-red-100 text-red-600 animate-pulse" : dictation.transcribing ? "bg-warm-100 text-warm-400" : "bg-warm-50 text-warm-400 hover:bg-warm-100 hover:text-warm-600"}`}
            title={dictation.recording ? "Stop recording" : dictation.transcribing ? "Transcribing..." : "Dictate"}
          >
            {dictation.transcribing ? (
              <div className="w-5 h-5 border-2 border-warm-300 border-t-warm-600 rounded-full animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" fill={dictation.recording ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
        {dictation.recording && <p className="text-xs text-red-500 mt-1 animate-pulse">Recording... tap the mic to stop</p>}
        {dictation.transcribing && <p className="text-xs text-warm-400 mt-1">Transcribing your audio...</p>}
      </div>

      {/* AI feedback toggle */}
      <label className="flex items-center gap-3 mb-6 cursor-pointer">
        <div className="relative">
          <input type="checkbox" checked={aiFeedback} onChange={(e) => setAiFeedback(e.target.checked)} className="sr-only peer" />
          <div className="w-10 h-6 bg-warm-200 rounded-full peer-checked:bg-teal-600 transition-colors" />
          <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform" />
        </div>
        <div>
          <span className="text-sm font-medium text-warm-700">Get reflective feedback</span>
          <p className="text-xs text-warm-400">An AI companion will respond with thoughtful reflections</p>
        </div>
      </label>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!content.trim() || submitting || dictation.recording}
        className="w-full px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            {aiFeedback ? "Writing & reflecting..." : "Saving..."}
          </span>
        ) : "Save entry"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread View
// ---------------------------------------------------------------------------

function ThreadView({
  thread,
  onBack,
  onUpdate,
  api,
}: {
  thread: ThreadData;
  onBack: () => void;
  onUpdate: (updated: ThreadData) => void;
  api: ReturnType<typeof useApi>;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleTranscript = useCallback((text: string) => {
    setMessage((prev) => (prev ? prev + " " + text : text));
  }, []);
  const dictation = useDictation(handleTranscript);

  // Auto-complete on unmount / tab hide
  useAutoComplete(thread.id, api);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.messages]);

  async function handleSend() {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const res = await api.post<{ ai_response: string; message_count: number }>(
        `/api/journal/${thread.id}/chat`,
        { message: message.trim() },
      );
      onUpdate({
        ...thread,
        status: "draft",
        messages: [
          ...thread.messages,
          { role: "client", content: message.trim() },
          { role: "ai", content: res.ai_response },
        ],
      });
      setMessage("");
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (e) {
      console.error("Chat failed:", e);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const canChat = thread.ai_feedback;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-warm-400 hover:text-warm-600 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Journal
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-warm-400">{formatFullDate(thread.created_at)}</span>
          {thread.emotions && thread.emotions.length > 0 && (
            <span className="text-xs px-2 py-0.5 bg-warm-50 text-warm-500 rounded-full">{thread.emotions.join(", ")}</span>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1 rounded-lg text-warm-300 hover:text-red-500 hover:bg-red-50 transition-all"
            title="Delete entry"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 mb-4">
        {thread.messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "client" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === "client" ? "bg-teal-600 text-white rounded-br-md" : "bg-white border border-warm-100 text-warm-700 rounded-bl-md"}`}>
              {msg.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="px-4 py-3 bg-white border border-warm-100 rounded-2xl rounded-bl-md">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-warm-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-warm-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-warm-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area — shown when AI feedback is enabled */}
      {canChat ? (
        <div className="sticky bottom-20 md:bottom-4 bg-warm-50 pt-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Continue writing or tap the mic..."
                rows={2}
                className="w-full px-4 py-2.5 pr-12 rounded-xl border border-warm-200 text-warm-700 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 placeholder:text-warm-300"
              />
              <button
                onClick={dictation.recording ? dictation.stop : dictation.start}
                disabled={dictation.transcribing || sending}
                className={`absolute right-2 top-2 p-1.5 rounded-lg transition-all ${dictation.recording ? "bg-red-100 text-red-600 animate-pulse" : dictation.transcribing ? "text-warm-300" : "text-warm-400 hover:text-warm-600 hover:bg-warm-100"}`}
              >
                {dictation.transcribing ? (
                  <div className="w-4 h-4 border-2 border-warm-300 border-t-warm-600 rounded-full animate-spin" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                    <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" fill={dictation.recording ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" />
                    <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4m-4 0h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending || dictation.recording}
              className="px-4 py-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          {dictation.recording && <p className="text-xs text-red-500 mt-1 animate-pulse">Recording... tap mic to stop</p>}
          <button onClick={onBack} className="w-full text-center text-xs text-warm-400 hover:text-warm-500 mt-3 py-1 transition-colors">
            Done for now
          </button>
        </div>
      ) : (
        <button onClick={onBack} className="text-center text-xs text-warm-400 hover:text-warm-500 py-3 transition-colors">
          Back to journal
        </button>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm mx-4 p-6">
            <h3 className="text-lg font-display font-semibold text-warm-800 mb-2">Delete this entry?</h3>
            <p className="text-sm text-warm-500 mb-5">
              This will permanently remove this journal entry. If its themes have already been absorbed into your profile, those will remain.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-warm-600 bg-warm-50 rounded-xl hover:bg-warm-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await api.del(`/api/journal/${thread.id}`);
                    onBack();
                  } catch (e) {
                    console.error("Failed to delete:", e);
                  } finally {
                    setDeleting(false);
                    setShowDeleteConfirm(false);
                  }
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voice Journal View (Gemini Live)
// ---------------------------------------------------------------------------

function VoiceJournalView({ onBack }: { onBack: () => void }) {
  const api = useApi();
  const { status, transcript, sessionId, error, startSession, endSession } =
    useVoiceSession({ sessionType: "journal" });
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [reflecting, setReflecting] = useState(false);
  const [reflectError, setReflectError] = useState<string | null>(null);
  const hasTriggeredReflection = useRef(false);

  // When session ends, generate reflection and open journal thread
  useEffect(() => {
    if (status !== "ended" || !sessionId || hasTriggeredReflection.current) return;
    hasTriggeredReflection.current = true;

    (async () => {
      setReflecting(true);
      try {
        const res = await api.post<{ encounter_id: string; reflection: string }>(
          `/api/journal/from-voice/${sessionId}`,
          {},
        );
        // Navigate to the new journal thread
        onBack();
        // Small delay to let the list reload, then open the thread
        // We pass the encounter_id up — but onBack just goes to list.
        // Instead, navigate directly by setting activeThread.
        // Since we can't set parent state from here, we'll use a URL param approach.
        // Simplest: just go back to list — the new entry will be at the top.
      } catch (e: any) {
        console.error("Voice reflection failed:", e);
        setReflectError(e?.message || "Couldn't generate reflection");
        setReflecting(false);
      }
    })();
  }, [status, sessionId, api, onBack]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">
      <button
        onClick={() => { if (status === "active") endSession(); onBack(); }}
        className="flex items-center gap-1 text-sm text-warm-400 hover:text-warm-600 mb-4 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Journal
      </button>

      <div className="text-center mb-8">
        <h1 className="text-xl font-display font-semibold text-warm-800 mb-2">Voice Journal</h1>
        <p className="text-sm text-warm-400">Talk through what's on your mind. An AI companion will listen and reflect back what it hears.</p>
      </div>

      {/* Status badge */}
      <div className="flex justify-center mb-6">
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${status === "active" ? "bg-teal-100 text-teal-700" : status === "connecting" || status === "ready" ? "bg-amber-100 text-amber-700" : status === "ended" ? "bg-warm-100 text-warm-600" : status === "error" ? "bg-red-100 text-red-700" : "bg-warm-100 text-warm-500"}`}>
          {status === "active" && <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500" /></span>}
          {status === "idle" && "Ready"}
          {status === "connecting" && "Connecting..."}
          {status === "ready" && "Starting..."}
          {status === "active" && "Listening"}
          {status === "ended" && (reflecting ? "Reflecting..." : "Session complete")}
          {status === "error" && "Error"}
        </span>
      </div>

      {status === "idle" && (
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-teal-50 rounded-full flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-9 h-9 text-teal-600"><path d="M12 1a4 4 0 00-4 4v6a4 4 0 008 0V5a4 4 0 00-4-4z" stroke="currentColor" strokeWidth="1.5" /><path d="M19 10v1a7 7 0 01-14 0v-1M12 18v4m-3 0h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          <p className="text-sm text-warm-500 mb-5 max-w-sm mx-auto">
            When you're ready, tap below. You'll have a conversation with an AI companion who will listen and reflect with you.
          </p>
          <button onClick={startSession} className="px-6 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors">Start talking</button>
        </div>
      )}

      {(status === "active" || status === "ended") && transcript.length > 0 && (
        <div className="bg-white rounded-xl border border-warm-100 p-4 mb-6 max-h-[50vh] overflow-y-auto">
          <p className="text-sm text-warm-600 whitespace-pre-wrap leading-relaxed">
            {transcript.join(" ")}
          </p>
          <div ref={transcriptEndRef} />
        </div>
      )}

      {status === "active" && (
        <div className="text-center">
          <button onClick={endSession} className="px-5 py-2 bg-warm-100 text-warm-600 text-sm font-medium rounded-xl hover:bg-warm-200 transition-colors">End session</button>
        </div>
      )}

      {status === "ended" && reflecting && (
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-warm-500">
            <span className="w-4 h-4 border-2 border-warm-300 border-t-teal-600 rounded-full animate-spin" />
            Reflecting on what you shared...
          </div>
        </div>
      )}

      {status === "ended" && !reflecting && reflectError && (
        <div className="text-center">
          <p className="text-sm text-warm-500 mb-4">Your voice journal has been saved.</p>
          <button onClick={onBack} className="px-5 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors">Back to journal</button>
        </div>
      )}

      {error && <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {reflectError && <div className="mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">{reflectError}</div>}
    </div>
  );
}
