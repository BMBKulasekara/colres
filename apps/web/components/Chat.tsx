'use client';

import { useMutation, useRoom, useSelf, useStorage } from '@liveblocks/react/suspense';
import { api } from '@repo/convex/_generated/api';
import { useMutation as useConvexMutation } from 'convex/react';
import Image from 'next/image';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

export function Chat() {
  const messages = useStorage((root) => root.messages);
  const self = useSelf();
  const room = useRoom();
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const sendConvexMessage = useConvexMutation(api.chats.sendMessage);

  const sendMessage = useMutation(
    ({ storage }, text: string, userName: string, userAvatar: string, userId: string) => {
      if (!text.trim()) return;
      const messagesList = storage.get('messages');
      messagesList.push({
        id: Date.now().toString(),
        text: text.trim(),
        senderId: userId,
        senderName: userName,
        senderAvatar: userAvatar,
        timestamp: Date.now(),
      });
    },
    []
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !self) return;

    const text = inputText.trim();
    const name = self.info.name || 'Anonymous';
    const avatar = self.info.avatar || '';

    sendMessage(text, name, avatar, self.id);

    void sendConvexMessage({
      documentId: room.id,
      text,
      senderId: self.id,
      senderName: name,
      senderAvatar: avatar,
    });

    setInputText('');
  };

  useEffect(() => {
    if (messages) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[500px] bg-background border border-border/80 rounded-xl overflow-hidden shadow-xs">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages && messages.length > 0 ? (
          messages.map((msg) => {
            const isMe = msg.senderId === self?.id;
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 max-w-[85%] ${
                  isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {msg.senderAvatar ? (
                  <Image
                    src={msg.senderAvatar}
                    alt={msg.senderName}
                    width={100}
                    height={100}
                    className="h-7 w-7 rounded-full object-cover shrink-0 mt-0.5"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">
                    {msg.senderName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <div
                    className={`text-[9px] font-semibold text-muted-foreground ${
                      isMe ? 'text-right' : 'text-left'
                    }`}
                  >
                    {msg.senderName}
                  </div>
                  <div
                    className={`rounded-2xl px-3.5 py-1.5 text-xs leading-relaxed ${
                      isMe
                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                        : 'bg-muted text-foreground rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <span className="text-2xl mb-2">💬</span>
            <p className="text-xs font-semibold">No messages yet. Start the conversation!</p>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      <form onSubmit={handleSend} className="p-3 border-t border-border/80 bg-muted/20 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="px-4 py-1.5 bg-primary text-primary-foreground font-bold rounded-lg text-[10px] hover:bg-primary/95 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all shadow-xs"
        >
          Send
        </button>
      </form>
    </div>
  );
}
