import React, { useRef, useState } from 'react';
import {
  Plus,
  Send,
  Image as ImageIcon,
  Camera,
  FileText,
  File,
  X,
  Copy,
  RotateCcw,
  Search,
  Trash2,
  Edit3,
  Check,
  MessageSquare,
  ExternalLink,
  Square,
} from 'lucide-react';
import {
  ChatAttachment,
  ChatMessage,
  ChatThread,
  InteractionState,
} from '../../types/jarvis';

interface BottomChatComposerProps {
  interactionState: InteractionState;
  liveCaption: string;
  captionSubtext: string;
  showSubtleCaptions: boolean;
  enterToSend: boolean;
  maxUploadSizeMb: number;
  threads: ChatThread[];
  activeThreadId: string;
  isChatDrawerOpen: boolean;
  onToggleChatDrawer: (open: boolean) => void;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onRenameThread: (id: string, title: string) => void;
  onDeleteThread: (id: string) => void;
  onSendMessage: (text: string, attachments: ChatAttachment[]) => void;
  onRetryMessage: (message: ChatMessage) => void;
  onStopActiveAction: () => void;
  onUploadStateChange: (isUploading: boolean) => void;
  onErrorFeedback: (msg: string) => void;
}

export const BottomChatComposer: React.FC<BottomChatComposerProps> = ({
  interactionState,
  liveCaption,
  captionSubtext,
  showSubtleCaptions,
  enterToSend,
  maxUploadSizeMb,
  threads,
  activeThreadId,
  isChatDrawerOpen,
  onToggleChatDrawer,
  onSelectThread,
  onNewThread,
  onRenameThread,
  onDeleteThread,
  onSendMessage,
  onRetryMessage,
  onStopActiveAction,
  onUploadStateChange,
  onErrorFeedback,
}) => {
  const [inputText, setInputText] = useState('');
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Live Camera Modal state for capturing photos directly
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Hidden file inputs for Android-compatible pickers
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const activeThread =
    threads.find((t) => t.id === activeThreadId) || threads[0];

  const handleFileSelection = async (
    files: FileList | null,
    kind: ChatAttachment['kind']
  ) => {
    setIsAttachMenuOpen(false);
    if (!files || files.length === 0) return;

    const maxBytes = (maxUploadSizeMb || 15) * 1024 * 1024;
    onUploadStateChange(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxBytes) {
        onErrorFeedback(
          `File "${file.name}" exceeds the ${maxUploadSizeMb} MB limit.`
        );
        continue;
      }

      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const mimeType =
        file.type ||
        (kind === 'pdf'
          ? 'application/pdf'
          : kind === 'photo' || kind === 'camera'
          ? 'image/jpeg'
          : 'text/plain');

      // Add initial progress entry
      const placeholder: ChatAttachment = {
        id,
        name: file.name,
        mimeType,
        sizeBytes: file.size,
        kind,
        dataBase64: '',
        uploadProgress: 25,
      };
      setAttachments((prev) => [...prev, placeholder]);

      try {
        const isTextLike =
          mimeType.startsWith('text/') ||
          /\.(txt|md|csv|json|js|ts|tsx|py|html|xml|yaml|yml)$/i.test(file.name);

        let textContent: string | undefined;
        if (isTextLike) {
          textContent = await file.text();
        }

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onprogress = (ev) => {
            if (ev.lengthComputable) {
              const pct = Math.min(95, Math.round((ev.loaded / ev.total) * 100));
              setAttachments((prev) =>
                prev.map((item) =>
                  item.id === id ? { ...item, uploadProgress: pct } : item
                )
              );
            }
          };
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        const base64Payload = dataUrl.includes(',')
          ? dataUrl.split(',')[1]
          : dataUrl;

        setAttachments((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  dataBase64: base64Payload,
                  previewUrl: mimeType.startsWith('image/') ? dataUrl : undefined,
                  textContent,
                  uploadProgress: 100,
                }
              : item
          )
        );
      } catch {
        setAttachments((prev) => prev.filter((item) => item.id !== id));
        onErrorFeedback(`Could not read attachment "${file.name}".`);
      }
    }

    onUploadStateChange(false);
  };

  const openCameraCapture = async () => {
    setIsAttachMenuOpen(false);
    // On mobile Android, native camera input works directly; if WebRTC getUserMedia is available, offer live viewfinder
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        cameraStreamRef.current = stream;
        setIsCameraModalOpen(true);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        }, 60);
        return;
      } catch {
        // Fallback to native file input with capture="environment"
      }
    }
    cameraInputRef.current?.click();
  };

  const closeCameraModal = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraModalOpen(false);
  };

  const capturePhotoFromVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const base64 = dataUrl.split(',')[1] || '';

    const newAtt: ChatAttachment = {
      id: `cam-${Date.now()}`,
      name: `Camera_${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: Math.round((base64.length * 3) / 4),
      kind: 'camera',
      dataBase64: base64,
      previewUrl: dataUrl,
      uploadProgress: 100,
    };

    setAttachments((prev) => [...prev, newAtt]);
    closeCameraModal();
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed && attachments.length === 0) return;
    if (attachments.some((a) => a.uploadProgress < 100)) return;

    const currentAttachments = [...attachments];
    setInputText('');
    setAttachments([]);
    setIsAttachMenuOpen(false);
    onSendMessage(trimmed, currentAttachments);
  };

  const handleCopyMessage = (msg: ChatMessage) => {
    navigator.clipboard?.writeText(msg.content);
    setCopiedMsgId(msg.id);
    setTimeout(() => setCopiedMsgId(null), 1800);
  };

  // State indicator label above composer when active
  const stateLabel =
    interactionState === 'listening'
      ? 'Listening...'
      : interactionState === 'thinking'
      ? 'Processing...'
      : interactionState === 'speaking'
      ? 'Speaking...'
      : interactionState === 'uploading'
      ? 'Uploading attachment...'
      : interactionState === 'error'
      ? 'Attention required'
      : '';

  const filteredMessages = activeThread
    ? activeThread.messages.filter((m) =>
        searchQuery.trim()
          ? m.content.toLowerCase().includes(searchQuery.toLowerCase())
          : true
      )
    : [];

  return (
    <>
      {/* Hidden File Pickers for Photo, Camera, File, and PDF */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFileSelection(e.target.files, 'photo');
          e.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          handleFileSelection(e.target.files, 'camera');
          e.target.value = '';
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.csv,.json,.js,.ts,.py,.html,.xml,image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFileSelection(e.target.files, 'file');
          e.target.value = '';
        }}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFileSelection(e.target.files, 'pdf');
          e.target.value = '';
        }}
      />

      {/* Live WebRTC Camera Capture Modal */}
      {isCameraModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Camera Capture"
        >
          <div className="relative w-full max-w-lg rounded-2xl overflow-hidden border border-[#FFC928]/35 bg-[#050505]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-80 sm:h-96 object-cover bg-black"
            />
            <div className="flex items-center justify-between px-5 py-4 bg-black/90 border-t border-[#FFC928]/20">
              <button
                type="button"
                onClick={closeCameraModal}
                className="px-4 py-2 min-h-[44px] rounded-lg border border-white/15 text-xs text-white/80 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={capturePhotoFromVideo}
                className="px-6 py-2.5 min-h-[44px] rounded-full bg-[#FFC928] text-black font-semibold text-xs hover:bg-[#FFDF70] transition-colors"
              >
                Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Conversation History Sheet (Opens when inspecting thread history without cluttering main screen) */}
      {isChatDrawerOpen && (
        <div
          className="fixed inset-x-0 top-16 bottom-24 z-30 mx-auto max-w-3xl px-4 flex flex-col pointer-events-auto"
          role="region"
          aria-label="Conversation History"
        >
          <div className="flex-1 rounded-2xl bg-[#070707]/95 border border-[#FFC928]/25 flex flex-col overflow-hidden shadow-2xl">
            {/* Thread Header & Search Bar */}
            <div className="px-4 py-3 border-b border-[#FFC928]/15 flex flex-wrap items-center justify-between gap-2 bg-[#0A0A0A]">
              <div className="flex items-center gap-2 overflow-x-auto max-w-full">
                <select
                  aria-label="Select Conversation Thread"
                  value={activeThread?.id || ''}
                  onChange={(e) => onSelectThread(e.target.value)}
                  className="bg-black border border-[#FFC928]/30 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFC928]"
                >
                  {threads.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.messages.length})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={onNewThread}
                  className="px-2.5 py-1.5 rounded-lg bg-[#FFC928]/15 border border-[#FFC928]/35 text-[#FFC928] text-xs font-medium whitespace-nowrap shrink-0"
                >
                  + New Chat
                </button>

                {activeThread && editingThreadId !== activeThread.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingThreadId(activeThread.id);
                      setEditingTitle(activeThread.title);
                    }}
                    aria-label="Rename Chat"
                    className="p-1.5 text-white/55 hover:text-[#FFC928]"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}

                {activeThread && threads.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteThread(activeThread.id)}
                    aria-label="Delete Chat"
                    className="p-1.5 text-white/55 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search messages..."
                    className="bg-black border border-white/15 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-[#FFC928] w-36 sm:w-44"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onToggleChatDrawer(false)}
                  aria-label="Minimize Conversation View"
                  className="p-1.5 rounded-lg text-white/60 hover:text-[#FFC928]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Optional Thread Rename Row */}
            {editingThreadId && (
              <div className="px-4 py-2 bg-black border-b border-[#FFC928]/20 flex items-center gap-2">
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="flex-1 bg-[#0A0A0A] border border-[#FFC928]/40 rounded px-2.5 py-1 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (editingTitle.trim()) {
                      onRenameThread(editingThreadId, editingTitle.trim());
                    }
                    setEditingThreadId(null);
                  }}
                  className="px-2.5 py-1 rounded bg-[#FFC928] text-black text-xs font-semibold flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  <span>Save</span>
                </button>
              </div>
            )}

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-white/40">
                  No messages in this conversation yet.
                </div>
              ) : (
                filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3.5 rounded-xl border text-xs ${
                      msg.role === 'assistant'
                        ? 'bg-[#FFC928]/5 border-[#FFC928]/25 text-white'
                        : 'bg-[#0E0E0E] border-white/10 text-white/90 ml-6'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#C5A059] mb-1.5">
                      <span className="font-medium">
                        {msg.role === 'assistant' ? 'JARVIS AI' : 'You'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-tabular text-white/40">
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg)}
                          aria-label="Copy message"
                          className="text-white/45 hover:text-[#FFC928]"
                        >
                          {copiedMsgId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-[#FFC928]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {msg.role === 'user' && (
                          <button
                            type="button"
                            onClick={() => onRetryMessage(msg)}
                            aria-label="Retry message"
                            className="text-white/45 hover:text-[#FFC928]"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Attached file badges if present */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {msg.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/80 border border-[#FFC928]/25 text-[11px] text-[#FFC928]"
                          >
                            {att.previewUrl && (
                              <img
                                src={att.previewUrl}
                                alt={att.name}
                                referrerPolicy="no-referrer"
                                className="w-5 h-5 rounded object-cover"
                              />
                            )}
                            <span className="truncate max-w-[160px]">{att.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="leading-relaxed whitespace-pre-wrap text-xs sm:text-sm">
                      {msg.content}
                    </p>

                    {/* Grounding Sources if present */}
                    {msg.groundingSources && msg.groundingSources.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#C5A059]">
                        <span>Sources:</span>
                        {msg.groundingSources.map((src, idx) => (
                          <a
                            key={idx}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#FFC928] hover:underline inline-flex items-center gap-1"
                          >
                            <span className="truncate max-w-[180px]">{src.title}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Region: Subtle Captions + Attachment Previews + Chat Composer Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom,1rem))] pt-2 flex flex-col items-center pointer-events-none">
        {/* Ephemeral Status / Live Voice Caption above Composer */}
        <div className="w-full max-w-2xl flex flex-col items-center mb-2.5">
          {stateLabel && (
            <div className="flex items-center gap-2 mb-1 text-xs text-[#FFC928] tracking-wider">
              <span>{stateLabel}</span>
              {(interactionState === 'speaking' ||
                interactionState === 'listening' ||
                interactionState === 'thinking') && (
                <button
                  type="button"
                  onClick={onStopActiveAction}
                  aria-label="Stop current voice or AI operation"
                  className="pointer-events-auto inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#FFC928]/35 text-[11px] text-[#FFC928] hover:bg-[#FFC928]/15"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>Stop</span>
                </button>
              )}
            </div>
          )}

          {showSubtleCaptions && liveCaption && !isChatDrawerOpen && (
            <button
              type="button"
              onClick={() => onToggleChatDrawer(true)}
              title="Tap to open full conversation view"
              className="pointer-events-auto max-w-xl text-center text-xs sm:text-sm font-normal text-white/90 leading-relaxed tracking-wide line-clamp-3 hover:text-white transition-colors"
            >
              {liveCaption}
            </button>
          )}

          {showSubtleCaptions && captionSubtext && !isChatDrawerOpen && (
            <p className="max-w-md text-center text-[11px] text-[#C5A059] mt-1 tracking-wide">
              {captionSubtext}
            </p>
          )}
        </div>

        {/* Selected Attachment Previews Strip */}
        {attachments.length > 0 && (
          <div className="w-full max-w-2xl mb-2 flex flex-wrap gap-2 pointer-events-auto">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#0A0A0A]/95 border border-[#FFC928]/35 text-xs text-white"
              >
                {att.previewUrl ? (
                  <img
                    src={att.previewUrl}
                    alt={att.name}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded object-cover shrink-0 border border-white/10"
                  />
                ) : (
                  <FileText className="w-4 h-4 text-[#FFC928] shrink-0" />
                )}
                <div className="min-w-0 max-w-[150px]">
                  <div className="truncate font-medium text-white text-[11px]">
                    {att.name}
                  </div>
                  <div className="text-[10px] text-[#C5A059] font-mono-tabular">
                    {att.uploadProgress < 100
                      ? `Uploading ${att.uploadProgress}%`
                      : `${(att.sizeBytes / 1024).toFixed(1)} KB`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  aria-label={`Remove ${att.name}`}
                  className="p-1 text-white/50 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Compact Attachment Menu Popup (Photo · Camera · File · PDF) */}
        <div className="relative w-full max-w-2xl pointer-events-auto">
          {isAttachMenuOpen && (
            <div
              role="menu"
              aria-label="Attachment Options"
              className="absolute bottom-14 left-0 z-30 w-48 rounded-2xl bg-[#080808] border border-[#FFC928]/35 p-1.5 shadow-2xl space-y-0.5"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => photoInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-medium text-white/90 hover:text-[#FFC928] hover:bg-[#FFC928]/10 transition-colors"
              >
                <ImageIcon className="w-4 h-4 text-[#FFC928]" />
                <span>Photo</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={openCameraCapture}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-medium text-white/90 hover:text-[#FFC928] hover:bg-[#FFC928]/10 transition-colors"
              >
                <Camera className="w-4 h-4 text-[#FFC928]" />
                <span>Camera</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-medium text-white/90 hover:text-[#FFC928] hover:bg-[#FFC928]/10 transition-colors"
              >
                <File className="w-4 h-4 text-[#FFC928]" />
                <span>File</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => pdfInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-medium text-white/90 hover:text-[#FFC928] hover:bg-[#FFC928]/10 transition-colors"
              >
                <FileText className="w-4 h-4 text-[#FFC928]" />
                <span>PDF</span>
              </button>
            </div>
          )}

          {/* Persistent Bottom Chat Bar: Circular + button left, Text input center, Send button right */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2.5 w-full rounded-full bg-[#090909]/95 border border-[#FFC928]/30 px-2 py-1.5 shadow-[0_0_25px_rgba(0,0,0,0.9)] focus-within:border-[#FFC928]/70 transition-colors"
          >
            {/* Circular + Button on the Left */}
            <button
              type="button"
              onClick={() => setIsAttachMenuOpen((prev) => !prev)}
              aria-label="Open attachment menu"
              aria-expanded={isAttachMenuOpen}
              className={`min-w-[42px] min-h-[42px] rounded-full flex items-center justify-center transition-colors shrink-0 ${
                isAttachMenuOpen
                  ? 'bg-[#FFC928] text-black'
                  : 'bg-[#141414] text-[#FFC928] border border-[#FFC928]/30 hover:bg-[#FFC928]/15'
              }`}
            >
              <Plus
                className={`w-5 h-5 transition-transform duration-200 ${
                  isAttachMenuOpen ? 'rotate-45' : ''
                }`}
              />
            </button>

            {/* Text Input Field */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && enterToSend) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Type a message or give a command..."
              aria-label="Type a message or give a command"
              className="flex-1 min-w-0 bg-transparent px-2 py-2 text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none"
            />

            {/* Subtle Conversation History Toggle if thread has messages */}
            {activeThread && activeThread.messages.length > 0 && (
              <button
                type="button"
                onClick={() => onToggleChatDrawer(!isChatDrawerOpen)}
                aria-label="Toggle conversation history"
                className={`min-w-[38px] min-h-[38px] rounded-full flex items-center justify-center transition-colors shrink-0 ${
                  isChatDrawerOpen
                    ? 'text-[#FFC928] bg-[#FFC928]/15'
                    : 'text-[#C5A059] hover:text-[#FFC928]'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            )}

            {/* Send Button on the Right */}
            <button
              type="submit"
              disabled={!inputText.trim() && attachments.length === 0}
              aria-label="Send message"
              className="min-w-[42px] min-h-[42px] rounded-full bg-[#FFC928] text-black flex items-center justify-center hover:bg-[#FFDF70] disabled:opacity-35 disabled:hover:bg-[#FFC928] transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
};
