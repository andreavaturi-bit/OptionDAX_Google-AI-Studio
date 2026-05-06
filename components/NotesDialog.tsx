import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, StickyNote, Image as ImageIcon, Trash2, Maximize2, Plus } from 'lucide-react';
import { NoteData, Attachment } from '../types';

interface NotesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  notes?: NoteData;
  onSave: (notes: NoteData) => void;
  title: string;
}

const NotesDialog: React.FC<NotesDialogProps> = ({ isOpen, onClose, notes, onSave, title }) => {
  const [text, setText] = useState(notes?.text || '');
  const [attachments, setAttachments] = useState<Attachment[]>(notes?.attachments || []);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setText(notes?.text || '');
      setAttachments(notes?.attachments || []);
    }
  }, [isOpen, notes]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            const newAttachment: Attachment = {
              id: crypto.randomUUID(),
              name: `Screenshot-${new Date().toLocaleString()}`,
              data: base64,
              type: blob.type,
              timestamp: Date.now(),
            };
            setAttachments(prev => [...prev, newAttachment]);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          const newAttachment: Attachment = {
            id: crypto.randomUUID(),
            name: file.name,
            data: base64,
            type: file.type,
            timestamp: Date.now(),
          };
          setAttachments(prev => [...prev, newAttachment]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSave = () => {
    onSave({ text, attachments });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-800 flex items-center justify-between bg-slate-50/50 dark:bg-gray-800/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                <StickyNote size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Note & Screenshot</h2>
                <p className="text-xs text-slate-500 dark:text-gray-400 font-medium uppercase tracking-wider">{title}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-gray-700 rounded-full transition-colors text-slate-400">
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Text Area */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                Appunti di testo
                <span className="text-[9px] font-normal lowercase text-slate-300 italic">(Puoi incollare immagini qui)</span>
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPaste={handlePaste}
                placeholder="Scrivi qui i tuoi appunti o incolla uno screenshot (Ctrl+V)..."
                className="w-full h-32 p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-800/30 focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all resize-none text-slate-700 dark:text-gray-200 text-sm leading-relaxed"
              />
            </div>

            {/* Attachments */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Screenshot & Allegati ({attachments.length})</label>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[10px] font-bold text-accent uppercase tracking-widest flex items-center gap-1 hover:underline"
                >
                  <Plus size={12} /> Aggiungi file
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              {attachments.length === 0 ? (
                <div className="border-2 border-dashed border-slate-100 dark:border-gray-800 rounded-xl p-8 flex flex-col items-center justify-center text-slate-300 dark:text-gray-700">
                  <ImageIcon size={32} strokeWidth={1.5} className="mb-2" />
                  <p className="text-xs font-medium">Nessun screenshot allegato</p>
                  <p className="text-[10px] mt-1">Incolla un'immagine o usa il tasto "+"</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {attachments.map((att) => (
                    <div key={att.id} className="group relative aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-gray-700 bg-slate-100 dark:bg-gray-800 shadow-sm">
                      <img 
                        src={att.data} 
                        alt={att.name} 
                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                        onClick={() => setSelectedImage(att.data)}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button 
                          onClick={() => setSelectedImage(att.data)}
                          className="p-1.5 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/40 transition-colors"
                        >
                          <Maximize2 size={14} />
                        </button>
                        <button 
                          onClick={() => removeAttachment(att.id)}
                          className="p-1.5 bg-red-500/80 backdrop-blur-md rounded-full text-white hover:bg-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent">
                        <p className="text-[8px] text-white font-medium truncate">{att.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-gray-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-gray-800/50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-widest hover:text-slate-700 dark:hover:text-gray-300 transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-accent text-white text-xs font-bold uppercase tracking-widest rounded-lg shadow-lg shadow-accent/20 hover:bg-accent-dark transition-all active:scale-95"
            >
              Salva Note
            </button>
          </div>
        </motion.div>

        {/* Lightbox */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
              onClick={() => setSelectedImage(null)}
            >
              <button 
                className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"
                onClick={() => setSelectedImage(null)}
              >
                <X size={32} />
              </button>
              <motion.img
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                src={selectedImage}
                alt="Full size preview"
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
};

export default NotesDialog;
