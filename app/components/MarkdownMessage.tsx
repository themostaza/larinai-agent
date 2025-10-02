'use client';

import { useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';

export interface MarkdownMessageProps {
  content: string;
}

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-2">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
        title="Copia codice"
      >
        {copied ? (
          <Check size={14} className="text-green-400" />
        ) : (
          <Copy size={14} className="text-gray-400" />
        )}
      </button>
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        className="!bg-gray-950 !rounded-lg !text-sm"
        customStyle={{
          margin: 0,
          padding: '1rem',
          borderRadius: '0.5rem',
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Paragrafi
        p: ({ children }) => (
          <p className="mb-2 last:mb-0">{children}</p>
        ),
        
        // Headers
        h1: ({ children }) => (
          <h1 className="text-2xl font-bold mt-4 mb-2 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl font-bold mt-3 mb-2 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg font-bold mt-2 mb-1 first:mt-0">{children}</h3>
        ),
        
        // Liste
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="ml-2">{children}</li>
        ),
        
        // Link
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            {children}
          </a>
        ),
        
        // Code inline
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match;
          
          if (isInline) {
            return (
              <code
                className="px-1.5 py-0.5 bg-gray-800 text-pink-400 rounded text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          }
          
          // Code block
          const language = match[1];
          const code = String(children).replace(/\n$/, '');
          
          return <CodeBlock language={language}>{code}</CodeBlock>;
        },
        
        // Blockquote
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-gray-600 pl-4 italic my-2 text-gray-300">
            {children}
          </blockquote>
        ),
        
        // Tabelle
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="min-w-full border border-gray-700 rounded-lg">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-gray-800">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-gray-700">{children}</tbody>
        ),
        tr: ({ children }) => (
          <tr className="hover:bg-gray-800/50">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-4 py-2 text-left text-sm font-semibold">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-2 text-sm">{children}</td>
        ),
        
        // Horizontal rule
        hr: () => (
          <hr className="my-4 border-gray-700" />
        ),
        
        // Strong/Bold
        strong: ({ children }) => (
          <strong className="font-bold">{children}</strong>
        ),
        
        // Emphasis/Italic
        em: ({ children }) => (
          <em className="italic">{children}</em>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// Usa memo per evitare re-render inutili
export default memo(MarkdownMessage) as React.FC<MarkdownMessageProps>;

